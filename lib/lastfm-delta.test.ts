import { describe, expect, it } from "vitest";
import { mergeLastFmDelta } from "./lastfm-delta";
const existing = { schemaVersion: 1, source: "lastfm-scrobbles", importedAt: "2026-08-01T00:00:00Z", records: [{ playedAt: "2026-08-01T12:00:00.000Z", trackName: "Track", artistName: "Artist", albumName: "Album", importerProvenance: "fixture" }] };
const track = (date: string) => ({ name: "Track", artist: { "#text": "Artist" }, album: { "#text": "Album" }, date: { uts: String(Date.parse(date) / 1000) } });
it("merges without replacing history, deduplicates overlap and rejects out-of-window rows", () => {
  const raw = { recenttracks: { track: [track("2026-08-01T12:00:00Z"), track("2026-08-02T12:00:00Z"), track("2026-08-03T12:00:00Z"), { name: "Now playing" }] } };
  const result = mergeLastFmDelta(existing, raw, "2026-08-01T11:59:59Z", "2026-08-02T23:59:59Z", "2026-08-03T00:00:00Z");
  expect(result.added).toBe(1); expect(result.overlap).toBe(1); expect(result.outsideWindow).toBe(1); expect(result.total).toBe(2);
  expect(result.document.records[0]).toEqual(existing.records[0]);
  expect(mergeLastFmDelta(result.document, raw, "2026-08-01T11:59:59Z", "2026-08-02T23:59:59Z", "2026-08-03T00:00:00Z").added).toBe(0);
});
describe("delta validation", () => { it("rejects invalid windows before returning data", () => { expect(() => mergeLastFmDelta(existing, {}, "invalid", "invalid", "2026-08-03T00:00:00Z")).toThrow("Invalid delta window"); }); });
