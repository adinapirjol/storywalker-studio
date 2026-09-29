import { z } from "zod";
import type { JourneyEpisode } from "./journey-episode";
import { minimisedGoogleCalendarSchema } from "./private-ingest";

export const calendarContextSchema = z.object({
  sourceId: z.string(), sourceFingerprint: z.string(), title: z.string(),
  startsWhen: z.string(), endsWhen: z.string().optional(), locationLabel: z.string().optional(),
  match: z.enum(["timestamp-overlap", "same-local-day"]),
}).strict();
const day = (value: string, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const timestamp = (value?: string) => value && /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? Date.parse(value) : NaN;

/** Context matching never supplies geographic evidence or changes the route. */
export function calendarContextForEpisodes(episodes: JourneyEpisode[], input: unknown, sourceId: string, fingerprint: string) {
  const calendar = minimisedGoogleCalendarSchema.parse(input);
  return episodes.map(episode => { const calendarEvidence = calendar.records.flatMap((record, index) => {
    const start = timestamp(record.startsWhen), finish = timestamp(record.endsWhen);
    const episodeStart = Date.parse(episode.start), episodeEnd = Date.parse(episode.end);
    const exact = Number.isFinite(start) && (Number.isFinite(finish) ? finish > start && start < episodeEnd && finish > episodeStart : start >= episodeStart && start < episodeEnd);
    // Floating/declared-zone strings are retained verbatim. They are not silently
    // parsed in the machine's timezone. Only their source calendar dates match.
    const dateOnly = !Number.isFinite(start) && validDay(record.startsWhen.slice(0, 10));
    const sourceDate = record.startsWhen.slice(0, 10);
    const lastDate = record.allDay && record.endsWhen && validDay(record.endsWhen) ? new Date(Date.parse(record.endsWhen) - 86400000).toISOString().slice(0, 10) : sourceDate;
    const sameDay = dateOnly && sourceDate <= day(new Date(episodeEnd - 1).toISOString(), episode.timeZone) && lastDate >= day(episode.start, episode.timeZone);
    if (!exact && !sameDay) return [];
    return [{ sourceId: `${sourceId}#records/${index}`, sourceFingerprint: fingerprint, title: record.title ?? "Untitled Calendar entry", startsWhen: record.startsWhen, ...(record.endsWhen ? { endsWhen: record.endsWhen } : {}), ...(record.location ? { locationLabel: record.location } : {}), match: exact ? "timestamp-overlap" as const : "same-local-day" as const }];
  });
    const nodePrefix = "calendar-context:";
    const nodes = episode.provenance.nodes.filter(node => !node.id.startsWith(nodePrefix));
    const edges = episode.provenance.edges.filter(edge => !edge.evidenceId.startsWith(nodePrefix));
    for (const item of calendarEvidence) {
      const evidenceId = `${nodePrefix}${item.sourceId}`;
      nodes.push({ id: evidenceId, type: "calendar", sourceId: item.sourceId, sourceWhen: `${item.startsWhen}${item.endsWhen ? ` → ${item.endsWhen}` : ""}` });
      edges.push({ evidenceId, role: "temporal-context", basis: item.match === "timestamp-overlap" ? "temporal-overlap" : "source-record" });
    }
    return { ...episode, calendarEvidence, provenance: { nodes, edges } };
  });
}

/** Three independently sourced identifiers; a display layer, never a place inference. */
export function episodeIdentifiers(episode: JourneyEpisode) {
  const geography = episode.provenance.nodes.find(node => episode.worldPosition?.evidenceIds.includes(node.id));
  const coords = geography?.type === "timeline" ? geography.coordinates : geography?.type === "author" ? geography.confirmedGeography : undefined;
  const coordinateLabel = coords ? `${Math.abs(coords.latitude).toFixed(4)}°${coords.latitude < 0 ? "S" : "N"}, ${Math.abs(coords.longitude).toFixed(4)}°${coords.longitude < 0 ? "W" : "E"}` : "No geographic coordinates";
  const sourceLabel = episode.label === "Unlabelled Timeline stop" ? null : episode.label;
  const stableId = episode.id.startsWith("timeline-row-") ? `T${episode.id.slice(13)}` : episode.id;
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: episode.timeZone, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const start = formatter.format(new Date(episode.start)), end = formatter.format(new Date(episode.end));
  const timeText = episode.reconstructedTiming?.label;
  const minutes = Math.round((Date.parse(episode.end) - Date.parse(episode.start)) / 60000);
  const duration = minutes >= 1440 ? `${Math.floor(minutes / 1440)}d ${Math.floor(minutes % 1440 / 60)}h` : minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
  const artists = episode.listening?.artists ?? [], tracks = episode.listening?.tracks ?? [];
  const topCount = artists[0]?.count, topArtists = artists.filter(item => item.count === topCount);
  const music = topArtists.length ? `${topArtists.slice(0, 2).map(item => item.label).join(" / ")}${topArtists.length > 2 ? ` +${topArtists.length - 2} tied` : ""} · ${topCount} plays${topArtists.length > 1 ? " each" : ""}${topArtists.length === 1 ? " (top observed)" : " (tied)"}` : "No uniquely matched listening";
  const calendar = episode.calendarEvidence ?? [];
  return {
    stableId, title: sourceLabel ?? `Stop ${stableId}`,
    place: { text: sourceLabel ? `${sourceLabel} · ${coordinateLabel}` : coordinateLabel, sourceId: geography?.sourceId ?? "No geographic source", certainty: geography?.type === "timeline" ? geography.certainty : episode.geographicReference ? `Author itinerary · ${episode.geographicReference.precision}` : "Author-confirmed" },
    time: { text: timeText ?? `${start} → ${end} · ${duration}`, sourceId: geography?.sourceId ?? episode.id, timeZone: episode.timeZone },
    context: { music, track: tracks[0] ? `${tracks[0].label} · ${tracks[0].count} plays` : null, musicSourceId: episode.listening?.sourceId ?? null, calendar },
    option: `${stableId} · ${timeText ?? `${start} (${duration})`} · ${sourceLabel ?? coordinateLabel} · ${artists[0]?.label ?? "no listening"}${calendar.length ? ` / ${calendar[0].title}${calendar.length > 1 ? ` +${calendar.length - 1}` : ""}` : " / no Calendar match"}`,
  };
}
