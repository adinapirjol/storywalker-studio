import { createHash } from "node:crypto";
import type { VaultRecord } from "@/lib/vault/private-vault";
import { minimisedLastFmHistorySchema, minimisedSpotifyHistorySchema } from "@/lib/evidence/private-ingest";
import type { Evidence } from "./contracts";
import { researchSessionSchema } from "@/lib/research/research-session";
import { privatePlaylistSnapshotSchema } from "@/lib/music/private-playlist";

export const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown) => typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : null;
export function supportedSource(record: Pick<VaultRecord, "id" | "kind">) {
  return record.kind === "capture" && (record.id.startsWith("capture:") || record.id.startsWith("research-session:")) ||
    record.kind === "import" && (record.id.startsWith("import:spotify-playlist:") || ["import:lastfm-history:v1", "import:spotify-history:v1"].includes(record.id));
}
export function sourceRevoked(record: VaultRecord) {
  const p = object(record.payload);
  return p.consent === false || p.consent === "revoked" || p.revokedAt != null || p.deletedAt != null || p.reviewStatus === "rejected";
}
function time(value: unknown): Pick<Evidence, "timestamp" | "temporalPrecision"> {
  if (typeof value !== "string") return { timestamp: null, temporalPrecision: "unknown" };
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value) return { timestamp: value, temporalPrecision: "day" };
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))) return { timestamp: new Date(value).toISOString(), temporalPrecision: "instant" };
  return { timestamp: null, temporalPrecision: "unknown" };
}
/** Explicit typed fields only. Import/save time never substitutes for event time. */
export function normalize(record: VaultRecord): { evidence: Evidence[]; gaps: string[] } {
  if (!supportedSource(record) || sourceRevoked(record)) return { evidence: [], gaps: ["Source unsupported or consent revoked."] };
  const p = object(record.payload);
  if (record.id.startsWith("import:spotify-playlist:")) {
    const raw = object(p.snapshot);
    if (Array.isArray(raw.occurrences) && raw.occurrences.length > 50000) return { evidence: [], gaps: ["Playlist exceeds the local processing limit."] };
    const parsed = privatePlaylistSnapshotSchema.safeParse(p.snapshot);
    if (!parsed.success || record.id !== `import:spotify-playlist:${parsed.data.playlist.id}`) return { evidence: [], gaps: ["Playlist snapshot could not be validated."] };
    const snapshot = parsed.data;
    return { evidence: [{ id: record.id, sourceId: record.id, revision: digest(p), title: `Playlist · ${snapshot.playlist.name}`, excerpt: `${snapshot.occurrenceCount} playlist entries. Meaning, direction and encounter memories require your own account.`, sourceType: "spotify-playlist-context", timestamp: null, temporalPrecision: "unknown", location: null, artist: null, track: null, provenance: "Selected Spotify playlist snapshot saved in Vault", authority: "source-recorded", caveat: "Playlist membership and addition times are not proof of listening, discovery, memory, intent or meaning.", gaps: ["Author interpretation not supplied by playlist metadata", "Encounter and remembered-song times unknown"] }], gaps: [] };
  }
  if (record.id.startsWith("research-session:")) {
    const parsed = researchSessionSchema.safeParse(p);
    if (!parsed.success || parsed.data.mode !== "live" || parsed.data.study !== "refusal" || p.evidenceStatus !== "author-stated") return { evidence: [], gaps: ["Only live Author editorial readings are available; fictional studies are excluded."] };
    return { evidence: [{ id: record.id, sourceId: record.id, revision: digest(p), title: parsed.data.title, excerpt: parsed.data.note, sourceType: "author-editorial-reading", timestamp: null, temporalPrecision: "unknown", location: null, artist: null, track: null, provenance: "Author observation and editorial reading saved in the encrypted Vault", authority: "author-stated", caveat: "Present editorial response; save time is not listening or encounter time.", gaps: ["No historical event time asserted"] }], gaps: [] };
  }
  if (record.kind === "capture") {
    const timing = time(p.when);
    const provenance = p.evidenceStatus === "author-stated" ? "Author capture in Vault" : null;
    const gaps = [...(!timing.timestamp ? ["Missing or ambiguous event timestamp"] : []), "Location not supplied", ...(!provenance ? ["Missing provenance"] : [])];
    return { evidence: [{ id: record.id, sourceId: record.id, revision: digest(record.payload), title: text(p.title) ?? "Untitled capture", excerpt: text(p.evidence), sourceType: "capture", ...timing, location: null, artist: null, track: null, provenance, authority: "author-stated", caveat: `Author-recorded status: ${text(p.status) ?? "unknown"}. A plan is not attendance.`, gaps }], gaps: [] };
  }
  const rawRows = object(p.document).records;
  if (Array.isArray(rawRows) && rawRows.length > 50000) return { evidence: [], gaps: ["Source exceeds the 50,000-row processing limit. A bounded import window is required; no rows were indexed."] };
  const lastfm = minimisedLastFmHistorySchema.safeParse(p.document);
  const spotify = lastfm.success ? null : minimisedSpotifyHistorySchema.safeParse(p.document);
  if (!lastfm.success && !spotify?.success) return { evidence: [], gaps: ["Listening source failed its existing minimised schema; nothing indexed."] };
  const rows = lastfm.success ? lastfm.data.records.map(r => ({ raw: r, at: r.playedAt, track: r.trackName, artist: r.artistName, provenance: r.importerProvenance })) : spotify!.data!.records.map(r => ({ raw: r, at: r.endedAt, track: r.trackName, artist: r.artistName, provenance: r.importerProvenance }));
  const unique = new Map<string, Evidence>();
  // Newest 160 observations per selected import. Explicit coverage gap below.
  rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  for (const row of rows) {
    const id = `${record.id}:${digest([new Date(row.at).toISOString(), row.track ?? null, row.artist ?? null]).slice(0, 24)}`;
    if (unique.has(id)) continue;
    if (unique.size >= 160) break;
    const provenance = text(row.provenance);
    unique.set(id, { id, sourceId: record.id, revision: digest(row.raw), title: text([row.track, row.artist].filter(Boolean).join(" — ")) || "Listening observation", excerpt: null, sourceType: lastfm.success ? "lastfm-scrobbles" : "spotify-history", ...time(row.at), location: null, artist: row.artist && row.artist.length <= 500 ? row.artist : null, track: row.track && row.track.length <= 500 ? row.track : null, provenance, authority: "source-recorded", caveat: lastfm.success ? "Scrobble time establishes a recorded play, not attention, emotion or meaning." : "Playback end time, not start time; no attention or meaning inferred.", gaps: ["Location not supplied", "Artist identity is an exact label, not a verified entity", ...(!provenance ? ["Missing provenance"] : [])] });
  }
  return { evidence: [...unique.values()], gaps: rows.length > unique.size ? [`${rows.length} source rows; bounded view contains ${unique.size} unique recent observations. Older rows and duplicates are outside this window.`] : [] };
}
