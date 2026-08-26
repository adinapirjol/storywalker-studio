import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { makePrivatePlaylistSnapshot, occurrenceFromSpotifyItem, type PrivatePlaylistSnapshot } from "@/lib/private-playlist";
import { rankPlaylistsByRecentListening, rankRecentPlaylistContexts, recommendOwnedPlaylists, type PlaylistRecommendation, type SpotifyPlaylistCandidate } from "@/lib/spotify-selection";

export const SPOTIFY_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-recently-played",
] as const;
export const SPOTIFY_TOKEN_FILE = ".spotify-token.local.json";
const SPOTIFY_OAUTH_STATE_FILE = ".spotify-oauth-state.local.json";

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

const oauthStateFileSchema = z.object({
  schemaVersion: z.literal(1),
  pending: z.array(z.object({
    state: z.string().min(1),
    returnTo: z.string().url(),
    expiresAt: z.string().datetime(),
  })),
});

export type SpotifyEnvironment = z.infer<typeof spotifyEnvironmentSchema>;
export type SpotifyToken = z.infer<typeof tokenSchema>;

export function spotifyTokenPath(cwd = process.cwd()) {
  return path.join(cwd, SPOTIFY_TOKEN_FILE);
}

function spotifyOAuthStatePath(cwd = process.cwd()) {
  return path.join(cwd, SPOTIFY_OAUTH_STATE_FILE);
}

export function newOAuthState() {
  return randomBytes(24).toString("base64url");
}

export function verifyOAuthState(expected: string, received: string) {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * OAuth must finish on Spotify's registered callback host. During local work,
 * that can be 127.0.0.1 while the author opened Storywalker at localhost.
 * Preserve only a same-port local return URL, never an arbitrary redirect.
 */
export function localSpotifyReturnUrl(
  candidate: string | null | undefined,
  fallback: URL,
  allowedPort: string,
) {
  if (!candidate) return fallback.toString();
  try {
    const target = new URL(candidate);
    const isLocalHost = target.hostname === "localhost" || target.hostname === "127.0.0.1";
    if (target.protocol !== "http:" || !isLocalHost || target.port !== allowedPort) return fallback.toString();
    return target.toString();
  } catch {
    return fallback.toString();
  }
}

async function readPendingSpotifyOAuthStates() {
  try {
    return oauthStateFileSchema.parse(JSON.parse(await readFile(spotifyOAuthStatePath(), "utf8")) as unknown);
  } catch {
    return { schemaVersion: 1 as const, pending: [] };
  }
}

async function writePendingSpotifyOAuthStates(pending: z.infer<typeof oauthStateFileSchema>["pending"]) {
  await writeFile(spotifyOAuthStatePath(), `${JSON.stringify({ schemaVersion: 1, pending }, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(spotifyOAuthStatePath(), 0o600);
}

/**
 * A one-time local fallback for OAuth state. Browsers keep cookies host-only,
 * while a local app may be opened at localhost and registered with Spotify at
 * 127.0.0.1. This file contains only short-lived random state and safe local
 * return URLs—never a Spotify credential or personal source data.
 */
export async function rememberSpotifyOAuthState(state: string, returnTo: string) {
  const now = Date.now();
  const existing = await readPendingSpotifyOAuthStates();
  const pending = existing.pending.filter((entry) => new Date(entry.expiresAt).getTime() > now);
  pending.push({ state, returnTo, expiresAt: new Date(now + 10 * 60 * 1000).toISOString() });
  await writePendingSpotifyOAuthStates(pending);
}

export async function consumeSpotifyOAuthState(received: string) {
  const now = Date.now();
  const existing = await readPendingSpotifyOAuthStates();
  const matched = existing.pending.find((entry) => (
    new Date(entry.expiresAt).getTime() > now && verifyOAuthState(entry.state, received)
  ));
  await writePendingSpotifyOAuthStates(existing.pending.filter((entry) => entry !== matched && new Date(entry.expiresAt).getTime() > now));
  return matched?.returnTo;
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

export async function spotifyAuthorised() {
  try { await readSpotifyToken(); return true; } catch { return false; }
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

const profileSchema = z.object({ id: z.string().min(1) });
const pageSchema = z.object({ items: z.array(z.unknown()), next: z.string().url().nullable() });
const playlistImageSchema = z.object({ url: z.string().url(), height: z.number().int().nullable().optional(), width: z.number().int().nullable().optional() });
const playlistSummarySchema = z.object({ id: z.string().min(1), name: z.string().min(1), collaborative: z.boolean(), owner: z.object({ id: z.string().min(1) }), tracks: z.object({ total: z.number().int().nonnegative() }), images: z.array(playlistImageSchema).optional().default([]) });
// Playlist imports deliberately need less metadata than the library selector.
// Spotify can provide a readable private playlist's id/name while omitting
// aggregate fields such as tracks.total; that should not prevent us from
// reading the actual selected playlist items below.
const playlistImportMetadataSchema = z.object({ id: z.string().min(1), name: z.string().min(1) });
const playlistPresentationSchema = z.object({ id: z.string().min(1), name: z.string().min(1), tracks: z.object({ total: z.number().int().nonnegative() }).optional(), images: z.array(playlistImageSchema).optional().default([]) });
const playlistItemSchema = z.object({ added_at: z.string().nullable(), item: z.object({ id: z.string().nullable(), name: z.string(), artists: z.array(z.object({ name: z.string() })), album: z.object({ name: z.string() }), duration_ms: z.number().int().positive() }).nullable() });
const recentItemSchema = z.object({
  track: z.object({ id: z.string().nullable() }),
  context: z.object({ type: z.string(), uri: z.string() }).nullable().optional(),
});

export class SpotifyRequestError extends Error {
  constructor(public readonly status: number) {
    super(`Spotify request failed with HTTP ${status}.`);
    this.name = "SpotifyRequestError";
  }
}

async function spotifyJson(token: SpotifyToken, url: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token.accessToken}` } });
  if (!response.ok) throw new SpotifyRequestError(response.status);
  return response.json() as Promise<unknown>;
}

function spotifyPlaylistUrl(playlistId: string) {
  return `https://open.spotify.com/playlist/${encodeURIComponent(playlistId)}`;
}

function playlistCoverImage(playlist: { images: Array<{ url: string }> }) {
  return playlist.images[0]?.url;
}

async function playlistTrackIds(token: SpotifyToken, playlistId: string) {
  let next: string | null = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items?limit=100&fields=items(item(id)),next`;
  const ids: string[] = [];
  while (next) {
    const page = pageSchema.parse(await spotifyJson(token, next));
    ids.push(...page.items.flatMap((item) => { const parsed = z.object({ item: z.object({ id: z.string().nullable() }).nullable() }).safeParse(item); return parsed.success && parsed.data.item?.id ? [parsed.data.item.id] : []; }));
    next = page.next;
  }
  return ids;
}

export type SpotifySelection = {
  accountId: string;
  recentlyPlayedCount: number;
  libraryPlaylistCount: number;
  recommendations: Array<PlaylistRecommendation & { recentContextPlays?: number }>;
  selectionBasis: "recent-play-context" | "owned" | "owned-collaborative" | "library-fallback" | "none";
};

/**
 * Read-only selector presentation. Cover URLs are returned to the current
 * browser only, so a visual preview does not add third-party media URLs to
 * encrypted autobiographical evidence.
 */
export type SpotifyPlaylistPresentation = {
  id: string;
  name: string;
  tracksTotal: number;
  coverImageUrl?: string;
  spotifyUrl: string;
};

export type SpotifyPlaylistUnavailable = {
  id: string;
  status: number | "unexpected";
};

export async function readSpotifyPlaylistPresentations(
  environment: SpotifyEnvironment,
  playlistIds: string[],
): Promise<{ playlists: SpotifyPlaylistPresentation[]; unavailablePlaylistIds: string[]; unavailable: SpotifyPlaylistUnavailable[] }> {
  const token = await validSpotifyToken(environment);
  const ids = [...new Set(playlistIds)].slice(0, 4);
  const settled = await Promise.allSettled(ids.map(async (playlistId) => {
    const metadata = playlistPresentationSchema.parse(await spotifyJson(
      token,
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}?fields=id,name,tracks(total),images(url,height,width)`,
    ));
    return {
      id: metadata.id,
      name: metadata.name,
      // Spotify currently omits tracks.total for some playlist metadata reads.
      // A title and cover remain useful live presentation data; an absent total
      // must not make an otherwise readable private playlist look unavailable.
      tracksTotal: metadata.tracks?.total ?? 0,
      coverImageUrl: playlistCoverImage(metadata),
      spotifyUrl: spotifyPlaylistUrl(metadata.id),
    };
  }));
  const unavailable = settled.flatMap((result, index): SpotifyPlaylistUnavailable[] => {
    if (result.status === "fulfilled") return [];
    return [{
      id: ids[index],
      status: result.reason instanceof SpotifyRequestError ? result.reason.status : "unexpected",
    }];
  });
  return {
    playlists: settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []),
    unavailablePlaylistIds: unavailable.map((item) => item.id),
    unavailable,
  };
}

/** Read-only account scan used only after explicit provider OAuth consent. */
export async function readSpotifySelection(environment: SpotifyEnvironment): Promise<SpotifySelection> {
  const token = await validSpotifyToken(environment);
  const profile = profileSchema.parse(await spotifyJson(token, "https://api.spotify.com/v1/me"));
  const recent = pageSchema.parse(await spotifyJson(token, "https://api.spotify.com/v1/me/player/recently-played?limit=50"));
  const recentItems = recent.items.flatMap((item) => {
    const parsed = recentItemSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
  const recentTrackIds = recentItems.flatMap((item) => item.track.id ? [item.track.id] : []);
  const recentPlaylistContexts = rankRecentPlaylistContexts(recentItems.flatMap((item) => {
    const uri = item.context?.type === "playlist" ? item.context.uri : undefined;
    const id = uri?.match(/^spotify:playlist:([A-Za-z0-9]{10,64})$/u)?.[1];
    return id ? [id] : [];
  }));
  if (recentPlaylistContexts.length) {
    // Playback history can retain a context URI after a playlist has become
    // private, deleted, or otherwise inaccessible. Keep the readable contexts
    // and fall back rather than making one stale reference fail the scan.
    const settled = await Promise.allSettled(recentPlaylistContexts.map(async ({ id, playCount }) => {
      const metadata = playlistSummarySchema.parse(await spotifyJson(token, `https://api.spotify.com/v1/playlists/${encodeURIComponent(id)}?fields=id,name,collaborative,owner(id),tracks(total),images(url,height,width)`));
      return { id: metadata.id, name: metadata.name, ownerId: metadata.owner.id, collaborative: metadata.collaborative, tracksTotal: metadata.tracks.total, trackIds: [], recentPlayOverlap: 0, recentContextPlays: playCount, coverImageUrl: playlistCoverImage(metadata), spotifyUrl: spotifyPlaylistUrl(metadata.id) };
    }));
    const recommendations = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    if (recommendations.length) {
      return { accountId: profile.id, recentlyPlayedCount: recentItems.length, libraryPlaylistCount: 0, recommendations, selectionBasis: "recent-play-context" };
    }
  }
  let next: string | null = "https://api.spotify.com/v1/me/playlists?limit=50";
  const summaries: z.infer<typeof playlistSummarySchema>[] = [];
  while (next) { const page = pageSchema.parse(await spotifyJson(token, next)); summaries.push(...page.items.flatMap((item) => { const parsed = playlistSummarySchema.safeParse(item); return parsed.success ? [parsed.data] : []; })); next = page.next; }
  const owned = summaries.filter((playlist) => playlist.owner.id === profile.id);
  const ownedNonCollaborative = owned.filter((playlist) => !playlist.collaborative);
  const ownedCollaborative = owned.filter((playlist) => playlist.collaborative);
  const eligible = summaries.filter((playlist) => !playlist.collaborative);
  const candidateSummaries = (ownedNonCollaborative.length ? ownedNonCollaborative : ownedCollaborative.length ? ownedCollaborative : eligible.length ? eligible : summaries).slice(0, 60);
  const candidates: SpotifyPlaylistCandidate[] = await Promise.all(candidateSummaries.map(async (playlist) => ({ id: playlist.id, name: playlist.name, ownerId: playlist.owner.id, collaborative: playlist.collaborative, tracksTotal: playlist.tracks.total, trackIds: await playlistTrackIds(token, playlist.id), coverImageUrl: playlistCoverImage(playlist), spotifyUrl: spotifyPlaylistUrl(playlist.id) })));
  const selectionBasis = ownedNonCollaborative.length ? "owned" : ownedCollaborative.length ? "owned-collaborative" : eligible.length || summaries.length ? "library-fallback" : "none";
  const recommendations = selectionBasis === "owned"
    ? recommendOwnedPlaylists(profile.id, candidates, recentTrackIds, 4)
    : rankPlaylistsByRecentListening(candidates, recentTrackIds, 4);
  return { accountId: profile.id, recentlyPlayedCount: recentItems.length, libraryPlaylistCount: summaries.length, recommendations, selectionBasis };
}

export async function importSpotifyPlaylists(environment: SpotifyEnvironment, playlistIds: string[]): Promise<PrivatePlaylistSnapshot[]> {
  const token = await validSpotifyToken(environment); const snapshots: PrivatePlaylistSnapshot[] = [];
  for (const playlistId of playlistIds) {
    const metadata = playlistImportMetadataSchema.parse(await spotifyJson(token, `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}?fields=id,name`));
    const occurrences = []; let sourcePosition = 0; let next: string | null = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items?limit=100&fields=items(added_at,item(id,name,duration_ms,artists(name),album(name))),next`;
    while (next) { const page = pageSchema.parse(await spotifyJson(token, next)); for (const item of page.items) { occurrences.push(occurrenceFromSpotifyItem(playlistItemSchema.parse(item), sourcePosition)); sourcePosition += 1; } next = page.next; }
    snapshots.push(makePrivatePlaylistSnapshot({ playlist: { id: metadata.id, name: metadata.name }, importedAt: new Date().toISOString(), occurrences }));
  }
  return snapshots;
}
