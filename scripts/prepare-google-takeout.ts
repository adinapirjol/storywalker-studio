import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { inspectAndMinimiseTimeline, minimiseGoogleCalendarIcs, minimiseGoogleMapsLabeledPlaces, minimiseYouTubeWatchHistoryHtml } from "../lib/private-ingest";
import { minimiseGoogleMapsSavedListCsv, minimiseGoogleMapsSavedListsCsv } from "../lib/google-maps-list";

const args = process.argv.slice(2);
const roots = args.filter((value) => !value.startsWith("--"));
const writePrivate = args.includes("--write-private");
const requestedSources = new Set((args.find((value) => value.startsWith("--only="))?.slice("--only=".length).split(",").filter(Boolean) ?? []));
const enabled = (source: string) => !requestedSources.size || requestedSources.has(source);
const selectedSavedListPath = args.find((value) => value.startsWith("--saved-list="))?.slice("--saved-list=".length);
const allSavedLists = args.includes("--all-saved-lists");
if (!roots.length || roots.some((root) => !isAbsolute(root))) throw new Error("Usage: node --import tsx scripts/prepare-google-takeout.ts /absolute/Takeout [/absolute/Takeout-2] [--write-private]");
if (roots.some((root) => !existsSync(root))) throw new Error("One or more selected Takeout folders do not exist.");
if (selectedSavedListPath && (!isAbsolute(selectedSavedListPath) || !existsSync(selectedSavedListPath) || !selectedSavedListPath.toLocaleLowerCase().endsWith(".csv"))) throw new Error("--saved-list must name one existing absolute Saved CSV file.");

function filesIn(root: string, predicate: (file: string) => boolean): string[] {
  return readdirSync(root, { recursive: true, withFileTypes: true }).flatMap((entry) => {
    const file = join(entry.parentPath, entry.name);
    return entry.isFile() && predicate(file) ? [file] : [];
  });
}

const calendarFiles = enabled("calendar") ? roots.flatMap((root) => filesIn(root, (file) => file.toLowerCase().endsWith(".ics"))) : [];
const calendar = minimiseGoogleCalendarIcs(calendarFiles.map((file) => readFileSync(file, "utf8")));
const labelledPlaces = enabled("maps") ? roots.flatMap((root) => filesIn(root, (file) => basename(file) === "Labeled places.json")) : [];
const maps = labelledPlaces.length ? minimiseGoogleMapsLabeledPlaces(JSON.parse(readFileSync(labelledPlaces[0], "utf8")) as unknown) : undefined;
const selectedSavedList = selectedSavedListPath && enabled("saved-maps-list") ? minimiseGoogleMapsSavedListCsv(readFileSync(selectedSavedListPath, "utf8")) : undefined;
const savedListCsvs = allSavedLists && enabled("saved-maps-lists") ? roots.flatMap((root) => filesIn(root, (file) => file.toLocaleLowerCase().endsWith(".csv") && /\/saved\//iu.test(file))) : [];
const savedLists = savedListCsvs.length ? minimiseGoogleMapsSavedListsCsv(savedListCsvs.map((file) => readFileSync(file, "utf8"))) : undefined;
const watchHistory = enabled("youtube") ? roots.flatMap((root) => filesIn(root, (file) => basename(file) === "watch-history.html")) : [];
const youtube = watchHistory.length ? minimiseYouTubeWatchHistoryHtml(readFileSync(watchHistory[0], "utf8")) : undefined;
const timelineFiles = enabled("timeline") ? roots.flatMap((root) => filesIn(root, (file) => {
  const normalised = file.toLocaleLowerCase();
  return normalised.endsWith(".json") && (normalised.includes("/timeline/") || normalised.includes("semantic location history") || basename(normalised) === "records.json");
})).filter((file) => basename(file) !== "Settings.json") : [];
const timeline = timelineFiles.length ? inspectAndMinimiseTimeline(timelineFiles.map((file) => JSON.parse(readFileSync(file, "utf8")) as unknown)) : undefined;
const encryptedTimelineMarkers = enabled("timeline") ? roots.flatMap((root) => filesIn(root, (file) => /\/timeline\/encrypted backups\.txt$/iu.test(file))) : [];
const directory = resolve("private-data/minimised");
const outputs = [
  ...(calendarFiles.length ? [{ name: "calendar", output: join(directory, "google-takeout-calendar.private.json"), inputs: calendarFiles.map((file) => basename(file)), result: calendar }] : []),
  ...(maps ? [{ name: "maps", output: join(directory, "google-takeout-maps.private.json"), inputs: labelledPlaces.map((file) => basename(file)), result: maps }] : []),
  ...(selectedSavedList ? [{ name: "saved-maps-list", output: join(directory, "google-takeout-maps-selected-saved-list.private.json"), inputs: ["1 author-selected Saved CSV"], result: selectedSavedList }] : []),
  ...(savedLists ? [{ name: "saved-maps-lists", output: join(directory, "google-takeout-maps-saved-lists.private.json"), inputs: [`${savedListCsvs.length} Saved CSV file(s)`], result: savedLists }] : []),
  ...(youtube ? [{ name: "youtube", output: join(directory, "youtube-watch-history.private.json"), inputs: watchHistory.map((file) => basename(file)), result: youtube }] : []),
  ...(timeline && timeline.summary.retained ? [{ name: "timeline", output: join(directory, "google-timeline.private.json"), inputs: timelineFiles.map((file) => basename(file)), result: timeline }] : []),
];
console.log(JSON.stringify({ dryRun: !writePrivate, sources: outputs.map(({ name, output, inputs, result }) => ({ name, output, inputs, ...result.summary })), timeline: { readableInputs: timelineFiles.map((file) => basename(file)), encryptedBackupMarkers: encryptedTimelineMarkers.map((file) => basename(file)), ...(timeline ? timeline.summary : { retained: 0, warnings: encryptedTimelineMarkers.length ? ["Timeline export contains encrypted backups rather than readable trip/stop data; no movement records were prepared."] : ["No Timeline export was found."] }) } }, null, 2));
if (writePrivate) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  for (const item of outputs) writeFileSync(item.output, `${JSON.stringify(item.result.document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  console.log(`Wrote ${outputs.length} minimised local-only derivative(s) in ${directory}`);
}
