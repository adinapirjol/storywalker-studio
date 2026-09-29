import { z } from "zod";
import { minimisedLastFmHistorySchema, minimisedTimelineSchema } from "./private-ingest";
import { journeyEpisodeSchema, reconstructedTimingSchema, geographicReferenceSchema, type JourneyEpisode } from "./journey-episode";
import { xrSceneSchema, type XRScene } from "./xr-scene";

const dayMs = 86400000;
export const authorJourneyStopSchema = z.object({
  id: z.string().min(1), start: z.string().datetime({ offset: true }), end: z.string().datetime({ offset: true }),
  label: z.string().min(1), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
  statement: z.string().min(1), sourceId: z.string().min(1),
  timeZone: z.string().optional(), episodeKind: z.enum(["stay", "transit"]).optional(), reconstructedTiming: reconstructedTimingSchema.optional(), geographicReference: geographicReferenceSchema.optional(),
  sequence: z.number().int().nonnegative().optional(),
}).strict();
type Play = z.infer<typeof minimisedLastFmHistorySchema>["records"][number];
type Source = NonNullable<XRScene["journeyLayout"]>["sources"][number];
const iso = (ms: number) => new Date(ms).toISOString();
const cmp = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const keyOf = (play: Play, kind: "artist" | "track" | "album") => JSON.stringify(kind === "artist" ? [play.artistName] : [play.artistName, kind === "track" ? play.trackName : play.albumName ?? ""]);

/** Only point-in-visit overlap assigns a play. Routes and gaps never borrow a stop. */
export function groundJourney(sceneInput: XRScene, timelineInput: unknown, lastfmInput: unknown, options: {
  from: string; toExclusive: string; timelineToExclusive: string; timeZone: string;
  sources: Source[]; authorStops?: z.infer<typeof authorJourneyStopSchema>[];
}) {
  const scene = xrSceneSchema.parse(sceneInput);
  if (scene.journeyLayout) throw new Error("This scene is already grounded. Rebuilding requires a new reviewed revision.");
  const timeline = minimisedTimelineSchema.parse(timelineInput), lastfm = minimisedLastFmHistorySchema.parse(lastfmInput);
  const from = Date.parse(options.from), end = Date.parse(options.toExclusive), timelineEnd = Math.min(end, Date.parse(options.timelineToExclusive));
  if (![from, end, timelineEnd].every(Number.isFinite) || from >= timelineEnd || timelineEnd > end) throw new Error("Invalid journey interval");
  const timelineSource = options.sources.find(source => source.type === "timeline"), musicSource = options.sources.find(source => source.type === "lastfm");
  if (!timelineSource || !musicSource) throw new Error("Both independent source snapshots are required");
  const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: options.timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const day = (value: string) => dayFormatter.format(new Date(value));
  const seenVisits = new Set<string>(); let invalidVisits = 0, duplicateVisits = 0, excludedRoutes = 0;
  const episodes: JourneyEpisode[] = [];
  timeline.records.forEach((row, index) => {
    const start = Date.parse(row.startAt ?? ""), stop = Date.parse(row.endAt ?? "");
    if (Number.isFinite(start) && Number.isFinite(stop) && (stop <= from || start >= timelineEnd)) return;
    if (row.kind !== "visit") { excludedRoutes++; return; }
    if (!Number.isFinite(start) || !Number.isFinite(stop) || start >= stop || !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude) || Math.abs(row.latitude!) > 90 || Math.abs(row.longitude!) > 180) { invalidVisits++; return; }
    const key = JSON.stringify([start, stop, row.latitude, row.longitude]);
    if (seenVisits.has(key)) { duplicateVisits++; return; } seenVisits.add(key);
    const evidenceId = `timeline-row-${index}`;
    episodes.push(journeyEpisodeSchema.parse({
      id: evidenceId, start: iso(Math.max(start, from)), end: iso(Math.min(stop, timelineEnd)), timeZone: options.timeZone,
      label: row.locationLabel ?? "Unlabelled Timeline stop", routeOrder: 0,
      provenance: { nodes: [{ id: evidenceId, type: "timeline", sourceId: `${timelineSource.id}#records/${index}`, start: row.startAt, end: row.endAt, coordinates: { latitude: row.latitude, longitude: row.longitude }, certainty: row.certainty }], edges: [{ evidenceId, role: "physical-geography", basis: "source-record" }] },
    }));
  });
  for (const raw of options.authorStops ?? []) {
    const stop = authorJourneyStopSchema.parse(raw), start = Date.parse(stop.start), finish = Date.parse(stop.end);
    if (start >= finish || start < from || finish > end) throw new Error("Author stop must be inside the journey period");
    const evidenceId = `author:${stop.id}`;
    episodes.push(journeyEpisodeSchema.parse({ id: evidenceId, label: stop.label, start: stop.start, end: stop.end, routeOrder: stop.sequence ?? 0, timeZone: stop.timeZone ?? options.timeZone, episodeKind: stop.episodeKind, reconstructedTiming: stop.reconstructedTiming, geographicReference: stop.geographicReference, provenance: { nodes: [{ id: evidenceId, type: "author", sourceId: stop.sourceId, statement: stop.statement, confirmedGeography: { latitude: stop.latitude, longitude: stop.longitude } }], edges: [{ evidenceId, role: "physical-geography", basis: "author-confirmed" }] } }));
  }
  if (!episodes.length) throw new Error("No valid, dated geographic stops are available. Nothing was replaced.");
  episodes.sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || a.routeOrder - b.routeOrder || Date.parse(a.end) - Date.parse(b.end) || cmp(a.id, b.id));
  const points = episodes.map(episode => {
    const node = episode.provenance.nodes[0];
    return node.type === "timeline" ? node.coordinates : node.type === "author" ? node.confirmedGeography! : (() => { throw new Error("Invalid geographic source"); })();
  });
  // Unwrap at the largest empty longitude arc, preserving date-line neighbours.
  const longs = points.map(point => (point.longitude + 360) % 360).sort((a, b) => a - b);
  let largestGap = -1, arcStart = longs[0];
  longs.forEach((value, index) => { const next = longs[(index + 1) % longs.length] + (index === longs.length - 1 ? 360 : 0); if (next - value > largestGap) { largestGap = next - value; arcStart = next % 360; } });
  const unwrap = (longitude: number) => { const value = (longitude + 360) % 360; return value < arcStart ? value + 360 : value; };
  const latitudes = points.map(point => point.latitude), longitudes = points.map(point => unwrap(point.longitude));
  const originLatitude = (Math.min(...latitudes) + Math.max(...latitudes)) / 2, originLongitude = (Math.min(...longitudes) + Math.max(...longitudes)) / 2;
  const radians = Math.PI / 180, earthRadius = 6371008.8;
  const projected = points.map(point => ({ x: earthRadius * radians * (unwrap(point.longitude) - originLongitude) * Math.max(1e-6, Math.cos(originLatitude * radians)), z: -earthRadius * radians * (point.latitude - originLatitude) }));
  const width = Math.max(...projected.map(point => point.x)) - Math.min(...projected.map(point => point.x)), height = Math.max(...projected.map(point => point.z)) - Math.min(...projected.map(point => point.z));
  const metresPerUnit = Math.max(width, height, 1) / 36;
  episodes.forEach((episode, index) => {
    episode.routeOrder = index;
    const position = { x: projected[index].x / metresPerUnit, y: 0, z: projected[index].z / metresPerUnit };
    episode.worldPosition = { position, projection: "local-equirectangular-uniform-v1", evidenceIds: [episode.provenance.nodes[0].id] };
    episode.memoryPosition = { ...position };
  });
  const seenPlays = new Set<string>(); let duplicatePlays = 0;
  const plays = lastfm.records.filter(play => {
    const time = Date.parse(play.playedAt); if (time < from || time >= end) return false;
    const key = JSON.stringify([time, play.artistName, play.trackName, play.albumName ?? ""]);
    if (seenPlays.has(key)) { duplicatePlays++; return false; } seenPlays.add(key); return true;
  }).sort((a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt) || cmp(keyOf(a, "track"), keyOf(b, "track")));
  const byEpisode = episodes.map(() => [] as Play[]); let ambiguousPlays = 0, unmatchedPlays = 0;
  plays.forEach(play => {
    const at = Date.parse(play.playedAt), matches: number[] = [];
    episodes.forEach((episode, index) => { if (at >= Date.parse(episode.start) && at < Date.parse(episode.end)) matches.push(index); });
    const unique = matches.length === 1 ? episodes[matches[0]] : undefined;
    const assignable = unique && (!unique.reconstructedTiming || unique.reconstructedTiming.listeningWindows.some(window => at >= Date.parse(window.start) && at < Date.parse(window.end)));
    if (assignable) byEpisode[matches[0]].push(play); else if (matches.length) ambiguousPlays++; else unmatchedPlays++;
  });
  function counts(rows: Play[], kind: "artist" | "track" | "album") {
    const result = new Map<string, Play[]>();
    rows.forEach(play => { if (kind === "album" && !play.albumName) return; const key = keyOf(play, kind); const group = result.get(key) ?? []; group.push(play); result.set(key, group); }); return result;
  }
  const baseline = { artist: counts(plays, "artist"), track: counts(plays, "track"), album: counts(plays, "album") };
  function rank(rows: Play[], kind: "artist" | "track" | "album") {
    return [...counts(rows, kind)].map(([key, group]) => {
      const baselineShare = (baseline[kind].get(key)?.length ?? 0) / Math.max(1, plays.length), share = group.length / Math.max(1, rows.length);
      return { key, label: (JSON.parse(key) as string[]).join(" — "), count: group.length, activeDays: new Set(group.map(play => day(play.playedAt))).size, share, baselineShare, lift: baselineShare ? share / baselineShare : 0, first: group[0].playedAt, last: group.at(-1)!.playedAt };
    }).sort((a, b) => b.count - a.count || cmp(a.key, b.key));
  }
  const days = new Map<string, number>(); plays.forEach(play => { const value = day(play.playedAt); days.set(value, (days.get(value) ?? 0) + 1); });
  const dailyCounts = [...days.values()].sort((a, b) => a - b), burstThreshold = Math.max(10, dailyCounts[Math.max(0, Math.ceil(dailyCounts.length * .9) - 1)] ?? 10);
  episodes.forEach((episode, index) => {
    const rows = byEpisode[index], artists = rank(rows, "artist"), tracks = rank(rows, "track"), albums = rank(rows, "album");
    const episodeDays = new Map<string, number>(); rows.forEach(play => { const value = day(play.playedAt); episodeDays.set(value, (episodeDays.get(value) ?? 0) + 1); });
    const arrivals = artists.filter(artist => Date.parse(artist.first) === Date.parse(baseline.artist.get(artist.key)![0].playedAt)).map(artist => artist.label);
    const lastAvailable = Date.parse(plays.at(-1)?.playedAt ?? options.from);
    const disappearances = artists.filter(artist => { const group = baseline.artist.get(artist.key)!; return group.length >= 5 && Date.parse(artist.last) === Date.parse(group.at(-1)!.playedAt) && lastAvailable - Date.parse(artist.last) >= 14 * dayMs; }).map(artist => artist.label);
    const selectedCues = scene.cues.flatMap(cue => {
      if (cue.source !== "lastfm") return [];
      const key = cue.evidence?.facts.find(fact => fact.startsWith("Grouping key: "))?.slice(14);
      const ranking = cue.note.startsWith("Candidate recurring artist:") ? artists : cue.note.startsWith("Candidate recurring track:") ? tracks : cue.note.startsWith("Candidate album:") ? albums : [];
      const found = ranking.find(item => item.key === key); return found ? [{ cueId: cue.id, count: found.count }] : [];
    });
    const concentrations = ([['artist', artists], ['track', tracks], ['album', albums]] as const).flatMap(([kind, ranking]) => ranking.filter(item => rows.length >= 10 && item.count >= 5 && item.share >= .3 && item.lift >= 2).map(({ key, label, count, share, baselineShare, lift }) => ({ kind, key, label, count, share, baselineShare, lift })));
    episode.listening = { count: rows.length, sourceId: musicSource.id, artists, tracks, albums, dominantArtist: rows.length >= 10 && artists[0]?.share >= .3 ? artists[0].label : null, recurrentArtists: artists.filter(item => item.count >= 2).map(item => item.label), bursts: [...episodeDays].filter(([, count]) => count >= burstThreshold).map(([day, count]) => ({ day, count, baselineThreshold: burstThreshold })), arrivals, disappearances, concentrations, selectedCues };
    if (rows.length) { const evidenceId = `listening:${episode.id}`; episode.provenance.nodes.push({ id: evidenceId, type: "lastfm", sourceId: musicSource.id, start: rows[0].playedAt, end: iso(Date.parse(rows.at(-1)!.playedAt) + 1) }); episode.provenance.edges.push({ evidenceId, role: "listening-observation", basis: "temporal-overlap" }); }
  });
  const timelineEpisodes = episodes.filter(episode => episode.provenance.nodes[0].type === "timeline");
  return xrSceneSchema.parse({ ...scene, journeyEpisodes: episodes, journeyLayout: {
    version: 1, mode: "WORLD", from: options.from, toExclusive: options.toExclusive, timeZone: options.timeZone,
    projection: { method: "local-equirectangular-uniform-v1", originLatitude, originLongitude, metresPerUnit, usableRoomWidth: 36, north: "negative-z" }, sources: options.sources,
    coverage: { timelineStart: timelineEpisodes[0]?.start ?? null, timelineEnd: timelineEpisodes.length ? iso(Math.max(...timelineEpisodes.map(episode => Date.parse(episode.end)))) : null, visits: timelineEpisodes.length, excludedRoutes, invalidVisits, duplicateVisits, baselinePlays: plays.length, duplicatePlays, matchedPlays: byEpisode.reduce((sum, rows) => sum + rows.length, 0), ambiguousPlays, unmatchedPlays },
    rules: [
      "Author date-only envelopes are possible windows, not exact arrival/departure times or stay durations. Only conservative interior listening windows receive unique matches; uncertain boundaries and date-only transit remain ambiguous. City/airport reference points locate named places, not precise personal positions.",
      "One episode per valid Timeline visit; no city guessing, gap filling or route-centroid assignment. Source intervals retained; episode intervals clipped to requested coverage. Overlaps remain ambiguous.",
      "Chronological links show start-time order only, not measured travel paths. Coordinates are independent of chronology. Repeated places can overlap on the map.",
      "Equirectangular projection around the geographic bounding-box midpoint, date-line unwrapped; spherical Earth radius 6371008.8 m. Uniform scale fits the longest extent to 36 of 40 room units. North is negative Z. Approximate distances; not a floor plan.",
      "Last.fm exact timestamp + artist + track + album deduplication; half-open [start,end) interval join. Zero or multiple episode matches remain unassigned. Full available baseline includes the uncovered itinerary period; missing source records are unknown, not silence.",
      "Exact text artist/track/album rankings; dominance >=10 episode plays and >=30% artist share; recurrence >=2 plays. Bursts: episode daily count >=max(10, full-baseline nonzero daily p90). Concentration: >=10 episode plays, >=5 group plays, >=30% share and >=2x full-baseline share. Album shares use all scrobbles as denominator.",
      "Arrivals mean first observed artist play in the baseline, not physical arrival or first-ever listening. Disappearances mean baseline artist >=5 plays, last observed play >=14 days before latest available play; no claim about stopped listening. All profiles use uniquely matched observations only.",
      "Accepted cues remain selections; music fields appear only at matching episodes. Author narrative roles and undated cultural context stay independent and unplaced until geographic/time evidence is supplied. MEMORY moves record Author decisions without interpretation.",
    ],
  } });
}

export function moveJourneyEpisode(scene: XRScene, episodeId: string, x: number, z: number, at = new Date().toISOString()): XRScene {
  if (scene.journeyLayout?.mode !== "MEMORY") throw new Error("Switch to MEMORY to move an episode");
  if (!scene.journeyEpisodes?.some(episode => episode.id === episodeId)) throw new Error("Unknown episode");
  return xrSceneSchema.parse({ ...scene, journeyEpisodes: scene.journeyEpisodes.map(episode => {
    if (episode.id !== episodeId || !episode.worldPosition) return episode;
    const baseline = episode.worldPosition.position, from = episode.memoryPosition ?? baseline, to = { x, y: 0 as const, z };
    if (from.x === x && from.z === z) return episode;
    const displacement = { x: x - baseline.x, y: 0 as const, z: z - baseline.z };
    return { ...episode, memoryPosition: to, memoryDecisions: [...episode.memoryDecisions, { author: "Author", at, from, to, baseline, displacement, distance: Math.hypot(displacement.x, displacement.z), interpretation: "None inferred" }] };
  }) });
}
