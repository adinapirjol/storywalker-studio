import { z } from "zod";

const offset = z.string().datetime({ offset: true });

export const minimisedSpotifyHistorySchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal("spotify-extended-streaming-history"),
  importedAt: offset,
  records: z.array(z.object({
    endedAt: offset,
    timezoneInterpretation: z.string().min(1),
    spotifyTrackUri: z.string().startsWith("spotify:track:").optional(),
    trackName: z.string().min(1).optional(),
    artistName: z.string().min(1).optional(),
    albumName: z.string().min(1).optional(),
    durationMs: z.number().int().nonnegative(),
    skipped: z.boolean().optional(),
    offline: z.boolean().optional(),
    importerProvenance: z.string(),
  })),
});

export const minimisedTimelineSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal("google-timeline"),
  importedAt: offset,
  schemaEncountered: z.string().min(1),
  records: z.array(z.object({
    kind: z.enum(["visit", "route"]),
    startAt: offset.optional(),
    endAt: offset.optional(),
    locationLabel: z.string().min(1).optional(),
    startLocationLabel: z.string().min(1).optional(),
    endLocationLabel: z.string().min(1).optional(),
    travelMode: z.string().min(1).max(120).optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    accuracyMeters: z.number().nonnegative().optional(),
    certainty: z.enum(["reported", "platform-inferred", "unknown"]),
    authorCorrected: z.boolean(),
  })),
});

export const minimisedLastFmHistorySchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal("lastfm-scrobbles"),
  importedAt: offset,
  records: z.array(z.object({
    playedAt: offset,
    trackName: z.string().min(1),
    artistName: z.string().min(1),
    albumName: z.string().min(1).optional(),
    importerProvenance: z.string(),
  })),
});

export const minimisedGoogleCalendarSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal("google-calendar-takeout"),
  importedAt: offset,
  records: z.array(z.object({
    startsWhen: z.string().min(1),
    endsWhen: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    location: z.string().min(1).max(2_000).optional(),
    description: z.string().min(1).max(12_000).optional(),
    allDay: z.boolean(),
    timeInterpretation: z.enum(["date-only", "utc", "local-with-declared-timezone", "local-timezone-unknown"]),
    importerProvenance: z.string(),
  })),
});

export const minimisedGoogleMapsSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal("google-maps-takeout"),
  importedAt: offset,
  records: z.array(z.object({
    kind: z.literal("labeled-place"),
    label: z.string().min(1).max(500),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    importerProvenance: z.string(),
  })),
});

export const minimisedYouTubeHistorySchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal("youtube-watch-history"),
  importedAt: offset,
  records: z.array(z.object({
    watchedWhen: z.string().min(1).max(400),
    watchedAt: offset.optional(),
    title: z.string().min(1).max(1_000),
    channel: z.string().min(1).max(500).optional(),
    importerProvenance: z.string(),
  })),
});

export const minimisedEchoesExportSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal("echoes-export"),
  importedAt: offset,
  schemaEncountered: z.string().min(1),
  records: z.array(z.object({
    kind: z.enum(["walk", "echo", "element", "unknown"]),
    title: z.string().min(1).max(500),
    description: z.string().min(1).max(12_000).optional(),
    createdAt: offset.optional(),
    updatedAt: offset.optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    importerProvenance: z.string(),
  })),
});

export type ImportSummary = { schemaEncountered: string; total: number; retained: number; discardedFields: string[]; warnings: string[] };

function isoWithOffset(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return undefined;
  return date.toISOString();
}

export function minimiseSpotifyHistory(raw: unknown, importedAt = new Date().toISOString()): { document: z.infer<typeof minimisedSpotifyHistorySchema>; summary: ImportSummary } {
  const rows = Array.isArray(raw) ? raw : Array.isArray((raw as { records?: unknown[] })?.records) ? (raw as { records: unknown[] }).records : [];
  const records = rows.flatMap((rawRow) => {
    const row = rawRow as Record<string, unknown>;
    const endedAt = isoWithOffset(row.ts ?? row.endTime ?? row.end_time);
    const duration = Number(row.ms_played ?? row.msPlayed ?? row.durationMs ?? 0);
    if (!endedAt || !Number.isFinite(duration) || duration < 0) return [];
    const uri = row.spotify_track_uri ?? row.spotifyTrackUri;
    return [{ endedAt, timezoneInterpretation: "UTC normalised from export timestamp; original offset may be absent.", ...(typeof uri === "string" && uri.startsWith("spotify:track:") ? { spotifyTrackUri: uri } : {}), ...(typeof row.master_metadata_track_name === "string" ? { trackName: row.master_metadata_track_name } : typeof row.trackName === "string" ? { trackName: row.trackName } : {}), ...(typeof row.master_metadata_album_artist_name === "string" ? { artistName: row.master_metadata_album_artist_name } : typeof row.artistName === "string" ? { artistName: row.artistName } : {}), ...(typeof row.master_metadata_album_album_name === "string" ? { albumName: row.master_metadata_album_album_name } : typeof row.albumName === "string" ? { albumName: row.albumName } : {}), durationMs: Math.round(duration), ...(typeof row.skipped === "boolean" ? { skipped: row.skipped } : {}), ...(typeof row.offline === "boolean" ? { offline: row.offline } : {}), importerProvenance: "spotify-extended-streaming-history minimiser v1" }];
  });
  return { document: minimisedSpotifyHistorySchema.parse({ schemaVersion: 1, source: "spotify-extended-streaming-history", importedAt, records }), summary: { schemaEncountered: Array.isArray(raw) ? "array" : "object.records-or-unknown", total: rows.length, retained: records.length, discardedFields: ["ip_addr", "username", "user_agent", "platform", "conn_country", "device details", "location fields"], warnings: records.length === 0 ? ["No valid playback rows found; verify the export shape."] : [] } };
}

/** Last.fm's `recenttracks` response can include a currently-playing row without
 * a timestamp. That row is deliberately discarded: this importer keeps only a
 * completed, timestamped scrobble and never retains profile URLs or images. */
export function minimiseLastFmHistory(raw: unknown, importedAt = new Date().toISOString()): { document: z.infer<typeof minimisedLastFmHistorySchema>; summary: ImportSummary } {
  const root = raw as { recenttracks?: { track?: unknown } };
  const tracks = Array.isArray(root?.recenttracks?.track) ? root.recenttracks.track : [];
  const seenScrobbles = new Set<string>(); let duplicateRows = 0;
  const records = tracks.flatMap((rawTrack) => {
    const track = rawTrack as Record<string, unknown>;
    const date = track.date as Record<string, unknown> | undefined;
    const uts = typeof date?.uts === "string" || typeof date?.uts === "number" ? Number(date.uts) : Number.NaN;
    const playedAt = Number.isFinite(uts) && uts > 0 ? new Date(uts * 1_000).toISOString() : undefined;
    const artist = track.artist as Record<string, unknown> | undefined;
    const album = track.album as Record<string, unknown> | undefined;
    const trackName = typeof track.name === "string" ? track.name.trim() : "";
    const artistName = typeof artist?.["#text"] === "string" ? artist["#text"].trim() : "";
    const albumName = typeof album?.["#text"] === "string" ? album["#text"].trim() : "";
    if (!playedAt || !trackName || !artistName) return [];
    const fingerprint = JSON.stringify([playedAt, trackName, artistName, albumName]);
    if (seenScrobbles.has(fingerprint)) { duplicateRows += 1; return []; }
    seenScrobbles.add(fingerprint);
    return [{ playedAt, trackName, artistName, ...(albumName ? { albumName } : {}), importerProvenance: "lastfm-user.getrecenttracks minimiser v1" }];
  });
  return {
    document: minimisedLastFmHistorySchema.parse({ schemaVersion: 1, source: "lastfm-scrobbles", importedAt, records }),
    summary: {
      schemaEncountered: "lastfm.recenttracks.track",
      total: tracks.length,
      retained: records.length,
      discardedFields: ["profile identity", "track URLs", "artist URLs", "album images", "now-playing row", "Last.fm internal IDs", "duplicate scrobble rows"],
      warnings: records.length === 0 ? ["No timestamped Last.fm scrobbles were returned for this time window."] : ["Scrobbles establish listening time, not why a track mattered.", ...(duplicateRows ? [`${duplicateRows} duplicate timestamped row(s) were omitted.`] : [])],
    },
  };
}

function unfoldedIcsLines(content: string) { return content.replace(/\r\n[ \t]|\n[ \t]/gu, "").split(/\r?\n/u); }
function calendarValue(line: string) { const separator = line.indexOf(":"); return separator >= 0 ? line.slice(separator + 1).trim() : ""; }
function unescapeCalendarText(value: string) { return value.replace(/\\n/giu, "\n").replace(/\\([,;\\])/gu, "$1").trim(); }
function calendarTime(line: string | undefined) {
  if (!line) return undefined;
  const value = calendarValue(line); const parameter = line.match(/(?:^|;)TZID=([^;:]+)/u)?.[1];
  if (/^\d{8}$/u.test(value)) return { value: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`, allDay: true, timeInterpretation: "date-only" as const };
  if (/^\d{8}T\d{6}Z$/u.test(value)) return { value: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`, allDay: false, timeInterpretation: "utc" as const };
  if (/^\d{8}T\d{6}$/u.test(value)) return { value: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}${parameter ? `[${parameter}]` : ""}`, allDay: false, timeInterpretation: parameter ? "local-with-declared-timezone" as const : "local-timezone-unknown" as const };
  return undefined;
}

/** Calendar Takeout minimisation retains title, temporal bounds and the
 * Author-requested location/description fields. Invitees, organisers, URLs,
 * IDs, recurrence metadata and alarms stay outside the Vault. */
export function minimiseGoogleCalendarIcs(contents: string[], importedAt = new Date().toISOString()): { document: z.infer<typeof minimisedGoogleCalendarSchema>; summary: ImportSummary } {
  const records = contents.flatMap((content) => {
    const events: Array<Record<string, string>> = []; let current: Record<string, string> | undefined;
    for (const line of unfoldedIcsLines(content)) {
      if (line === "BEGIN:VEVENT") { current = {}; continue; }
      if (line === "END:VEVENT") { if (current) events.push(current); current = undefined; continue; }
      if (!current) continue;
      const key = line.split(/[;:]/u, 1)[0]; if (["DTSTART", "DTEND", "SUMMARY", "LOCATION", "DESCRIPTION"].includes(key)) current[key] = line;
    }
    return events.flatMap((event) => {
      const start = calendarTime(event.DTSTART); if (!start) return [];
      const end = calendarTime(event.DTEND);
      const title = event.SUMMARY ? unescapeCalendarText(calendarValue(event.SUMMARY)) : "";
      const location = event.LOCATION ? unescapeCalendarText(calendarValue(event.LOCATION)).slice(0, 2_000) : "";
      const description = event.DESCRIPTION ? unescapeCalendarText(calendarValue(event.DESCRIPTION)).slice(0, 12_000) : "";
      return [{ startsWhen: start.value, ...(end ? { endsWhen: end.value } : {}), ...(title ? { title } : {}), ...(location ? { location } : {}), ...(description ? { description } : {}), allDay: start.allDay, timeInterpretation: start.timeInterpretation, importerProvenance: "google-calendar-takeout minimiser v2" }];
    });
  });
  return {
    document: minimisedGoogleCalendarSchema.parse({ schemaVersion: 1, source: "google-calendar-takeout", importedAt, records }),
    summary: { schemaEncountered: "iCalendar VEVENT", total: records.length, retained: records.length, discardedFields: ["attendees", "organisers", "URLs", "calendar IDs", "alarms", "recurrence metadata"], warnings: ["Calendar titles, locations and descriptions are source-recorded scheduling data, not proof that an event happened or what it meant."] },
  };
}

function finiteCoordinate(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : undefined; }

/** The selected Maps export currently exposes labelled places, not Timeline.
 * It deliberately keeps the label and point only; Google URLs, list IDs and
 * other account metadata are discarded. */
export function minimiseGoogleMapsLabeledPlaces(raw: unknown, importedAt = new Date().toISOString()): { document: z.infer<typeof minimisedGoogleMapsSchema>; summary: ImportSummary } {
  const root = raw as { features?: unknown };
  const features = Array.isArray(root?.features) ? root.features : [];
  const records = features.flatMap((rawFeature) => {
    const feature = rawFeature as { properties?: { name?: unknown }; geometry?: { type?: unknown; coordinates?: unknown } };
    const label = typeof feature.properties?.name === "string" ? feature.properties.name.trim().slice(0, 500) : "";
    const coordinates = Array.isArray(feature.geometry?.coordinates) ? feature.geometry?.coordinates : [];
    const longitude = finiteCoordinate(coordinates?.[0]); const latitude = finiteCoordinate(coordinates?.[1]);
    if (!label) return [];
    return [{ kind: "labeled-place" as const, label, ...(latitude !== undefined && longitude !== undefined && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 ? { latitude, longitude } : {}), importerProvenance: "google-maps-takeout labeled-places minimiser v1" }];
  });
  return { document: minimisedGoogleMapsSchema.parse({ schemaVersion: 1, source: "google-maps-takeout", importedAt, records }), summary: { schemaEncountered: "GeoJSON FeatureCollection", total: features.length, retained: records.length, discardedFields: ["Google URLs", "list IDs", "account metadata", "photos", "reviews", "automated answers"], warnings: ["Labeled places establish a saved place, not a visit, route, or meaning."] } };
}

function decodeHtml(value: string) { return value.replace(/<[^>]*>/gu, " ").replace(/&amp;/gu, "&").replace(/&quot;/gu, '"').replace(/&#39;|&apos;/gu, "'").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/\s+/gu, " ").trim(); }
function dateFromTakeoutLabel(value: string) { const parsed = Date.parse(value); return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString(); }

/** Reads a Google Takeout watch-history HTML file locally. URLs and video IDs
 * never enter the minimised record. The text date is retained even when the
 * user's locale prevents a reliable normalisation. */
export function minimiseYouTubeWatchHistoryHtml(html: string, importedAt = new Date().toISOString()): { document: z.infer<typeof minimisedYouTubeHistorySchema>; summary: ImportSummary } {
  const cells = html.match(/<div class="content-cell[^"]*">[\s\S]*?<\/div>/gu) ?? [];
  const records = cells.flatMap((cell) => {
    const anchors = [...cell.matchAll(/<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gu)];
    const video = anchors.find((anchor) => /(?:youtube\.com\/watch|youtu\.be\/)/u.test(anchor[1]));
    if (!video) return [];
    const title = decodeHtml(video[2]).slice(0, 1_000); if (!title) return [];
    const channel = anchors.find((anchor) => anchor !== video)?.[2];
    const withoutAnchors = decodeHtml(cell.replace(/<a\s+href="[^"]*"[^>]*>[\s\S]*?<\/a>/gu, " "));
    const watchedWhen = withoutAnchors.replace(/^Watched\s+/iu, "").slice(0, 400) || "Takeout timestamp unavailable";
    const watchedAt = dateFromTakeoutLabel(watchedWhen);
    return [{ watchedWhen, ...(watchedAt ? { watchedAt } : {}), title, ...(channel ? { channel: decodeHtml(channel).slice(0, 500) } : {}), importerProvenance: "youtube-takeout watch-history minimiser v1" }];
  });
  return { document: minimisedYouTubeHistorySchema.parse({ schemaVersion: 1, source: "youtube-watch-history", importedAt, records }), summary: { schemaEncountered: "Google Takeout watch-history HTML", total: cells.length, retained: records.length, discardedFields: ["video URLs", "video IDs", "search history", "device metadata", "account identifiers"], warnings: ["Watch history establishes that a video was recorded as watched, not attention, learning, or meaning."] } };
}

function asRecordArray(raw: unknown) { const root = raw as Record<string, unknown>; if (Array.isArray(raw)) return { schema: "array", rows: raw }; for (const key of ["walks", "echoes", "elements", "experiences", "features", "data"]) { if (Array.isArray(root?.[key])) return { schema: `object.${key}`, rows: root[key] as unknown[] }; } return { schema: "unknown", rows: [] as unknown[] }; }
function echoCoordinates(row: Record<string, unknown>) { const geometry = row.geometry as { coordinates?: unknown } | undefined; const location = row.location as Record<string, unknown> | undefined; const coordinates = Array.isArray(geometry?.coordinates) ? geometry.coordinates : Array.isArray(location?.coordinates) ? location.coordinates : [];
  const longitude = finiteCoordinate(coordinates[0] ?? row.longitude ?? row.lng); const latitude = finiteCoordinate(coordinates[1] ?? row.latitude ?? row.lat);
  return latitude !== undefined && longitude !== undefined && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 ? { latitude, longitude } : {};
}

/** A format-tolerant, local-only adapter for an Author-exported ECHOES file.
 * ECHOES documents creation around walks, echoes and elements but do not expose
 * a documented account-export API, so this never scrapes a signed-in account. */
export function minimiseEchoesExport(raw: unknown, importedAt = new Date().toISOString()): { document: z.infer<typeof minimisedEchoesExportSchema>; summary: ImportSummary } {
  const { schema, rows } = asRecordArray(raw);
  const records = rows.flatMap((value) => {
    const row = value as Record<string, unknown>; const title = [row.title, row.name, row.label].find((item) => typeof item === "string") as string | undefined;
    if (!title?.trim()) return [];
    const kind = ["walk", "echo", "element"].includes(String(row.kind ?? row.type).toLowerCase()) ? String(row.kind ?? row.type).toLowerCase() as "walk" | "echo" | "element" : "unknown" as const;
    const description = [row.description, row.summary, row.text].find((item) => typeof item === "string") as string | undefined;
    const createdAt = isoWithOffset(row.createdAt ?? row.created_at); const updatedAt = isoWithOffset(row.updatedAt ?? row.updated_at);
    return [{ kind, title: title.trim().slice(0, 500), ...(description?.trim() ? { description: description.trim().slice(0, 12_000) } : {}), ...(createdAt ? { createdAt } : {}), ...(updatedAt ? { updatedAt } : {}), ...echoCoordinates(row), importerProvenance: "echoes-export local minimiser v1" }];
  });
  return { document: minimisedEchoesExportSchema.parse({ schemaVersion: 1, source: "echoes-export", importedAt, schemaEncountered: schema, records }), summary: { schemaEncountered: schema, total: rows.length, retained: records.length, discardedFields: ["account credentials", "web URLs", "media binaries", "analytics", "unrecognised export fields"], warnings: schema === "unknown" ? ["No supported ECHOES record array was found. Export a JSON array or an object containing walks, echoes, elements, experiences, features, or data."] : ["ECHOES records are source material. Place/time proximity does not establish meaning or an autobiographical event."] } };
}

function coordinate(value: unknown) {
  if (typeof value === "string") {
    const match = value.match(/^geo:([-+]?\d+(?:\.\d+)?),([-+]?\d+(?:\.\d+)?)/iu);
    if (!match) return {};
    const latitude = Number(match[1]); const longitude = Number(match[2]);
    return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 ? { latitude, longitude } : {};
  }
  const row = value as Record<string, unknown> | undefined;
  const latitudeE7 = Number(row?.latitudeE7); const longitudeE7 = Number(row?.longitudeE7);
  const latitude = Number.isFinite(latitudeE7) ? latitudeE7 / 1e7 : Number(row?.latitude ?? row?.lat);
  const longitude = Number.isFinite(longitudeE7) ? longitudeE7 / 1e7 : Number(row?.longitude ?? row?.lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 ? { latitude, longitude } : {};
}

function locationLabel(value: unknown) {
  const location = value as Record<string, unknown> | undefined;
  const label = [location?.name, location?.address, location?.label].find((item) => typeof item === "string" && item.trim()) as string | undefined;
  return label?.trim().slice(0, 1_000);
}

export function inspectAndMinimiseTimeline(raw: unknown, importedAt = new Date().toISOString()): { document: z.infer<typeof minimisedTimelineSchema>; summary: ImportSummary } {
  if (Array.isArray(raw)) {
    const onDeviceEntries = raw.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item) && ("visit" in item || "activity" in item || "timelinePath" in item || "timelineMemory" in item));
    if (onDeviceEntries.length) return minimiseOnDeviceTimeline(onDeviceEntries, importedAt);
    const imports = raw.map((source) => inspectAndMinimiseTimeline(source, importedAt));
    const schemaEncountered = [...new Set(imports.map((item) => item.summary.schemaEncountered))].join(", ");
    const records = imports.flatMap((item) => item.document.records);
    const warnings = [...new Set(imports.flatMap((item) => item.summary.warnings))];
    return {
      document: minimisedTimelineSchema.parse({ schemaVersion: 1, source: "google-timeline", importedAt, schemaEncountered: `multiple files: ${schemaEncountered}`, records }),
      summary: {
        schemaEncountered: `multiple files: ${schemaEncountered}`,
        total: imports.reduce((total, item) => total + item.summary.total, 0),
        retained: records.length,
        discardedFields: ["raw route points", "device identifiers", "place confidence details not needed", "unselected locations"],
        warnings,
      },
    };
  }
  const root = raw as Record<string, unknown>;
  const timelineObjects = Array.isArray(root?.timelineObjects) ? root.timelineObjects : [];
  const semanticSegments = Array.isArray(root?.semanticSegments) ? root.semanticSegments : [];
  const source = timelineObjects.length ? timelineObjects : semanticSegments;
  const schemaEncountered = timelineObjects.length ? "timelineObjects" : semanticSegments.length ? "semanticSegments" : "unknown";
  const records = source.flatMap((item) => {
    const object = item as Record<string, unknown>;
    const visit = (object.placeVisit ?? object.visit) as Record<string, unknown> | undefined;
    const route = (object.activitySegment ?? object.activity ?? object.timelinePath ?? object.route) as Record<string, unknown> | undefined;
    const candidate = visit ?? route; if (!candidate) return [];
    const location = candidate.location ?? candidate.placeLocation ?? candidate.startLocation ?? candidate.start;
    const startLocation = candidate.startLocation ?? candidate.start ?? candidate.from;
    const endLocation = candidate.endLocation ?? candidate.end ?? candidate.to;
    const duration = candidate.duration as Record<string, unknown> | undefined;
    const accuracyLocation = location as Record<string, unknown> | undefined;
    const accuracy = Number(accuracyLocation?.accuracy ?? accuracyLocation?.accuracyMeters ?? candidate.accuracyMeters);
    const label = locationLabel(location);
    const startLabel = locationLabel(startLocation);
    const endLabel = locationLabel(endLocation);
    const travelMode = [candidate.activityType, (candidate.topCandidate as Record<string, unknown> | undefined)?.type, (candidate.topCandidate as Record<string, unknown> | undefined)?.activityType].find((value) => typeof value === "string" && value.trim()) as string | undefined;
    const startAt = isoWithOffset(duration?.startTimestamp ?? candidate.startTime ?? object.startTime);
    const endAt = isoWithOffset(duration?.endTimestamp ?? candidate.endTime ?? object.endTime);
    return [{ kind: visit ? "visit" : "route", ...(startAt ? { startAt } : {}), ...(endAt ? { endAt } : {}), ...(label ? { locationLabel: label } : {}), ...(!visit && startLabel ? { startLocationLabel: startLabel } : {}), ...(!visit && endLabel ? { endLocationLabel: endLabel } : {}), ...(!visit && travelMode ? { travelMode: travelMode.trim().slice(0, 120) } : {}), ...coordinate(location), ...(Number.isFinite(accuracy) && accuracy >= 0 ? { accuracyMeters: accuracy } : {}), certainty: visit ? "platform-inferred" : "reported", authorCorrected: false }];
  });
  return { document: minimisedTimelineSchema.parse({ schemaVersion: 1, source: "google-timeline", importedAt, schemaEncountered, records }), summary: { schemaEncountered, total: source.length, retained: records.length, discardedFields: ["raw route points", "device identifiers", "place confidence details not needed", "unselected locations"], warnings: schemaEncountered === "unknown" ? ["No readable Google Timeline stops or movement windows were found. Settings and encrypted backups are not location history and were not imported."] : ["Platform-inferred visits and routes are not autobiographical truth; correct or curate before use."] } };
}

/** Google Maps on iOS exports its on-device Timeline as one JSON array. Keep
 * visit/activity windows only; its point-by-point paths and auto-generated
 * memories are deliberately not copied into the private derivative. */
function minimiseOnDeviceTimeline(entries: Record<string, unknown>[], importedAt: string): { document: z.infer<typeof minimisedTimelineSchema>; summary: ImportSummary } {
  const records = entries.flatMap((object) => {
    const visit = object.visit as Record<string, unknown> | undefined;
    const activity = object.activity as Record<string, unknown> | undefined;
    if (!visit && !activity) return [];
    const candidate = visit ?? activity!;
    const topCandidate = candidate.topCandidate as Record<string, unknown> | undefined;
    const location = visit ? candidate.location ?? candidate.placeLocation ?? topCandidate?.placeLocation : candidate.startLocation ?? candidate.start;
    const startLocation = activity?.startLocation ?? activity?.start;
    const endLocation = activity?.endLocation ?? activity?.end;
    const startAt = isoWithOffset(object.startTime);
    const endAt = isoWithOffset(object.endTime);
    const travelMode = topCandidate?.type;
    return [{
      kind: visit ? "visit" as const : "route" as const,
      ...(startAt ? { startAt } : {}),
      ...(endAt ? { endAt } : {}),
      ...(visit && locationLabel(location) ? { locationLabel: locationLabel(location) } : {}),
      ...(!visit && locationLabel(startLocation) ? { startLocationLabel: locationLabel(startLocation) } : {}),
      ...(!visit && locationLabel(endLocation) ? { endLocationLabel: locationLabel(endLocation) } : {}),
      ...(!visit && typeof travelMode === "string" && travelMode.trim() ? { travelMode: travelMode.trim().slice(0, 120) } : {}),
      ...coordinate(location),
      certainty: "platform-inferred" as const,
      authorCorrected: false,
    }];
  });
  const discardedPaths = entries.filter((entry) => Array.isArray(entry.timelinePath)).length;
  const discardedMemories = entries.filter((entry) => entry.timelineMemory && typeof entry.timelineMemory === "object").length;
  return {
    document: minimisedTimelineSchema.parse({ schemaVersion: 1, source: "google-timeline", importedAt, schemaEncountered: "ios-on-device-timeline-array", records }),
    summary: {
      schemaEncountered: "ios-on-device-timeline-array",
      total: entries.length,
      retained: records.length,
      discardedFields: ["raw route points", "Google place IDs", "place/activity probabilities", "visit hierarchy", "distance estimates", "automated Timeline memories"],
      warnings: ["Platform-inferred visits and routes are not autobiographical truth; correct or curate before use.", ...(discardedPaths ? [`${discardedPaths} point-by-point Timeline path window(s) were omitted.`] : []), ...(discardedMemories ? [`${discardedMemories} automated Timeline memory item(s) were omitted.`] : [])],
    },
  };
}
