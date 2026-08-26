import { spotifyEnvironmentSchema, readSpotifySelection } from "@/lib/spotify-server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const environment = spotifyEnvironmentSchema.parse(process.env);
    return Response.json({ selection: await readSpotifySelection(environment) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Spotify selection could not be read." }, { status: 400 }); }
}
