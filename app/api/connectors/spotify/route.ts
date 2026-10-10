import {isLocalRead} from '@/lib/http/local-origin';
import { spotifyAuthorised, spotifyEnvironmentSchema } from "@/lib/music/spotify-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request:Request) {
  if(!isLocalRead(request))return Response.json({code:"LOCAL_ORIGIN_REQUIRED"},{status:403});
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
