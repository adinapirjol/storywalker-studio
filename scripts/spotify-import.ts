import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  diffPrivatePlaylistSnapshots,
  makePrivatePlaylistSnapshot,
  occurrenceFromSpotifyItem,
  privatePlaylistSnapshotSchema,
  type PrivatePlaylistOccurrence,
} from "../lib/private-playlist";
import {
  privateImportId,
  spotifyEnvironmentSchema,
  validSpotifyToken,
} from "../lib/spotify-server";

const playlistPageSchema = z.object({
  items: z.array(
    z.object({
      added_at: z.string().nullable(),
      item: z
        .object({
          id: z.string().nullable(),
          name: z.string(),
          artists: z.array(z.object({ name: z.string() })),
          album: z.object({ name: z.string() }),
          duration_ms: z.number().int().positive(),
        })
        .nullable(),
    }),
  ),
  next: z.string().url().nullable(),
});
const playlistSchema = z.object({ id: z.string(), name: z.string() });

async function main() {
  const flag = process.argv.indexOf("--playlist");
  const playlistId = flag >= 0 ? process.argv[flag + 1]?.trim() : undefined;
  if (!playlistId || !/^[A-Za-z0-9]+$/u.test(playlistId)) {
    throw new Error("Usage: npm run spotify:import -- --playlist <playlist-id>");
  }

  const environment = spotifyEnvironmentSchema.parse(process.env);
  const token = await validSpotifyToken(environment);
  const headers = { Authorization: `Bearer ${token.accessToken}` };
  const encoded = encodeURIComponent(playlistId);
  const metadataResponse = await fetch(
  `https://api.spotify.com/v1/playlists/${encoded}?fields=id,name`,
  { headers },
  );
  if (!metadataResponse.ok) {
    throw new Error(`Spotify playlist request failed with HTTP ${metadataResponse.status}.`);
  }
  const metadata = playlistSchema.parse(await metadataResponse.json());

  let next: string | null =
    `https://api.spotify.com/v1/playlists/${encoded}/items?limit=50&fields=items(added_at,item(id,name,duration_ms,artists(name),album(name))),next`;
  const occurrences: PrivatePlaylistOccurrence[] = [];
  let sourcePosition = 0;
  while (next) {
    const response = await fetch(next, { headers });
    if (!response.ok) {
      throw new Error(`Spotify item request failed with HTTP ${response.status}.`);
    }
    const page = playlistPageSchema.parse(await response.json());
    for (const row of page.items) {
      occurrences.push(occurrenceFromSpotifyItem(row, sourcePosition));
      sourcePosition += 1;
    }
    next = page.next;
  }

  const directory = path.join(process.cwd(), "private-data", "spotify");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const target = path.join(directory, `${privateImportId(metadata.id)}.private.json`);
  let previous;
  try {
    previous = privatePlaylistSnapshotSchema.parse(JSON.parse(await readFile(target, "utf8")) as unknown);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  const snapshot = makePrivatePlaylistSnapshot({
    playlist: metadata,
    importedAt: new Date().toISOString(),
    occurrences,
  });
  const delta = diffPrivatePlaylistSnapshots(previous, snapshot);
  await writeFile(
    target,
    `${JSON.stringify(snapshot, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  await writeFile(
    path.join(directory, `${privateImportId(metadata.id)}.delta.private.json`),
    `${JSON.stringify({ schemaVersion: 1, generatedAt: snapshot.importedAt, delta }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  console.log(
    `Imported ${delta.currentOccurrenceCount} playlist occurrences (previous snapshot: ${delta.previousOccurrenceCount}).`,
  );
  console.log(
    `Diagnostics: ${delta.missingTimestampPositions.length} missing timestamp(s), ${delta.unavailablePositions.length} unavailable item(s).`,
  );
  console.log("Raw playlist order is retained; chronologicalOccurrencePositions is a separate timestamp-sorted view.");
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Spotify import failed.");
  process.exitCode = 1;
});
