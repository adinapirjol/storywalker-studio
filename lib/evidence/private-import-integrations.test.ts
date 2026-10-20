import { describe, expect, it } from "vitest";
import { makePrivatePlaylistSnapshot } from "../music/private-playlist";
import {
  LASTFM_PAGE_SIZE,
  latestSpotifySnapshotsByPlaylist,
  mergeLastFmHistory,
  parseLastFmPage,
  playlistOccurrencesWithinWindow,
  readBoundedLastFmJson,
} from "./private-import-integrations";

describe("private import integration boundaries", () => {
  it("discards the extra now-playing row while preserving a full page of completed scrobbles", () => {
    const completed = Array.from({ length: LASTFM_PAGE_SIZE }, (_, id) => ({ name: `Fictional ${id}` }));
    const live = { name: "Live fictional track", "@attr": { nowplaying: "true" }, date: { uts: "1234567890" } };
    expect(parseLastFmPage({ recenttracks: { track: [live, ...completed], "@attr": { totalPages: "2" } } }).tracks).toEqual(completed);
    expect(parseLastFmPage({ recenttracks: { track: [live], "@attr": { totalPages: "0" } } }).tracks).toEqual([]);
    expect(() => parseLastFmPage({ recenttracks: { track: [live, live], "@attr": { totalPages: "1" } } })).toThrow("more rows than requested");
  });
  it("accepts an empty Last.fm response and rejects oversized or changing pages", () => {
    expect(parseLastFmPage({ recenttracks: { track: [], "@attr": { totalPages: "0" } } })).toEqual({ tracks: [], totalPages: 0 });
    expect(() => parseLastFmPage({ recenttracks: { track: Array(LASTFM_PAGE_SIZE + 1).fill({}), "@attr": { totalPages: "1" } } })).toThrow("more rows than requested");
    expect(() => parseLastFmPage({ recenttracks: { track: [], "@attr": { totalPages: "2" } } }, 1)).toThrow("pagination changed");
  });

  it("rejects an oversized response body before decoding it", async () => {
    const response = new Response(JSON.stringify({ payload: "x".repeat(128) }));
    await expect(readBoundedLastFmJson(response, 32)).rejects.toThrow("size limit");
  });

  it("merges fictional Last.fm history without dropping prior rows or duplicating the same scrobble", () => {
    const oldRecord = { playedAt: "2026-09-01T00:00:00.000Z", trackName: "Sample One", artistName: "Example Artist", importerProvenance: "fictional fixture" };
    const newRecord = { ...oldRecord, playedAt: "2026-10-01T00:00:00.000Z" };
    expect(mergeLastFmHistory({ schemaVersion: 1, source: "lastfm-scrobbles", importedAt: "2026-10-01T00:00:00.000Z", records: [oldRecord] }, [newRecord, newRecord])).toEqual([oldRecord, newRecord]);
  });

  it("selects the latest playlist snapshot and retains duplicate occurrences by source position", () => {
    const playlist = { id: "fictionalplaylist000000", name: "Fictional set" };
    const earlier = makePrivatePlaylistSnapshot({ playlist, importedAt: "2026-10-01T00:00:00.000Z", occurrences: [
      { sourcePosition: 0, addedAt: "2026-09-20T00:00:00.000Z", availability: "available", trackId: "same-track", trackName: "Sample", artistNames: ["Example"], albumName: "Demo", durationMs: 1000 },
    ] });
    const latest = makePrivatePlaylistSnapshot({ playlist, importedAt: "2026-10-02T00:00:00.000Z", occurrences: [
      { sourcePosition: 0, addedAt: "2026-09-20T00:00:00.000Z", availability: "available", trackId: "same-track", trackName: "Sample", artistNames: ["Example"], albumName: "Demo", durationMs: 1000 },
      { sourcePosition: 1, addedAt: "2026-09-20T00:00:00.000Z", availability: "available", trackId: "same-track", trackName: "Sample", artistNames: ["Example"], albumName: "Demo", durationMs: 1000 },
    ] });
    const selected = latestSpotifySnapshotsByPlaylist([earlier, latest]);
    expect(selected).toEqual([latest]);
    expect(playlistOccurrencesWithinWindow(selected[0], Date.parse("2026-09-18T00:00:00Z"), Date.parse("2026-10-19T00:00:00Z"))).toHaveLength(2);
  });
});
