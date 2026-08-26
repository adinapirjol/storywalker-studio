import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";
import { inspectAndMinimiseTimeline, minimiseSpotifyHistory } from "../lib/private-ingest";
import { migrateStagedRecovery, sha256, stageRecovery, validateRecoveryLedger } from "../lib/private-recovery";

const args = process.argv.slice(2);
const source = args[0] === "spotify" || args[0] === "timeline" || args[0] === "recovery" ? args[0] : undefined;
const value = (flag: string) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
const requireAbsolute = (flag: string) => { const path = value(flag); if (!path || !isAbsolute(path)) throw new Error(`${flag} requires an absolute path.`); return path; };
const writePrivate = args.includes("--write-private");

if (!source) throw new Error("Usage: npm run private:import -- <spotify|timeline|recovery> ... --dry-run | --write-private");

if (source === "recovery") {
  const ledgerPath = requireAbsolute("--ledger");
  const authorReviewPath = requireAbsolute("--author-review");
  const gapsPath = requireAbsolute("--gaps");
  const importPromptPath = requireAbsolute("--import-prompt");
  const paths = { ledger: ledgerPath, authorReview: authorReviewPath, gaps: gapsPath, importPrompt: importPromptPath };
  for (const [name, input] of Object.entries(paths)) if (!existsSync(input)) throw new Error(`Missing required ${name} input: ${input}`);
  const ledgerText = readFileSync(ledgerPath, "utf8");
  const parsed = validateRecoveryLedger(JSON.parse(ledgerText) as unknown);
  const inputHashes = Object.fromEntries(Object.entries(paths).map(([name, input]) => [name, sha256(readFileSync(input, "utf8"))]));
  const output = resolve("private-data/storywalker/july-august-2026.recovery.private.json");
  const existing = existsSync(output) ? migrateStagedRecovery(JSON.parse(readFileSync(output, "utf8")) as unknown) : undefined;
  const baseReport = { dryRun: !writePrivate, inputs: Object.fromEntries(Object.entries(paths).map(([name, input]) => [name, { file: basename(input), sha256: inputHashes[name] }])), errors: parsed.errors, warnings: parsed.warnings, output, publicContentWritten: false };
  if (!parsed.ledger || parsed.errors.length) { console.log(JSON.stringify(baseReport, null, 2)); process.exitCode = 1; }
  else {
    const staged = stageRecovery(parsed.ledger, { authorReviewMarkdown: readFileSync(authorReviewPath, "utf8"), gapsMarkdown: readFileSync(gapsPath, "utf8"), importPromptMarkdown: readFileSync(importPromptPath, "utf8") }, inputHashes, existing);
    console.log(JSON.stringify({ ...baseReport, counts: { moments: staged.document.moments.length, journeys: staged.document.journeys.map((journey) => ({ id: journey.id, moments: journey.sourceMomentIds.length })), restricted: staged.document.moments.filter((moment) => moment.sensitivity === "restricted").length, private: staged.document.moments.filter((moment) => moment.privacy === "private").length, pending: staged.document.moments.filter((moment) => moment.reviewStatus === "pending").length, noncanonical: staged.document.moments.filter((moment) => !moment.canonical).length, momentsWithMusic: staged.document.moments.filter((moment) => moment.music.length > 0).length, musicEncounterTypes: Object.fromEntries(staged.document.moments.flatMap((moment) => moment.music).reduce((counts, music) => counts.set(music.encounterType, (counts.get(music.encounterType) ?? 0) + 1), new Map<string, number>())), missingDates: staged.document.moments.filter((moment) => moment.when.start === null).length, unknownLocations: staged.document.moments.filter((moment) => moment.where.precision === "unknown").length, unresolvedContradictionGroups: staged.document.coverageReport.momentsWithUnresolvedContradictions, localContradictionNotes: staged.document.moments.reduce((count, moment) => count + moment.contradictions.length, 0), unansweredQuestions: staged.document.unansweredQuestions.length }, merge: staged.summary }, null, 2));
    if (writePrivate) { mkdirSync(resolve("private-data/storywalker"), { recursive: true, mode: 0o700 }); writeFileSync(output, `${JSON.stringify(staged.document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); }
  }
} else {
  const input = requireAbsolute("--input");
  const raw = JSON.parse(readFileSync(resolve(input), "utf8"));
  const result = source === "spotify" ? minimiseSpotifyHistory(raw) : inspectAndMinimiseTimeline(raw);
  console.log(JSON.stringify({ input: basename(input), dryRun: !writePrivate, ...result.summary }, null, 2));
  if (writePrivate) { const outputDir = resolve("private-data/minimised"); mkdirSync(outputDir, { recursive: true, mode: 0o700 }); const output = resolve(outputDir, source === "timeline" ? "google-timeline.private.json" : `${source}.minimised.private.json`); writeFileSync(output, `${JSON.stringify(result.document, null, 2)}\n`, { mode: 0o600 }); console.log(`Wrote minimised local-only derivative: ${output}`); }
}
