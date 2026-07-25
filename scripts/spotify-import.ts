import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
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
const tracks: Array<{
  trackId: string;
  trackName: string;
  artistNames: string[];
  albumName: string;
  durationMs: number;
  addedAt: string;
}> = [];
while (next) {
  const response = await fetch(next, { headers });
  if (!response.ok) {
    throw new Error(`Spotify item request failed with HTTP ${response.status}.`);
  }
  const page = playlistPageSchema.parse(await response.json());
  for (const row of page.items) {
    if (!row.item?.id || !row.added_at) continue;
    tracks.push({
      trackId: row.item.id,
      trackName: row.item.name,
      artistNames: row.item.artists.map((artist) => artist.name),
      albumName: row.item.album.name,
      durationMs: row.item.duration_ms,
      addedAt: row.added_at,
    });
  }
  next = page.next;
}

const directory = path.join(process.cwd(), "private-data", "spotify");
await mkdir(directory, { recursive: true, mode: 0o700 });
const target = path.join(directory, `${privateImportId(metadata.id)}.private.json`);
await writeFile(
  target,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      source: "spotify-playlist",
      playlist: { id: metadata.id, name: metadata.name },
      importedAt: new Date().toISOString(),
      tracks,
    },
    null,
    2,
  )}\n`,
  { encoding: "utf8", mode: 0o600 },
);
console.log(`Imported ${tracks.length} playlist additions to an ignored private-data file.`);
