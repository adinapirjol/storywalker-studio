import { chmodSync, existsSync, linkSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  minimisedGoogleCalendarSchema,
  minimisedLastFmHistorySchema,
  minimisedSpotifyHistorySchema,
  minimisedTimelineSchema,
  minimisedYouTubeHistorySchema,
} from "../lib/evidence/private-ingest";
import { privatePlaylistSnapshotSchema } from "../lib/music/private-playlist";
import { latestSpotifySnapshotsByPlaylist, playlistOccurrencesWithinWindow } from "../lib/evidence/private-import-integrations";

const DEFAULT_FROM = "2026-09-18T00:00:00+03:00";
const DEFAULT_TO_EXCLUSIVE = "2026-10-19T00:00:00+03:00";
const args = process.argv.slice(2);
const value = (flag: string) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const fromText = value("--from") ?? DEFAULT_FROM;
const toText = value("--to-exclusive") ?? DEFAULT_TO_EXCLUSIVE;
const from = new Date(fromText);
const toExclusive = new Date(toText);
const writePrivate = args.includes("--write-private");

if (Number.isNaN(from.valueOf()) || Number.isNaN(toExclusive.valueOf()) || from >= toExclusive) {
  throw new Error("Use valid ISO --from and --to-exclusive values, with from earlier than to-exclusive.");
}

const spotifyDirectory = path.join(process.cwd(), "private-data", "spotify");
type PrivateRecord = Record<string, unknown>;
type SourceResult = {
  source: string;
  playlistId?: string;
  playlistName?: string;
  status: "available" | "not-present" | "available-no-event-time";
  importedAt?: string;
  sourceRecordCount: number;
  datedRecordCount: number;
  inWindowCount: number;
  undatedRecordCount: number;
  records: PrivateRecord[];
  limitations: string[];
};

function readJson(relativePath: string): unknown | undefined {
  const absolutePath = path.join(process.cwd(), relativePath);
  if (!existsSync(absolutePath)) return undefined;
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8")) as unknown;
  } catch {
    throw new Error("A local private source contains invalid JSON; no delta was written.");
  }
}

function parseSource<T>(parser: { parse(value: unknown): T }, value: unknown): T {
  try {
    return parser.parse(value);
  } catch {
    throw new Error("A local private source failed schema validation; no delta was written.");
  }
}

function eventTime(value: unknown, dateOnlyIsBucharest = false): number | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const normalised = dateOnlyIsBucharest && /^\d{4}-\d{2}-\d{2}$/u.test(value)
    ? `${value}T00:00:00+03:00`
    : value;
  const parsed = Date.parse(normalised);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function makeSource(
  source: string,
  value: unknown | undefined,
  parse: (data: unknown) => { importedAt?: string; records: PrivateRecord[] },
  getEventTime: (record: PrivateRecord) => number | undefined,
  limitations: string[] = [],
): SourceResult {
  if (value === undefined) {
    return { source, status: "not-present", sourceRecordCount: 0, datedRecordCount: 0, inWindowCount: 0, undatedRecordCount: 0, records: [], limitations };
  }
  const document = parse(value);
  const dated: Array<{ record: PrivateRecord; time: number }> = [];
  let undatedRecordCount = 0;
  for (const record of document.records) {
    const time = getEventTime(record);
    if (time === undefined) undatedRecordCount += 1;
    else dated.push({ record, time });
  }
  const selected = dated
    .filter(({ time }) => time >= from.valueOf() && time < toExclusive.valueOf())
    .map(({ record }) => record);
  return {
    source,
    status: dated.length ? "available" : "available-no-event-time",
    ...(document.importedAt ? { importedAt: document.importedAt } : {}),
    sourceRecordCount: document.records.length,
    datedRecordCount: dated.length,
    inWindowCount: selected.length,
    undatedRecordCount,
    records: selected,
    limitations,
  };
}

const sources: SourceResult[] = [
  makeSource("google-timeline", readJson("private-data/minimised/google-timeline.private.json"), (data) => parseSource(minimisedTimelineSchema, data), (record) => eventTime(record.startAt ?? record.endAt), ["Platform-inferred visits and routes are source signals, not verified autobiographical facts."]),
  makeSource("google-calendar-takeout", readJson("private-data/minimised/google-takeout-calendar.private.json"), (data) => parseSource(minimisedGoogleCalendarSchema, data), (record) => eventTime(record.startsWhen, true), ["Calendar entries show scheduled records, not that an event happened.", "Date-only values use Europe/Bucharest midnight for this requested window."]),
  makeSource("spotify-extended-streaming-history", readJson("private-data/minimised/spotify.minimised.private.json"), (data) => parseSource(minimisedSpotifyHistorySchema, data), (record) => eventTime(record.endedAt), ["Playback records establish a platform event, not attention or meaning."]),
  makeSource("lastfm-scrobbles", readJson("private-data/minimised/lastfm-history.private.json"), (data) => parseSource(minimisedLastFmHistorySchema, data), (record) => eventTime(record.playedAt), ["Scrobbles establish a recorded listening time, not why a track mattered."]),
  makeSource("youtube-watch-history", readJson("private-data/minimised/youtube-watch-history.private.json"), (data) => parseSource(minimisedYouTubeHistorySchema, data), (record) => eventTime(record.watchedAt) ?? eventTime(typeof record.watchedWhen === "string" ? record.watchedWhen.replace(/ BST$/u, " +0100").replace(/ GMT$/u, " +0000") : undefined), ["Watch history establishes a recorded watch, not attention, learning, or meaning."]),
];

const maps = readJson("private-data/minimised/google-takeout-maps.private.json") as { importedAt?: string; records?: unknown[] } | undefined;
sources.push({
  source: "google-maps-takeout",
  status: maps ? "available-no-event-time" : "not-present",
  ...(maps?.importedAt ? { importedAt: maps.importedAt } : {}),
  sourceRecordCount: Array.isArray(maps?.records) ? maps.records.length : 0,
  datedRecordCount: 0,
  inWindowCount: 0,
  undatedRecordCount: Array.isArray(maps?.records) ? maps.records.length : 0,
  records: [],
  limitations: ["Saved-place labels do not carry a visit time and are excluded from this period delta."],
});

const spotifySnapshots = existsSync(spotifyDirectory)
  ? readdirSync(spotifyDirectory).filter((file) => file !== "selected.private.json" && file.endsWith(".private.json") && !file.endsWith(".delta.private.json"))
  : [];
const snapshots = spotifySnapshots.map((file) => parseSource(privatePlaylistSnapshotSchema, readJson(path.join("private-data", "spotify", file))));
for (const snapshot of latestSpotifySnapshotsByPlaylist(snapshots)) {
  const dated = playlistOccurrencesWithinWindow(snapshot, from.valueOf(), toExclusive.valueOf());
  sources.push({
    source: "spotify-playlist",
    playlistId: snapshot.playlist.id,
    playlistName: snapshot.playlist.name,
    status: snapshot.occurrences.some((occurrence) => occurrence.addedAt) ? "available" : "available-no-event-time",
    importedAt: snapshot.importedAt,
    sourceRecordCount: snapshot.occurrenceCount,
    datedRecordCount: snapshot.occurrences.filter((occurrence) => occurrence.addedAt).length,
    inWindowCount: dated.length,
    undatedRecordCount: snapshot.missingTimestampPositions.length,
    records: dated,
    limitations: ["This is a time-window extraction of additions in the latest available snapshot, not a comparison of historical snapshots or a removals report.", "Playlist additions are not listening history or evidence of an event.", "Collection contents from MCP without addition timestamps remain undated and cannot be assigned to this period."],
  });
}

const delta = {
  schemaVersion: 1,
  privacy: "private",
  canonical: false,
  sourceOfTruth: "local-minimised-source-snapshots",
  generatedAt: new Date().toISOString(),
  window: { from: from.toISOString(), toExclusive: toExclusive.toISOString(), timezone: "Europe/Bucharest" },
  storage: "local-private-staging-only; no encrypted Vault import is implied",
  sources,
};
const localFromDay = fromText.slice(0, 10);
const exclusiveToDay = toText.slice(0, 10);
const localLastDay = new Date(`${exclusiveToDay}T00:00:00Z`);
localLastDay.setUTCDate(localLastDay.getUTCDate() - 1);
const fileLabel = `${localFromDay}_to_${localLastDay.toISOString().slice(0, 10)}.delta.private.json`;
const target = path.join(process.cwd(), "private-data", "deltas", fileLabel);
const summary = {
  dryRun: !writePrivate,
  window: delta.window,
  sources: sources.map(({ source, status, sourceRecordCount, datedRecordCount, inWindowCount, undatedRecordCount }) => ({ source, status, sourceRecordCount, datedRecordCount, inWindowCount, undatedRecordCount })),
  output: "private-data/deltas/" + fileLabel,
};
console.log(JSON.stringify(summary));

if (writePrivate) {
  mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  chmodSync(path.dirname(target), 0o700);
  if (!args.includes("--replace") && existsSync(target)) {
    throw new Error("A delta already exists for this window. Inspect it first or rerun with --replace.");
  }
  const temporary = `${target}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(delta, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  chmodSync(temporary, 0o600);
  if (args.includes("--replace")) renameSync(temporary, target);
  else {
    try {
      linkSync(temporary, target);
      unlinkSync(temporary);
    } catch (error) {
      unlinkSync(temporary);
      throw error;
    }
  }
}
