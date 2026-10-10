import { z } from "zod";

const offsetDateTimeOrNull = z.string().datetime({ offset: true }).nullable();

export const privatePlaylistOccurrenceSchema = z.object({
  sourcePosition: z.number().int().nonnegative(),
  addedAt: offsetDateTimeOrNull,
  availability: z.enum(["available", "unavailable"]),
  trackId: z.string().min(1).nullable(),
  trackName: z.string().min(1).nullable(),
  artistNames: z.array(z.string().min(1)),
  albumName: z.string().min(1).nullable(),
  durationMs: z.number().int().positive().nullable(),
});

export const privatePlaylistSnapshotSchema = z.object({
  schemaVersion: z.literal(2),
  source: z.literal("spotify-playlist"),
  playlist: z.object({ id: z.string().min(1), name: z.string().min(1) }),
  importedAt: z.string().datetime({ offset: true }),
  rawOrder: z.literal("spotify-playlist-position"),
  occurrenceCount: z.number().int().nonnegative(),
  missingTimestampPositions: z.array(z.number().int().nonnegative()),
  unavailablePositions: z.array(z.number().int().nonnegative()),
  occurrences: z.array(privatePlaylistOccurrenceSchema),
  chronologicalOccurrencePositions: z.array(z.number().int().nonnegative()),
});

export type PrivatePlaylistOccurrence = z.infer<typeof privatePlaylistOccurrenceSchema>;
export type PrivatePlaylistSnapshot = z.infer<typeof privatePlaylistSnapshotSchema>;

export interface PlaylistDeltaSummary {
  previousOccurrenceCount: number;
  currentOccurrenceCount: number;
  addedPositions: number[];
  removedPositions: number[];
  changedPositions: number[];
  missingTimestampPositions: number[];
  unavailablePositions: number[];
}

type SpotifyApiItem = {
  added_at: string | null;
  item: {
    id: string | null;
    name: string;
    artists: Array<{ name: string }>;
    album: { name: string };
    duration_ms: number;
  } | null;
};

export function occurrenceFromSpotifyItem(
  row: SpotifyApiItem,
  sourcePosition: number,
): PrivatePlaylistOccurrence {
  const item = row.item;
  return privatePlaylistOccurrenceSchema.parse({
    sourcePosition,
    addedAt: row.added_at,
    availability: item?.id ? "available" : "unavailable",
    trackId: item?.id ?? null,
    trackName: item?.name ?? null,
    artistNames: item?.artists.map((artist) => artist.name) ?? [],
    albumName: item?.album.name ?? null,
    durationMs: item?.duration_ms ?? null,
  });
}

export function chronologicalOccurrences(occurrences: PrivatePlaylistOccurrence[]) {
  return occurrences.slice().sort((a, b) => {
    if (a.addedAt && b.addedAt) return a.addedAt.localeCompare(b.addedAt) || a.sourcePosition - b.sourcePosition;
    if (a.addedAt) return -1;
    if (b.addedAt) return 1;
    return a.sourcePosition - b.sourcePosition;
  });
}

export function makePrivatePlaylistSnapshot(input: {
  playlist: { id: string; name: string };
  importedAt: string;
  occurrences: PrivatePlaylistOccurrence[];
}): PrivatePlaylistSnapshot {
  const occurrences = input.occurrences.slice().sort((a, b) => a.sourcePosition - b.sourcePosition);
  return privatePlaylistSnapshotSchema.parse({
    schemaVersion: 2,
    source: "spotify-playlist",
    playlist: input.playlist,
    importedAt: input.importedAt,
    rawOrder: "spotify-playlist-position",
    occurrenceCount: occurrences.length,
    missingTimestampPositions: occurrences.filter((item) => !item.addedAt).map((item) => item.sourcePosition),
    unavailablePositions: occurrences
      .filter((item) => item.availability === "unavailable")
      .map((item) => item.sourcePosition),
    occurrences,
    chronologicalOccurrencePositions: chronologicalOccurrences(occurrences).map(
      (item) => item.sourcePosition,
    ),
  });
}

function sameOccurrence(a: PrivatePlaylistOccurrence, b: PrivatePlaylistOccurrence) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function diffPrivatePlaylistSnapshots(
  previous: PrivatePlaylistSnapshot | undefined,
  current: PrivatePlaylistSnapshot,
): PlaylistDeltaSummary {
  const before = new Map(previous?.occurrences.map((item) => [item.sourcePosition, item]) ?? []);
  const after = new Map(current.occurrences.map((item) => [item.sourcePosition, item]));
  const addedPositions = [...after.keys()].filter((position) => !before.has(position)).sort((a, b) => a - b);
  const removedPositions = [...before.keys()].filter((position) => !after.has(position)).sort((a, b) => a - b);
  const changedPositions = [...after.keys()]
    .filter((position) => before.has(position) && !sameOccurrence(before.get(position)!, after.get(position)!))
    .sort((a, b) => a - b);
  return {
    previousOccurrenceCount: previous?.occurrenceCount ?? 0,
    currentOccurrenceCount: current.occurrenceCount,
    addedPositions,
    removedPositions,
    changedPositions,
    missingTimestampPositions: current.missingTimestampPositions,
    unavailablePositions: current.unavailablePositions,
  };
}
