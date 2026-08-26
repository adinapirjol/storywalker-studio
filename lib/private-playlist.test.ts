import { describe, expect, it } from "vitest";
import {
  chronologicalOccurrences,
  diffPrivatePlaylistSnapshots,
  makePrivatePlaylistSnapshot,
  occurrenceFromSpotifyItem,
} from "@/lib/private-playlist";

const available = (id: string, addedAt: string | null) => occurrenceFromSpotifyItem({
  added_at: addedAt,
  item: { id, name: `Track ${id}`, artists: [{ name: "Fictional Artist" }], album: { name: "Fictional Album" }, duration_ms: 120_000 },
}, 0);

describe("private Spotify playlist snapshots", () => {
  it("retains duplicate songs as separate ordered occurrences", () => {
    const first = available("same-track", "2026-01-03T00:00:00Z");
    const second = { ...available("same-track", "2026-01-01T00:00:00Z"), sourcePosition: 1 };
    const snapshot = makePrivatePlaylistSnapshot({ playlist: { id: "abc", name: "Private playlist" }, importedAt: "2026-08-23T00:00:00Z", occurrences: [first, second] });
    expect(snapshot.occurrenceCount).toBe(2);
    expect(snapshot.occurrences.map((item) => item.trackId)).toEqual(["same-track", "same-track"]);
    expect(snapshot.occurrences.map((item) => item.sourcePosition)).toEqual([0, 1]);
    expect(chronologicalOccurrences(snapshot.occurrences).map((item) => item.sourcePosition)).toEqual([1, 0]);
  });

  it("reports missing timestamps and unavailable items rather than dropping them", () => {
    const missing = available("dated-later", null);
    const unavailable = occurrenceFromSpotifyItem({ added_at: "2026-01-02T00:00:00Z", item: null }, 1);
    const snapshot = makePrivatePlaylistSnapshot({ playlist: { id: "abc", name: "Private playlist" }, importedAt: "2026-08-23T00:00:00Z", occurrences: [missing, unavailable] });
    expect(snapshot.missingTimestampPositions).toEqual([0]);
    expect(snapshot.unavailablePositions).toEqual([1]);
    expect(snapshot.occurrences).toHaveLength(2);
  });

  it("diffs actual occurrence positions without deduplicating track IDs", () => {
    const old = makePrivatePlaylistSnapshot({ playlist: { id: "abc", name: "Private playlist" }, importedAt: "2026-08-22T00:00:00Z", occurrences: [available("same-track", "2026-01-01T00:00:00Z")] });
    const current = makePrivatePlaylistSnapshot({ playlist: { id: "abc", name: "Private playlist" }, importedAt: "2026-08-23T00:00:00Z", occurrences: [available("same-track", "2026-01-01T00:00:00Z"), { ...available("same-track", "2026-01-02T00:00:00Z"), sourcePosition: 1 }] });
    expect(diffPrivatePlaylistSnapshots(old, current)).toMatchObject({ previousOccurrenceCount: 1, currentOccurrenceCount: 2, addedPositions: [1], removedPositions: [], changedPositions: [] });
  });
});
