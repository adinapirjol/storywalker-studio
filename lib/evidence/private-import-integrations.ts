import { minimisedLastFmHistorySchema } from "./private-ingest";
import type { PrivatePlaylistSnapshot } from "../music/private-playlist";

export const LASTFM_PAGE_SIZE = 200;
export const LASTFM_MAX_PAGES = 40;
export const LASTFM_MAX_RESPONSE_BYTES = 1_000_000;

export type LastFmPage = {
  tracks: unknown[];
  totalPages: number;
};

export function parseLastFmPage(body: unknown, expectedTotalPages?: number): LastFmPage {
  const page = (body as { recenttracks?: { track?: unknown[]; "@attr"?: { totalPages?: string } } })?.recenttracks;
  if (!page || !Array.isArray(page.track)) throw new Error("Last.fm returned an unsupported response.");
  // The API can append one live playback row beyond the requested scrobble limit.
  const isNowPlaying = (row: unknown) => typeof row === "object" && row !== null
    && (row as { "@attr"?: { nowplaying?: string } })["@attr"]?.nowplaying === "true";
  if (page.track.length > LASTFM_PAGE_SIZE + 1) throw new Error("Last.fm returned more rows than requested.");
  const tracks = page.track.filter((row) => !isNowPlaying(row));
  if (tracks.length > LASTFM_PAGE_SIZE || page.track.length - tracks.length > 1) {
    throw new Error("Last.fm returned more rows than requested.");
  }

  const totalPages = Number(page["@attr"]?.totalPages ?? (tracks.length === 0 ? "0" : "1"));
  if (!Number.isInteger(totalPages) || totalPages < 0) throw new Error("Last.fm returned invalid pagination metadata.");
  if (totalPages === 0 && tracks.length > 0) throw new Error("Last.fm returned inconsistent pagination metadata.");
  if (expectedTotalPages !== undefined && expectedTotalPages !== totalPages) {
    throw new Error("Last.fm pagination changed during import.");
  }
  return { tracks, totalPages };
}

export async function readBoundedLastFmJson(response: Response, maxBytes = LASTFM_MAX_RESPONSE_BYTES) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    await response.body?.cancel();
    throw new Error("Last.fm response exceeded the local size limit.");
  }
  if (!response.body) throw new Error("Last.fm returned an empty response.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      total += item.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("Last.fm response exceeded the local size limit.");
      }
      chunks.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

export function mergeLastFmHistory(
  previous: unknown | undefined,
  current: Array<{ playedAt: string; trackName: string; artistName: string; albumName?: string; importerProvenance: string }>,
) {
  const before = previous === undefined ? [] : minimisedLastFmHistorySchema.parse(previous).records;
  const records = new Map<string, (typeof current)[number]>();
  for (const record of [...before, ...current]) {
    const key = JSON.stringify([record.playedAt, record.trackName, record.artistName, record.albumName ?? ""]);
    if (!records.has(key)) records.set(key, record);
  }
  return [...records.values()].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
}

export function latestSpotifySnapshotsByPlaylist(snapshots: PrivatePlaylistSnapshot[]) {
  const latest = new Map<string, PrivatePlaylistSnapshot>();
  for (const snapshot of snapshots) {
    const current = latest.get(snapshot.playlist.id);
    if (!current || Date.parse(snapshot.importedAt) > Date.parse(current.importedAt)) {
      latest.set(snapshot.playlist.id, snapshot);
    }
  }
  return [...latest.values()];
}

export function playlistOccurrencesWithinWindow(
  snapshot: PrivatePlaylistSnapshot,
  from: number,
  toExclusive: number,
) {
  return snapshot.occurrences.flatMap((occurrence) => {
    const addedAt = occurrence.addedAt ? Date.parse(occurrence.addedAt) : Number.NaN;
    return Number.isFinite(addedAt) && addedAt >= from && addedAt < toExclusive
      ? [{ playlistId: snapshot.playlist.id, playlistName: snapshot.playlist.name, ...occurrence }]
      : [];
  });
}
