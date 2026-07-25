import { createServer } from "node:http";
import {
  authorizationUrl,
  exchangeCode,
  newOAuthState,
  spotifyEnvironmentSchema,
  verifyOAuthState,
  writeSpotifyToken,
} from "../lib/spotify-server";

const environment = spotifyEnvironmentSchema.parse(process.env);
const redirect = new URL(environment.SPOTIFY_REDIRECT_URI);
if (!["127.0.0.1", "localhost"].includes(redirect.hostname)) {
  throw new Error("SPOTIFY_REDIRECT_URI must use localhost or 127.0.0.1.");
}
const port = Number(redirect.port || 80);
const state = newOAuthState();

console.log("Open this URL in your browser, authorize locally, and return here:");
console.log(authorizationUrl(environment, state));

const server = createServer(async (request, response) => {
  try {
    const callback = new URL(request.url ?? "/", environment.SPOTIFY_REDIRECT_URI);
    if (callback.pathname !== redirect.pathname) {
      response.writeHead(404).end("Not found");
      return;
    }
    const receivedState = callback.searchParams.get("state") ?? "";
    const code = callback.searchParams.get("code");
    if (!verifyOAuthState(state, receivedState) || !code) {
      response.writeHead(400).end("Authorization validation failed.");
      throw new Error("Spotify callback state or code was invalid.");
    }
    const token = await exchangeCode(environment, code);
    await writeSpotifyToken(token);
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Storywalker Studio authorization saved locally. You can close this tab.");
    console.log("Authorization stored in the ignored local token cache.");
    server.close();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Authorization failed.");
    server.close();
    process.exitCode = 1;
  }
});

server.listen(port, redirect.hostname, () => {
  console.log(`Waiting for the local callback on ${redirect.origin}${redirect.pathname}`);
});

setTimeout(() => {
  console.error("Authorization timed out after five minutes.");
  server.close();
  process.exitCode = 1;
}, 5 * 60 * 1000).unref();
