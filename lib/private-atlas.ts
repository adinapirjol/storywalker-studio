import type { VaultRecord } from "@/lib/private-vault";

export type AtlasLane = { id: string; title: string; evidenceCount: number; sourceRecordIds: string[]; matchedTerms: string[]; status: "evidence-window" | "working-thread"; note: string };
export type AtlasImport = { id: string; source: string; importedAt: string; retained: number };
export type AtlasChange = { id: string; title: string; detail: string; sourceRecordIds: string[] };
export type AtlasConvergence = { id: string; title: string; detail: string; evidenceLayers: string[]; sourceRecordIds: string[] };
export type AtlasNeed = { id: string; title: string; detail: string; sourceRecordIds: string[] };
export type AtlasPlaceCandidate = { label: string; sourceRecordId: string; evidence: "timeline-label" | "nearby-saved-place" | "same-time-calendar" | "same-day-moment"; score: number; reason: string };
export type AtlasPlaceReading = { id: string; when: string; kind: "visit" | "route"; candidates: AtlasPlaceCandidate[]; resolution: "unresolved" | "one-candidate" | "competing-candidates"; caveat: string };
export type AtlasNow = {
  schemaVersion: 3; kind: "storywalker-atlas-now"; privacy: "private"; canonical: false; derivedAt: string;
  method: "explicit-keyword-record-layer-and-delta-v3"; sourceRecordCount: number; imports: AtlasImport[]; lanes: AtlasLane[];
  acknowledgedImports?: AtlasImport[]; acknowledgedSourceIds?: string[];
  whatChanged: AtlasChange[]; convergences: AtlasConvergence[]; needsYou: AtlasNeed[]; placeReadings: AtlasPlaceReading[]; placeCoverage: { timelineWindows: number; windowsWithCandidates: number; directTimelineLabels: number }; caveat: string;
};

const laneDefinitions: Array<{ id: string; title: string; terms: readonly string[]; sources?: readonly string[] }> = [
  { id: "creative-tech-study", title: "Creative technology and study", terms: ["creative technology", "creative-tech", "digital art", "la salle", "master", "masters", "barcelona"] },
  { id: "relocation-career", title: "Relocation and career", terms: ["relocation", "barcelona", "bristol", "job", "career", "salary", "endava"] },
  { id: "festival-infrastructure", title: "Festival infrastructure", terms: ["volunteer", "volunteering", "steward", "festival", "shift"] },
  { id: "music-listening", title: "Music and listening", terms: ["spotify", "lastfm", "last.fm", "playlist", "scrobble", "music"] },
  { id: "public-practice", title: "Public practice and portfolio", terms: ["portfolio", "substack", "medium", "public voice", "creative practice", "installation"] },
  { id: "selected-maps-list", title: "Saved Maps places", terms: [], sources: ["google-maps-takeout-saved-list", "google-maps-takeout-saved-lists"] },
] as const;

function payload(record: VaultRecord) { return record.payload as Record<string, unknown>; }
function recordText(record: VaultRecord) {
  const content = payload(record); const document = content.document as { records?: unknown[] } | undefined;
  const records = document?.records;
  if (record.kind === "import" && Array.isArray(records) && records.length > 500) return JSON.stringify({ ...content, document: { ...document, records: records.slice(0, 16), atlasRecordCount: records.length, atlasView: "bounded-import-summary" } }).toLocaleLowerCase();
  return JSON.stringify(content).toLocaleLowerCase();
}
function recordLayer(record: VaultRecord) { const source = payload(record).source; return record.kind === "import" && typeof source === "string" ? source : record.kind; }
function titleFor(record: VaultRecord) { const title = payload(record).title; return typeof title === "string" ? title : record.id; }
function importRecord(record: VaultRecord): AtlasImport | undefined {
  const content = payload(record); const source = content.source; const importedAt = content.importedAt;
  if (record.kind !== "import" || typeof source !== "string") return undefined;
  const document = content.document as { records?: unknown[] } | undefined; const snapshot = content.snapshot as { occurrences?: unknown[] } | undefined;
  const summary = content.summary as { retained?: unknown } | undefined;
  const retained = Array.isArray(document?.records) ? document.records.length : Array.isArray(snapshot?.occurrences) ? snapshot.occurrences.length : typeof summary?.retained === "number" ? summary.retained : 0;
  return { id: record.id, source, importedAt: typeof importedAt === "string" ? importedAt : record.capturedAt, retained };
}

/** A Side Quest export is deliberately preserved as one snapshot plus many
 * source-recorded entities. Atlas should report that as one import, not repeat
 * the same source name for every preserved tracker row. */
function importRecords(records: VaultRecord[]) {
  const standard = records.flatMap((record) => payload(record).source === "side-quest-control-room" ? [] : [importRecord(record)]).filter((item): item is AtlasImport => Boolean(item));
  const sideQuestGroups = new Map<string, VaultRecord[]>();
  for (const record of records) {
    const content = payload(record); if (record.kind !== "import" || content.source !== "side-quest-control-room") continue;
    const sourceHash = typeof content.sourceHash === "string" ? content.sourceHash : record.id;
    sideQuestGroups.set(sourceHash, [...(sideQuestGroups.get(sourceHash) ?? []), record]);
  }
  const sideQuest = [...sideQuestGroups.entries()].map(([sourceHash, group]) => {
    const snapshot = group.find((record) => Boolean(payload(record).data));
    const importedAt = group.map((record) => typeof payload(record).importedAt === "string" ? payload(record).importedAt as string : record.capturedAt).sort().at(-1) ?? group[0]!.capturedAt;
    return { id: snapshot?.id ?? `side-quest:source:${sourceHash.slice(0, 24)}`, source: "side-quest-control-room", importedAt, retained: group.filter((record) => !payload(record).data).length } satisfies AtlasImport;
  });
  return [...standard, ...sideQuest].sort((a, b) => a.importedAt.localeCompare(b.importedAt) || a.id.localeCompare(b.id));
}

function sourceChange(record: VaultRecord): AtlasChange | undefined {
  if (record.kind === "editorial-draft") return { id: `new:${record.id}`, title: "New private editorial source", detail: "An unpublished private editorial draft is now available for retrieval. It remains non-canonical and does not create an Episode, Journey proposal, or public draft.", sourceRecordIds: [record.id] };
  if (record.kind === "capture") return { id: `new:${record.id}`, title: "New private capture", detail: "A private pending capture is now available for review. It does not establish a relationship, meaning, or task.", sourceRecordIds: [record.id] };
  return undefined;
}

type TimelineWindow = { kind: "visit" | "route"; startAt?: string; endAt?: string; locationLabel?: string; startLocationLabel?: string; endLocationLabel?: string; latitude?: number; longitude?: number; accuracyMeters?: number };
type SavedPlace = { label?: string; latitude?: number; longitude?: number; sourceRecordId: string };
type CalendarEvent = { startsWhen?: string; endsWhen?: string; title?: string; location?: string; sourceRecordId: string };
type MomentPlace = { label: string; day: string; id: string };
export type AtlasBuildOptions = { timelineWindows?: Iterable<unknown> };

function asRecord(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function asString(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function isoPrefix(value: string | undefined) { return value?.match(/^\d{4}-\d{2}-\d{2}/u)?.[0]; }
function timestamp(value: string | undefined) { if (!value) return undefined; const parsed = new Date(value.replace(/\[[^\]]+\]$/u, "")); return Number.isNaN(parsed.valueOf()) ? undefined : parsed.valueOf(); }
function distanceMeters(a: { latitude?: number; longitude?: number }, b: { latitude?: number; longitude?: number }) {
  if (!Number.isFinite(a.latitude) || !Number.isFinite(a.longitude) || !Number.isFinite(b.latitude) || !Number.isFinite(b.longitude)) return undefined;
  const radians = Math.PI / 180; const lat1 = a.latitude! * radians; const lat2 = b.latitude! * radians;
  const dLat = (b.latitude! - a.latitude!) * radians; const dLon = (b.longitude! - a.longitude!) * radians;
  const sinLat = Math.sin(dLat / 2); const sinLon = Math.sin(dLon / 2);
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon), Math.sqrt(1 - (sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon)));
}

/** A local, reversible location reading. It ranks only labels already present
 * in encrypted sources; it does not reverse-geocode coordinates or claim a
 * city/country that no source named. */
function timelineWindow(value: unknown): TimelineWindow | undefined {
  const item = asRecord(value); if (!item) return undefined; const kind = item.kind === "visit" || item.kind === "route" ? item.kind : undefined;
  return kind ? { kind, startAt: asString(item.startAt), endAt: asString(item.endAt), locationLabel: asString(item.locationLabel), startLocationLabel: asString(item.startLocationLabel), endLocationLabel: asString(item.endLocationLabel), latitude: typeof item.latitude === "number" ? item.latitude : undefined, longitude: typeof item.longitude === "number" ? item.longitude : undefined, accuracyMeters: typeof item.accuracyMeters === "number" ? item.accuracyMeters : undefined } : undefined;
}

function buildPlaceReadings(source: VaultRecord[], options?: AtlasBuildOptions) {
  const timelineRecord = source.find((record) => record.kind === "import" && payload(record).source === "google-timeline");
  const timelineDocument = asRecord(payload(timelineRecord ?? { payload: {} } as VaultRecord).document);
  const rawWindows = options?.timelineWindows ?? (Array.isArray(timelineDocument?.records) ? timelineDocument.records : []);
  const maps = source.filter((record) => record.kind === "import" && (payload(record).source === "google-takeout-maps" || payload(record).source === "google-maps-takeout-saved-list" || payload(record).source === "google-maps-takeout-saved-lists")).flatMap((record) => {
    const document = asRecord(payload(record).document); return Array.isArray(document?.records) ? document.records.flatMap((item) => { const value = asRecord(item); const label = asString(value?.label); return label ? [{ label, latitude: typeof value?.latitude === "number" ? value.latitude : undefined, longitude: typeof value?.longitude === "number" ? value.longitude : undefined, sourceRecordId: record.id } satisfies SavedPlace] : []; }) : [];
  });
  const calendar = source.filter((record) => record.kind === "import" && payload(record).source === "google-takeout-calendar").flatMap((record) => {
    const document = asRecord(payload(record).document); return Array.isArray(document?.records) ? document.records.flatMap((item) => { const value = asRecord(item); return [{ startsWhen: asString(value?.startsWhen), endsWhen: asString(value?.endsWhen), title: asString(value?.title), location: asString(value?.location), sourceRecordId: record.id } satisfies CalendarEvent]; }) : [];
  });
  const moments: MomentPlace[] = source.filter((record) => record.kind === "moment").flatMap((record) => {
    const moment = asRecord(payload(record).moment); const when = asRecord(moment?.when); const where = asRecord(moment?.where); const label = asString(where?.privateLabel); const day = asString(when?.start); return label && day ? [{ label, day, id: record.id }] : [];
  });
  const calendarByDay = new Map<string, CalendarEvent[]>();
  for (const event of calendar) { const day = isoPrefix(event.startsWhen); if (day) calendarByDay.set(day, [...(calendarByDay.get(day) ?? []), event]); }
  const momentsByDay = new Map<string, MomentPlace[]>();
  for (const moment of moments) { const day = isoPrefix(moment.day); if (day) momentsByDay.set(day, [...(momentsByDay.get(day) ?? []), moment]); }
  const mapGrid = new Map<string, SavedPlace[]>();
  const gridKey = (latitude: number, longitude: number) => `${Math.floor(latitude * 20)}:${Math.floor(longitude * 20)}`;
  for (const place of maps) if (typeof place.latitude === "number" && typeof place.longitude === "number") { const key = gridKey(place.latitude, place.longitude); mapGrid.set(key, [...(mapGrid.get(key) ?? []), place]); }
  const readings: AtlasPlaceReading[] = [];
  let timelineWindows = 0; let windowsWithCandidates = 0; let directTimelineLabels = 0;
  let index = 0;
  for (const rawWindow of rawWindows) {
    const window = timelineWindow(rawWindow); if (!window) continue;
    timelineWindows += 1;
    const candidates: AtlasPlaceCandidate[] = [];
    const directLabels = window.kind === "visit" ? [window.locationLabel] : [window.startLocationLabel, window.endLocationLabel];
    if (directLabels.some(Boolean)) directTimelineLabels += 1;
    for (const label of directLabels) if (label) candidates.push({ label, sourceRecordId: timelineRecord?.id ?? "import:google-timeline:v1", evidence: "timeline-label", score: 80, reason: "Google Timeline named this place for the recorded window." });
    const radius = Math.max(150, Math.min(2_000, (window.accuracyMeters ?? 100) + 100));
    const nearbyMaps: SavedPlace[] = typeof window.latitude === "number" && typeof window.longitude === "number" ? [-1, 0, 1].flatMap((latitudeOffset) => [-1, 0, 1].flatMap((longitudeOffset) => mapGrid.get(gridKey(window.latitude! + latitudeOffset / 20, window.longitude! + longitudeOffset / 20)) ?? [])) : [];
    for (const place of nearbyMaps) { const distance = distanceMeters(window, place); if (distance !== undefined && distance <= radius) candidates.push({ label: place.label!, sourceRecordId: place.sourceRecordId, evidence: "nearby-saved-place", score: Math.round(70 - Math.min(20, distance / 20)), reason: `A saved Maps place is ${Math.round(distance)} m from this Timeline position.` }); }
    const start = timestamp(window.startAt); const end = timestamp(window.endAt) ?? start; const day = isoPrefix(window.startAt ?? window.endAt);
    for (const event of day ? calendarByDay.get(day) ?? [] : []) { const eventStart = timestamp(event.startsWhen); const eventEnd = timestamp(event.endsWhen) ?? eventStart; const overlaps = start !== undefined && eventStart !== undefined && Math.max(start, eventStart) <= Math.min(end ?? start, eventEnd ?? eventStart); const label = event.location ?? event.title; if (label) candidates.push({ label, sourceRecordId: event.sourceRecordId, evidence: "same-time-calendar", score: overlaps ? 75 : 58, reason: overlaps ? "A Calendar event with this place overlaps the Timeline window." : "A Calendar event names this place on the same day." }); }
    for (const moment of day ? momentsByDay.get(day) ?? [] : []) candidates.push({ label: moment.label, sourceRecordId: moment.id, evidence: "same-day-moment", score: 72, reason: "A private Storywalker Moment names this place on the same day." });
    const unique = [...new Map(candidates.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).map((candidate) => [`${candidate.label.toLocaleLowerCase()}|${candidate.sourceRecordId}`, candidate])).values()].slice(0, 4);
    if (unique.length) { windowsWithCandidates += 1; readings.push({ id: `timeline-window:${index}`, when: window.startAt ?? window.endAt ?? "time unknown", kind: window.kind, candidates: unique, resolution: unique.length === 1 ? "one-candidate" : "competing-candidates", caveat: "These are ranked source links, not a confirmed venue, city, country, visit, or explanation." }); readings.sort((a, b) => b.when.localeCompare(a.when)); readings.length = Math.min(readings.length, 12); }
    index += 1;
  }
  return { placeReadings: readings, placeCoverage: { timelineWindows, windowsWithCandidates, directTimelineLabels } };
}

/** Atlas is a local navigation aid. It shows source changes, explicit overlap
 * across evidence layers, and decisions that still belong to the Author. */
export function buildAtlasNow(records: VaultRecord[], derivedAt = new Date().toISOString(), previous?: AtlasNow, options?: AtlasBuildOptions): AtlasNow {
  // An Atlas reading may use private evidence and working Threads, but it must
  // never feed a Scenario Studio constellation or public draft back into its
  // own evidence lanes. That would make saved planning text look like new
  // source evidence and destabilise lane selections on reload.
  const source = records.filter((record) => record.kind !== "recovery-document" && record.kind !== "retrieval-index" && record.kind !== "atlas" && record.kind !== "scenario-studio" && record.kind !== "public-draft");
  const imports = importRecords(source);
  const lanes = laneDefinitions.map((definition) => {
    const matched = source.flatMap((record) => { const text = recordText(record); const matchedTerms = definition.terms.filter((term) => text.includes(term)); const source = payload(record).source; const sourceMatched = typeof source === "string" && (definition.sources?.includes(source) ?? false); return matchedTerms.length || sourceMatched ? [{ record, matchedTerms: sourceMatched ? [...matchedTerms, "selected Maps list"] : matchedTerms }] : []; });
    return { id: definition.id, title: definition.title, evidenceCount: matched.length, sourceRecordIds: matched.map(({ record }) => record.id).slice(0, 12), matchedTerms: [...new Set(matched.flatMap(({ matchedTerms }) => matchedTerms))], status: "evidence-window" as const, note: matched.length ? "Matched by explicit wording or source type; inspect the sources before drawing a connection." : "No current explicit match. This is absence from the selected record set, not absence from your life." };
  });
  const workingThreads = source.filter((record) => record.kind === "thread").map((record) => {
    const references = payload(record).sourceRecordIds;
    const sourceRecordIds = Array.isArray(references) ? references.filter((value): value is string => typeof value === "string") : [];
    return { id: `thread:${record.id}`, title: titleFor(record), evidenceCount: sourceRecordIds.length, sourceRecordIds, matchedTerms: [], status: "working-thread" as const, note: "An existing private working Thread. It remains revisable and is not an Episode or public claim." };
  });
  // Derived views refresh after an import, but only opening Atlas should
  // acknowledge that the Author has seen a change. This preserves a useful
  // delta instead of letting an automatic rebuild consume it invisibly.
  const acknowledgedImports = Array.isArray(previous?.acknowledgedImports) ? previous.acknowledgedImports : Array.isArray(previous?.imports) ? previous.imports : [];
  const prior = new Map(acknowledgedImports.map((item) => [item.id, item]));
  const importChanges = imports.flatMap((item) => {
    const before = prior.get(item.id);
    if (!before) return [{ id: `new:${item.id}`, title: `New source: ${item.source}`, detail: `${item.retained} minimised source row${item.retained === 1 ? "" : "s"} are now available to Atlas.`, sourceRecordIds: [item.id] }];
    if (before.retained !== item.retained) return [{ id: `changed:${item.id}`, title: `Updated source: ${item.source}`, detail: `The retained row count changed from ${before.retained} to ${item.retained}.`, sourceRecordIds: [item.id] }];
    if (before.importedAt !== item.importedAt) return [{ id: `refreshed:${item.id}`, title: `Refreshed source: ${item.source}`, detail: `${item.retained} minimised row${item.retained === 1 ? "" : "s"}; no count change was detected.`, sourceRecordIds: [item.id] }];
    return [];
  });
  const acknowledgedSourceIds = new Set(Array.isArray(previous?.acknowledgedSourceIds) ? previous.acknowledgedSourceIds : []);
  const privateSourceChanges = source.filter((record) => !acknowledgedSourceIds.has(record.id)).flatMap((record) => sourceChange(record) ?? []);
  const whatChanged = [...privateSourceChanges, ...importChanges].slice(0, 8);
  const convergences = lanes.flatMap((lane) => {
    const matched = source.filter((record) => lane.sourceRecordIds.includes(record.id)); const evidenceLayers = [...new Set(matched.map(recordLayer))];
    return evidenceLayers.length >= 2 ? [{ id: `convergence:${lane.id}`, title: lane.title, detail: `Explicit wording appears across ${evidenceLayers.length} evidence layers. This is a retrieval overlap, not evidence of causality or a required narrative.`, evidenceLayers, sourceRecordIds: lane.sourceRecordIds }] : [];
  }).slice(0, 6);
  const pending = source.filter((record) => record.kind === "journey-proposal" || payload(record).reviewStatus === "pending");
  const needsYou: AtlasNeed[] = [];
  const proposals = pending.filter((record) => record.kind === "journey-proposal");
  if (proposals.length) needsYou.push({ id: "pending-journey-proposals", title: "Pending journey proposal", detail: `${proposals.length} proposal${proposals.length === 1 ? " is" : "s are"} still editorial, awaiting your decision.`, sourceRecordIds: proposals.map((record) => record.id).slice(0, 8) });
  const timeline = imports.find((item) => item.source === "google-timeline");
  if (timeline) needsYou.push({ id: "timeline-review", title: "Timeline is evidence, not truth", detail: `${timeline.retained} platform-recorded stop or movement window${timeline.retained === 1 ? " is" : "s are"} available for correction or curation before any narrative use.`, sourceRecordIds: [timeline.id] });
  const captures = pending.filter((record) => record.kind === "capture");
  if (captures.length) needsYou.push({ id: "pending-captures", title: "Private captures awaiting a reading", detail: `${captures.length} capture${captures.length === 1 ? " is" : "s are"} still pending—useful material, but not a task unless you want to work with it.`, sourceRecordIds: captures.map((record) => record.id).slice(0, 8) });
  const places = buildPlaceReadings(source, options);
  return { schemaVersion: 3, kind: "storywalker-atlas-now", privacy: "private", canonical: false, derivedAt, method: "explicit-keyword-record-layer-and-delta-v3", sourceRecordCount: source.length, imports, lanes: [...lanes, ...workingThreads], whatChanged, convergences, needsYou, ...places, caveat: "Atlas shows explicit source changes, wording overlaps and decisions that remain yours. Place readings rank labels already present in private sources; they do not reverse-geocode, infer a visit, causality, feelings or a single narrative, and they do not create canon." };
}
