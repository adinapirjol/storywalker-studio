export type SpotifyPlaylistCandidate = {
  id: string;
  name: string;
  ownerId: string;
  collaborative: boolean;
  tracksTotal: number;
  trackIds: string[];
  /** A live Spotify presentation value. It is never a Vault field. */
  coverImageUrl?: string;
  /** Kept only for the current selector so the Author can inspect Spotify. */
  spotifyUrl?: string;
};

export type PlaylistRecommendation = SpotifyPlaylistCandidate & { recentPlayOverlap: number };

export type RecentPlaylistContext = { id: string; playCount: number };

/**
 * A playlist URI in Spotify's recent-play response is a real playback context,
 * unlike a track membership comparison. Keep the first occurrence as the
 * recency tiebreaker while still preferring repeat contexts.
 */
export function rankRecentPlaylistContexts(playlistIds: string[], limit = 4): RecentPlaylistContext[] {
  const counts = new Map<string, { playCount: number; firstIndex: number }>();
  playlistIds.forEach((id, index) => {
    const current = counts.get(id);
    counts.set(id, current ? { ...current, playCount: current.playCount + 1 } : { playCount: 1, firstIndex: index });
  });
  return [...counts.entries()]
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => b.playCount - a.playCount || a.firstIndex - b.firstIndex || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map(({ id, playCount }) => ({ id, playCount }));
}

export function rankPlaylistsByRecentListening(
  playlists: SpotifyPlaylistCandidate[],
  recentlyPlayedTrackIds: string[],
  limit = 4,
): PlaylistRecommendation[] {
  const recent = new Set(recentlyPlayedTrackIds);
  return playlists
    .map((playlist) => ({ ...playlist, recentPlayOverlap: playlist.trackIds.filter((trackId) => recent.has(trackId)).length }))
    .sort((a, b) => b.recentPlayOverlap - a.recentPlayOverlap || b.tracksTotal - a.tracksTotal || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

/**
 * Choose an explainable starting set: playlists owned by the connected account,
 * ranked by their overlap with recently played tracks. Spotify does not expose a
 * portable "last edited" playlist field, so we never claim this means recently
 * edited or objectively best. The person confirms the final four.
 */
export function recommendOwnedPlaylists(
  accountId: string,
  playlists: SpotifyPlaylistCandidate[],
  recentlyPlayedTrackIds: string[],
  limit = 4,
): PlaylistRecommendation[] {
  return rankPlaylistsByRecentListening(
    playlists.filter((playlist) => playlist.ownerId === accountId && !playlist.collaborative),
    recentlyPlayedTrackIds,
    limit,
  );
}
