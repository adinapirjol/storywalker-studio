import { z } from "zod";
import { readSpotifyPlaylistPresentations, spotifyEnvironmentSchema } from "@/lib/spotify-server";

export const runtime = "nodejs";

const inputSchema = z.object({
  playlistIds: z.array(z.string().regex(/^[A-Za-z0-9]{10,64}$/u)).min(1).max(4),
});

/**
 * A deliberate, read-only visual lookup for playlists the Author pasted into
 * the selector. Nothing from this response is written to the Vault.
 */
export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const environment = spotifyEnvironmentSchema.parse(process.env);
    return Response.json(
      await readSpotifyPlaylistPresentations(environment, input.playlistIds),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Spotify playlist previews could not be read." },
      { status: 400 },
    );
  }
}
