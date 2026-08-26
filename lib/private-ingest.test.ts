import { describe, expect, it } from "vitest";
import { inspectAndMinimiseTimeline, minimiseEchoesExport, minimiseGoogleCalendarIcs, minimiseGoogleMapsLabeledPlaces, minimiseLastFmHistory, minimiseSpotifyHistory, minimiseYouTubeWatchHistoryHtml } from "@/lib/private-ingest";

describe("private import minimisation", () => {
  it("removes Spotify identifiers and device/location fields", () => {
    const { document, summary } = minimiseSpotifyHistory([{ ts: "2026-08-01T12:00:00Z", ms_played: 1000, spotify_track_uri: "spotify:track:abc", master_metadata_track_name: "Test", ip_addr: "127.0.0.1", username: "secret", user_agent: "device" }], "2026-08-02T00:00:00Z");
    expect(document.records[0]).not.toHaveProperty("ip_addr"); expect(document.records[0]).not.toHaveProperty("username"); expect(summary.discardedFields).toContain("ip_addr");
  });
  it("distinguishes visits and routes and retains uncertainty", () => {
    const result = inspectAndMinimiseTimeline({ timelineObjects: [{ placeVisit: { location: { latitudeE7: 481234567, longitudeE7: 141234567, accuracy: 70 }, duration: { startTimestamp: "2026-08-01T12:00:00Z" } } }, { activitySegment: { startLocation: { latitudeE7: 481234567, longitudeE7: 141234567 }, duration: { startTimestamp: "2026-08-01T13:00:00Z" } } }] }, "2026-08-02T00:00:00Z");
    expect(result.document.records.map((record) => record.kind)).toEqual(["visit", "route"]);
    expect(result.document.records[0].certainty).toBe("platform-inferred");
    expect(result.document.records[0].accuracyMeters).toBe(70);
  });
  it("combines selected Timeline JSON files into one minimised import", () => {
    const result = inspectAndMinimiseTimeline([
      { timelineObjects: [{ placeVisit: { location: { name: "First place" }, duration: { startTimestamp: "2026-08-01T12:00:00Z" } } }] },
      { semanticSegments: [{ visit: { placeLocation: { name: "Second place" }, startTime: "2026-08-02T12:00:00Z" } }] },
    ], "2026-08-03T00:00:00Z");
    expect(result.document.records).toHaveLength(2);
    expect(result.summary.schemaEncountered).toContain("multiple files");
  });
  it("minimises the current iOS on-device Timeline export without its raw paths or memories", () => {
    const result = inspectAndMinimiseTimeline([
      { startTime: "2026-08-01T12:00:00Z", endTime: "2026-08-01T13:00:00Z", visit: { topCandidate: { placeID: "private-place-id", placeLocation: "geo:44.4268,26.1025", probability: "0.9", semanticType: "PLACE" }, probability: "0.9", hierarchyLevel: "0" } },
      { startTime: "2026-08-01T13:00:00Z", endTime: "2026-08-01T14:00:00Z", activity: { start: "geo:44.4268,26.1025", end: "geo:44.4350,26.1100", distanceMeters: "900", topCandidate: { type: "WALKING", probability: "0.8" } } },
      { startTime: "2026-08-01T14:00:00Z", endTime: "2026-08-01T15:00:00Z", timelinePath: [{ point: "geo:44.4,26.1", durationMinutesOffsetFromStartTime: "0" }] },
      { startTime: "2026-08-01T15:00:00Z", endTime: "2026-08-01T16:00:00Z", timelineMemory: { distanceFromOriginKms: "2" } },
    ], "2026-08-02T00:00:00Z");
    expect(result.summary).toMatchObject({ schemaEncountered: "ios-on-device-timeline-array", total: 4, retained: 2 });
    expect(result.document.records).toEqual([
      expect.objectContaining({ kind: "visit", latitude: 44.4268, longitude: 26.1025, certainty: "platform-inferred" }),
      expect.objectContaining({ kind: "route", latitude: 44.4268, longitude: 26.1025, travelMode: "WALKING", certainty: "platform-inferred" }),
    ]);
    expect(JSON.stringify(result.document)).not.toContain("private-place-id");
    expect(JSON.stringify(result.document)).not.toContain("timelinePath");
  });
  it("minimises Semantic Timeline stops and activity windows without route points", () => {
    const result = inspectAndMinimiseTimeline({ semanticSegments: [
      { startTime: "2026-08-01T12:00:00Z", endTime: "2026-08-01T13:00:00Z", visit: { placeLocation: "geo:44.4268,26.1025" } },
      { startTime: "2026-08-01T13:00:00Z", endTime: "2026-08-01T14:00:00Z", activity: { start: "geo:44.4268,26.1025", end: "geo:44.4350,26.1100", topCandidate: { type: "WALKING" }, routePoints: [{ lat: 44.4 }] } },
    ] }, "2026-08-02T00:00:00Z");
    expect(result.document.records).toEqual([
      expect.objectContaining({ kind: "visit", latitude: 44.4268, longitude: 26.1025, certainty: "platform-inferred" }),
      expect.objectContaining({ kind: "route", latitude: 44.4268, longitude: 26.1025, travelMode: "WALKING", certainty: "reported" }),
    ]);
    expect(JSON.stringify(result.document)).not.toContain("routePoints");
  });
  it("keeps only completed, timestamped Last.fm scrobbles", () => {
    const result = minimiseLastFmHistory({ recenttracks: { track: [
      { name: "Recorded track", artist: { "#text": "Recorded artist" }, album: { "#text": "Album" }, date: { uts: "1785585600" }, url: "https://example.test/track" },
      { name: "Now playing", artist: { "#text": "Artist" }, "@attr": { nowplaying: "true" } },
    ] } }, "2026-08-02T00:00:00Z");
    expect(result.document.records).toEqual([expect.objectContaining({ trackName: "Recorded track", artistName: "Recorded artist", albumName: "Album" })]);
    expect(result.document.records[0]).not.toHaveProperty("url");
    expect(result.summary.discardedFields).toContain("now-playing row");
  });
  it("deduplicates matching Last.fm scrobble rows across pages", () => {
    const track = { name: "Recorded track", artist: { "#text": "Recorded artist" }, album: { "#text": "Album" }, date: { uts: "1785585600" } };
    const result = minimiseLastFmHistory({ recenttracks: { track: [track, track] } }, "2026-08-02T00:00:00Z");
    expect(result.document.records).toHaveLength(1);
    expect(result.summary.warnings).toContain("1 duplicate timestamped row(s) were omitted.");
  });
  it("minimises Calendar Takeout events with Author-selected location and description but not invitees", () => {
    const result = minimiseGoogleCalendarIcs(["BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;TZID=Europe/Bucharest:20260826T200000\r\nDTEND;TZID=Europe/Bucharest:20260826T210000\r\nSUMMARY:Creative technology event\\, example city\r\nLOCATION:Private venue\r\nDESCRIPTION:Bring notes\\nand sketchbook\r\nATTENDEE:mailto:private@example.test\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n"], "2026-08-27T00:00:00Z");
    expect(result.document.records[0]).toEqual(expect.objectContaining({ title: "Creative technology event, example city", location: "Private venue", description: "Bring notes\nand sketchbook", startsWhen: "2026-08-26T20:00:00[Europe/Bucharest]", timeInterpretation: "local-with-declared-timezone" }));
    expect(JSON.stringify(result.document)).not.toContain("private@example.test");
  });
  it("keeps Maps labeled places without Google URLs or IDs", () => {
    const result = minimiseGoogleMapsLabeledPlaces({ type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "Studio", url: "https://maps.example" }, geometry: { type: "Point", coordinates: [26.1, 44.4] } }] }, "2026-08-27T00:00:00Z");
    expect(result.document.records).toEqual([expect.objectContaining({ label: "Studio", latitude: 44.4, longitude: 26.1 })]);
    expect(JSON.stringify(result.document)).not.toContain("maps.example");
  });
  it("minimises YouTube history without retaining a video URL", () => {
    const result = minimiseYouTubeWatchHistoryHtml('<div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1"><a href="https://www.youtube.com/watch?v=secret">A creative-tech talk</a><br><a href="https://www.youtube.com/channel/secret">A channel</a><br>Aug 26, 2026, 10:00:00 AM EEST</div>', "2026-08-27T00:00:00Z");
    expect(result.document.records).toEqual([expect.objectContaining({ title: "A creative-tech talk", channel: "A channel" })]);
    expect(JSON.stringify(result.document)).not.toContain("youtube.com");
  });
  it("minimises a local ECHOES export without account fields", () => {
    const result = minimiseEchoesExport({ walks: [{ type: "walk", name: "Sound walk", description: "A draft", latitude: 44.4, longitude: 26.1, token: "private" }] }, "2026-08-27T00:00:00Z");
    expect(result.document.records).toEqual([expect.objectContaining({ kind: "walk", title: "Sound walk", description: "A draft" })]);
    expect(JSON.stringify(result.document)).not.toContain("private");
  });
});
