import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const SPOTIFY_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
] as const;
export const SPOTIFY_TOKEN_FILE = ".spotify-token.local.json";

export const spotifyEnvironmentSchema = z.object({
  SPOTIFY_CLIENT_ID: z.string().min(1),
  SPOTIFY_CLIENT_SECRET: z.string().min(1),
  SPOTIFY_REDIRECT_URI: z.string().url(),
});

const tokenSchema = z.object({
  schemaVersion: z.literal(1),
  tokenType: z.literal("Bearer"),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  expiresAt: z.string().datetime(),
  scopes: z.array(z.string()),
});

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
});

export type SpotifyEnvironment = z.infer<typeof spotifyEnvironmentSchema>;
export type SpotifyToken = z.infer<typeof tokenSchema>;

export function spotifyTokenPath(cwd = process.cwd()) {
  return path.join(cwd, SPOTIFY_TOKEN_FILE);
}

export function newOAuthState() {
  return randomBytes(24).toString("base64url");
}

export function verifyOAuthState(expected: string, received: string) {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function authorizationUrl(environment: SpotifyEnvironment, state: string) {
  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: environment.SPOTIFY_CLIENT_ID,
    redirect_uri: environment.SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES.join(" "),
    state,
  }).toString();
  return url.toString();
}

async function tokenRequest(
  environment: SpotifyEnvironment,
  body: URLSearchParams,
): Promise<SpotifyToken> {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${environment.SPOTIFY_CLIENT_ID}:${environment.SPOTIFY_CLIENT_SECRET}`,
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`Spotify token request failed with HTTP ${response.status}.`);
  }
  const parsed = tokenResponseSchema.parse(await response.json());
  const now = Date.now();
  return tokenSchema.parse({
    schemaVersion: 1,
    tokenType: "Bearer",
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token,
    expiresAt: new Date(now + parsed.expires_in * 1000).toISOString(),
    scopes: parsed.scope?.split(/\s+/u).filter(Boolean) ?? [...SPOTIFY_SCOPES],
  });
}

export async function exchangeCode(
  environment: SpotifyEnvironment,
  code: string,
): Promise<SpotifyToken> {
  return tokenRequest(
    environment,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: environment.SPOTIFY_REDIRECT_URI,
    }),
  );
}

async function refreshToken(
  environment: SpotifyEnvironment,
  previous: SpotifyToken,
): Promise<SpotifyToken> {
  if (!previous.refreshToken) throw new Error("The local token has no refresh token.");
  const refreshed = await tokenRequest(
    environment,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: previous.refreshToken,
    }),
  );
  return {
    ...refreshed,
    refreshToken: refreshed.refreshToken ?? previous.refreshToken,
  };
}

export async function writeSpotifyToken(token: SpotifyToken) {
  const target = spotifyTokenPath();
  await writeFile(target, `${JSON.stringify(tokenSchema.parse(token), null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(target, 0o600);
}

export async function readSpotifyToken(): Promise<SpotifyToken> {
  const source = await readFile(spotifyTokenPath(), "utf8");
  return tokenSchema.parse(JSON.parse(source) as unknown);
}

export async function validSpotifyToken(
  environment: SpotifyEnvironment,
): Promise<SpotifyToken> {
  const stored = await readSpotifyToken();
  if (new Date(stored.expiresAt).getTime() > Date.now() + 60_000) return stored;
  const refreshed = await refreshToken(environment, stored);
  await writeSpotifyToken(refreshed);
  return refreshed;
}

export function privateImportId(playlistId: string) {
  return createHash("sha256").update(playlistId).digest("hex").slice(0, 16);
}
