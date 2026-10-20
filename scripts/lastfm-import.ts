import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { minimisedLastFmHistorySchema, minimiseLastFmHistory } from "../lib/evidence/private-ingest";
import {
  LASTFM_MAX_PAGES,
  LASTFM_PAGE_SIZE,
  mergeLastFmHistory,
  parseLastFmPage,
  readBoundedLastFmJson,
} from "../lib/evidence/private-import-integrations";

const args = process.argv.slice(2);
const value = (flag: string) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

function parseBoundary(input: string | undefined, fallback: Date, flag: string) {
  if (input === undefined) return fallback;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.valueOf())) throw new Error(`${flag} must be an ISO date or date-time.`);
  return parsed;
}

async function main() {
  const username = process.env.LASTFM_USERNAME?.trim();
  const apiKey = process.env.LASTFM_API_KEY?.trim();
  if (!username || !apiKey) {
    throw new Error("Set LASTFM_USERNAME and ensure LASTFM_API_KEY is configured in .env.local before importing.");
  }

  const now = new Date();
  const to = parseBoundary(value("--to"), now, "--to");
  const from = parseBoundary(value("--from"), new Date(to.valueOf() - 31 * 24 * 60 * 60 * 1000), "--from");
  if (from >= to) throw new Error("--from must be earlier than --to.");

  const timestamp = (date: Date) => Math.floor(date.valueOf() / 1000);
  const tracks: unknown[] = [];
  const directory = path.join(process.cwd(), "private-data", "minimised");
  const target = path.join(directory, "lastfm-history.private.json");
  const previous = existsSync(target)
    ? minimisedLastFmHistorySchema.parse(JSON.parse(readFileSync(target, "utf8")) as unknown)
    : undefined;
  let totalPages = 1;

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    if (pageNumber > LASTFM_MAX_PAGES) {
      throw new Error(`Last.fm returned more than ${LASTFM_MAX_PAGES} pages; no import was written.`);
    }

    const url = new URL("https://ws.audioscrobbler.com/2.0/");
    url.search = new URLSearchParams({
      method: "user.getRecentTracks",
      user: username,
      api_key: apiKey,
      format: "json",
      from: String(timestamp(from)),
      to: String(timestamp(to)),
      limit: String(LASTFM_PAGE_SIZE),
      page: String(pageNumber),
    }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Last.fm request failed with HTTP ${response.status}; no import was written.`);

    const body = await readBoundedLastFmJson(response) as { error?: number };
    if (body.error) throw new Error(`Last.fm returned API error ${body.error}; no import was written.`);
    const page = parseLastFmPage(body, pageNumber > 1 ? totalPages : undefined);
    tracks.push(...page.tracks);
    totalPages = page.totalPages;
  }

  const imported = minimiseLastFmHistory({ recenttracks: { track: tracks } });
  const records = imported.document.records.filter((record) => {
    const playedAt = Date.parse(record.playedAt);
    return playedAt >= from.valueOf() && playedAt < to.valueOf();
  });
  const document = minimisedLastFmHistorySchema.parse({
    ...imported.document,
    records: mergeLastFmHistory(previous, records),
  });
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const temporary = `${target}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  chmodSync(temporary, 0o600);
  renameSync(temporary, target);
  console.log(JSON.stringify({
    source: "lastfm-scrobbles",
    from: from.toISOString(),
    toExclusive: to.toISOString(),
    pages: totalPages,
    fetchedRows: tracks.length,
    retainedRowsInWindow: records.length,
    retainedRowsTotal: document.records.length,
    duplicateRowsOmitted: tracks.length - imported.document.records.length,
    target: "private-data/minimised/lastfm-history.private.json",
    storage: "local-private-staging-only; Vault import is a separate action",
  }));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  const safePrefixes = [
    "Set LASTFM_USERNAME",
    "--from must be earlier",
    "Last.fm request failed with HTTP ",
    "Last.fm returned API error ",
    "Last.fm returned more than ",
  ];
  const safeMessage = safePrefixes.some((prefix) => message.startsWith(prefix))
    ? message
    : "Last.fm import failed validation or network handling; no import was written.";
  console.error(safeMessage);
  process.exitCode = 1;
});
