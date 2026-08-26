import { describe, expect, it } from "vitest";
import { buildAtlasNow } from "@/lib/private-atlas";
import type { VaultRecord } from "@/lib/private-vault";

const capturedAt = "2026-08-26T12:00:00.000Z";

describe("Atlas of Now", () => {
  it("shows new source changes and explicit multi-layer overlap without creating canon", () => {
    const records: VaultRecord[] = [
      { id: "import:timeline", kind: "import", capturedAt, payload: { source: "google-timeline", importedAt: capturedAt, document: { records: [{ kind: "visit", locationLabel: "Festival site" }] } } },
      { id: "capture:festival", kind: "capture", capturedAt, payload: { reviewStatus: "pending", title: "Festival volunteering", evidence: "Festival volunteer shift" } },
    ];
    const atlas = buildAtlasNow(records, "2026-08-26T12:01:00.000Z");
    expect(atlas.canonical).toBe(false);
    expect(atlas.whatChanged).toEqual(expect.arrayContaining([expect.objectContaining({ id: "new:import:timeline" })]));
    expect(atlas.convergences).toEqual(expect.arrayContaining([expect.objectContaining({ id: "convergence:festival-infrastructure" })]));
    expect(atlas.needsYou).toEqual(expect.arrayContaining([expect.objectContaining({ id: "timeline-review" }), expect.objectContaining({ id: "pending-captures" })]));
  });
  it("reports an unchanged import as refreshed rather than new", () => {
    const record: VaultRecord = { id: "import:timeline", kind: "import", capturedAt, payload: { source: "google-timeline", importedAt: capturedAt, document: { records: [{ kind: "visit" }] } } };
    const previous = buildAtlasNow([record], "2026-08-26T12:01:00.000Z");
    const refreshed = buildAtlasNow([{ ...record, payload: { ...record.payload as object, importedAt: "2026-08-26T13:00:00.000Z" } }], "2026-08-26T13:01:00.000Z", previous);
    expect(refreshed.whatChanged).toEqual([expect.objectContaining({ id: "refreshed:import:timeline" })]);
  });
  it("keeps a private editorial draft visible as new until Atlas is opened and acknowledges it", () => {
    const draft: VaultRecord = { id: "editorial-draft:one", kind: "editorial-draft", capturedAt, payload: { title: "Private draft", publicationStatus: "unpublished" } };
    const before = buildAtlasNow([], "2026-08-26T12:00:00.000Z");
    const changed = buildAtlasNow([draft], "2026-08-26T12:01:00.000Z", before);
    expect(changed.whatChanged).toEqual(expect.arrayContaining([expect.objectContaining({ id: "new:editorial-draft:one", title: "New private editorial source" })]));
    const acknowledged = { ...changed, acknowledgedImports: changed.imports, acknowledgedSourceIds: [draft.id] };
    const reopened = buildAtlasNow([draft], "2026-08-26T12:02:00.000Z", acknowledged);
    expect(reopened.whatChanged).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: "new:editorial-draft:one" })]));
  });
  it("ranks only source-linked Timeline place candidates without making them facts", () => {
    const records: VaultRecord[] = [
      { id: "import:google-timeline:v1", kind: "import", capturedAt, payload: { source: "google-timeline", importedAt: capturedAt, document: { records: [{ kind: "visit", startAt: "2026-08-26T10:00:00.000Z", endAt: "2026-08-26T11:00:00.000Z", latitude: 44.4268, longitude: 26.1025, accuracyMeters: 50 }] } } },
      { id: "import:google-takeout-maps:v1", kind: "import", capturedAt, payload: { source: "google-takeout-maps", importedAt: capturedAt, document: { records: [{ label: "Saved studio", latitude: 44.4269, longitude: 26.1026 }] } } },
      { id: "import:google-takeout-calendar:v1", kind: "import", capturedAt, payload: { source: "google-takeout-calendar", importedAt: capturedAt, document: { records: [{ startsWhen: "2026-08-26T10:30:00.000Z", endsWhen: "2026-08-26T11:30:00.000Z", location: "Calendar venue" }] } } },
    ];
    const atlas = buildAtlasNow(records, "2026-08-26T12:01:00.000Z");
    expect(atlas.placeCoverage).toMatchObject({ timelineWindows: 1, windowsWithCandidates: 1 });
    expect(atlas.placeReadings[0]).toMatchObject({ resolution: "competing-candidates" });
    expect(atlas.placeReadings[0].candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Calendar venue", evidence: "same-time-calendar", sourceRecordId: "import:google-takeout-calendar:v1" }),
      expect.objectContaining({ label: "Saved studio", evidence: "nearby-saved-place", sourceRecordId: "import:google-takeout-maps:v1" }),
    ]));
    expect(atlas.placeReadings[0].caveat).toContain("not a confirmed venue");
  });
  it("streams a large Timeline into bounded Atlas readings", () => {
    function* windows() {
      for (let index = 0; index < 15_725; index += 1) yield { kind: "visit", startAt: `2026-08-${String((index % 28) + 1).padStart(2, "0")}T10:00:00.000Z`, locationLabel: `Retained label ${index}` };
    }
    const records: VaultRecord[] = [{ id: "import:google-timeline:v1", kind: "import", capturedAt, payload: { source: "google-timeline", importedAt: capturedAt, summary: { retained: 15_725 }, storage: "timeline-chunk-manifest-v1", document: { schemaVersion: 2, recordCount: 15_725, chunkCount: 62 } } }];
    const atlas = buildAtlasNow(records, "2026-08-26T12:01:00.000Z", undefined, { timelineWindows: windows() });
    expect(atlas.imports).toEqual(expect.arrayContaining([expect.objectContaining({ id: "import:google-timeline:v1", retained: 15_725 })]));
    expect(atlas.placeCoverage).toEqual({ timelineWindows: 15_725, windowsWithCandidates: 15_725, directTimelineLabels: 15_725 });
    expect(atlas.placeReadings).toHaveLength(12);
    expect(atlas.placeReadings[0]?.when).toContain("2026-08-28");
  });
  it("summarises a Side Quest snapshot and its source rows as one import", () => {
    const records: VaultRecord[] = [
      { id: "side-quest:snapshot:abc", kind: "import", capturedAt, payload: { source: "side-quest-control-room", sourceHash: "abc", importedAt: capturedAt, data: { counts: {} } } },
      { id: "side-quest:job:one", kind: "import", capturedAt, payload: { source: "side-quest-control-room", sourceHash: "abc", importedAt: capturedAt, entityGroup: "job", record: { id: "one" } } },
      { id: "side-quest:study:two", kind: "import", capturedAt, payload: { source: "side-quest-control-room", sourceHash: "abc", importedAt: capturedAt, entityGroup: "study-programme", record: { id: "two" } } },
    ];
    const atlas = buildAtlasNow(records, "2026-08-26T12:01:00.000Z");
    expect(atlas.imports).toEqual([expect.objectContaining({ id: "side-quest:snapshot:abc", source: "side-quest-control-room", retained: 2 })]);
  });
  it("keeps a selected Maps list visible as a source-specific evidence lane", () => {
    const records: VaultRecord[] = [{ id: "import:google-maps-list:abc", kind: "import", capturedAt, payload: { source: "google-maps-takeout-saved-list", importedAt: capturedAt, document: { records: [{ kind: "saved-list-place", label: "Selected place" }] } } }];
    const atlas = buildAtlasNow(records, "2026-08-26T12:01:00.000Z");
    expect(atlas.lanes).toEqual(expect.arrayContaining([expect.objectContaining({ id: "selected-maps-list", evidenceCount: 1, sourceRecordIds: ["import:google-maps-list:abc"] })]));
  });
  it("does not feed a saved Scenario Studio constellation back into Atlas evidence", () => {
    const records: VaultRecord[] = [
      { id: "capture:festival", kind: "capture", capturedAt, payload: { title: "Festival source", evidence: "festival" } },
      { id: "scenario-studio:constellation:v1", kind: "scenario-studio", capturedAt: "2026-08-27T00:00:00.000Z", payload: { title: "Scenario mentioning a programme and a city" } },
    ];
    const atlas = buildAtlasNow(records, "2026-08-27T00:01:00.000Z");
    expect(atlas.sourceRecordCount).toBe(1);
    expect(atlas.lanes.find((lane) => lane.id === "festival-infrastructure")?.sourceRecordIds).toEqual(["capture:festival"]);
  });
});
