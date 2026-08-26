import { NextRequest, NextResponse } from "next/server";
import { authorizationUrl, localSpotifyReturnUrl, newOAuthState, rememberSpotifyOAuthState, spotifyEnvironmentSchema } from "@/lib/spotify-server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const parsed = spotifyEnvironmentSchema.safeParse(process.env);
  if (!parsed.success) return NextResponse.json({ error: "Spotify is not configured on this local Storywalker instance." }, { status: 409 });
  const callbackUrl = new URL(parsed.data.SPOTIFY_REDIRECT_URI);
  const localVault = new URL("/vault", request.nextUrl.origin);
  const returnTo = localSpotifyReturnUrl(
    request.nextUrl.searchParams.get("returnTo"),
    localVault,
    callbackUrl.port,
  );

  // Cookies are host-only. Start the consent flow on the same host as the
  // registered callback so a localhost -> 127.0.0.1 development mismatch
  // cannot discard the state cookie before Spotify returns it.
  if (request.nextUrl.origin !== callbackUrl.origin) {
    const configuredStart = new URL("/api/connectors/spotify/start", callbackUrl.origin);
    configuredStart.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(configuredStart);
  }

  const state = newOAuthState();
  await rememberSpotifyOAuthState(state, returnTo);
  const response = NextResponse.redirect(authorizationUrl(parsed.data, state));
  response.cookies.set("storywalker_spotify_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 10 * 60, path: "/" });
  response.cookies.set("storywalker_spotify_oauth_return_to", returnTo, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 10 * 60, path: "/" });
  return response;
}
