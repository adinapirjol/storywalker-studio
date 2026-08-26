import { NextRequest, NextResponse } from "next/server";
import { consumeSpotifyOAuthState, exchangeCode, localSpotifyReturnUrl, spotifyEnvironmentSchema, verifyOAuthState, writeSpotifyToken } from "@/lib/spotify-server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const environment = spotifyEnvironmentSchema.safeParse(process.env);
  const state = request.cookies.get("storywalker_spotify_oauth_state")?.value ?? "";
  const storedReturnTo = request.cookies.get("storywalker_spotify_oauth_return_to")?.value;
  const receivedState = request.nextUrl.searchParams.get("state") ?? "";
  const code = request.nextUrl.searchParams.get("code");
  const fallbackReturnTo = code ? await consumeSpotifyOAuthState(receivedState) : undefined;
  const fallback = new URL("/vault", request.url);
  const destination = new URL(localSpotifyReturnUrl(storedReturnTo ?? fallbackReturnTo, fallback, request.nextUrl.port));
  const cookieStateMatches = verifyOAuthState(state, receivedState);
  if (!environment.success || !code || (!cookieStateMatches && !fallbackReturnTo)) {
    destination.searchParams.set("spotify", "not-connected");
    const response = NextResponse.redirect(destination);
    response.cookies.delete("storywalker_spotify_oauth_state");
    response.cookies.delete("storywalker_spotify_oauth_return_to");
    return response;
  }
  await writeSpotifyToken(await exchangeCode(environment.data, code));
  destination.searchParams.set("spotify", "connected");
  const response = NextResponse.redirect(destination);
  response.cookies.delete("storywalker_spotify_oauth_state");
  response.cookies.delete("storywalker_spotify_oauth_return_to");
  return response;
}
