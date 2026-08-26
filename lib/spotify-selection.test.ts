import { describe, expect, it } from "vitest";
import { rankPlaylistsByRecentListening, rankRecentPlaylistContexts, recommendOwnedPlaylists } from "@/lib/spotify-selection";

describe("Spotify onboarding selection", () => {
  it("prefers non-collaborative playlists owned by the connected account and explains the ranking", () => {
    const selected = recommendOwnedPlaylists("me", [
      { id: "a", name: "Small", ownerId: "me", collaborative: false, tracksTotal: 4, trackIds: ["one", "two"] },
      { id: "b", name: "Shared", ownerId: "me", collaborative: true, tracksTotal: 100, trackIds: ["one", "two", "three"] },
      { id: "c", name: "Elsewhere", ownerId: "friend", collaborative: false, tracksTotal: 100, trackIds: ["one", "two"] },
      { id: "d", name: "Strong", ownerId: "me", collaborative: false, tracksTotal: 8, trackIds: ["one", "two", "three"] },
    ], ["one", "two", "three"]);
    expect(selected.map((playlist) => playlist.id)).toEqual(["d", "a"]);
    expect(selected[0].recentPlayOverlap).toBe(3);
  });

  it("can rank non-collaborative library candidates when Spotify cannot confirm ownership", () => {
    const selected = rankPlaylistsByRecentListening([
      { id: "a", name: "Earlier", ownerId: "someone", collaborative: false, tracksTotal: 4, trackIds: ["one"] },
      { id: "b", name: "Recent", ownerId: "someone-else", collaborative: false, tracksTotal: 2, trackIds: ["one", "two"] },
    ], ["one", "two"]);
    expect(selected.map((playlist) => playlist.id)).toEqual(["b", "a"]);
  });

  it("keeps actual playlist playback contexts distinct from track overlap", () => {
    expect(rankRecentPlaylistContexts(["alpha123456", "beta1234567", "alpha123456", "beta1234567", "gamma123456"])).toEqual([
      { id: "alpha123456", playCount: 2 },
      { id: "beta1234567", playCount: 2 },
      { id: "gamma123456", playCount: 1 },
    ]);
  });
});
