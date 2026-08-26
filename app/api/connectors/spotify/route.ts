import { spotifyAuthorised, spotifyEnvironmentSchema } from "@/lib/spotify-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const configured = spotifyEnvironmentSchema.safeParse(process.env).success;
  const baselinePlaylistLinks = (process.env.STORYWALKER_BASELINE_SPOTIFY_PLAYLISTS ?? "")
    .split(",")
    .map((link) => link.trim())
    .filter((link) => /^https:\/\/open\.spotify\.com\/playlist\/[A-Za-z0-9]{10,64}$/u.test(link))
    .slice(0, 4);
  return Response.json({
    connector: "spotify",
    configured,
    mode: configured ? "ready-for-local-authorisation" : "demo-only",
    authorised: configured ? await spotifyAuthorised() : false,
    permissions: ["playlist-read-private", "playlist-read-collaborative", "user-read-recently-played"],
    baselinePlaylistLinks,
    dataBoundary: "No listening history is requested or retained until the person explicitly authorises and confirms a selection.",
  }, { headers: { "Cache-Control": "no-store" } });
}
