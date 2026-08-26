import { describe, expect, it } from "vitest";
import { emptyConstellation, normaliseAtlasLaneSelections, sourceIdsForLaneSelections, toggleAtlasLaneSelection, type AtlasLaneSelectionInput } from "@/lib/scenario-studio";

describe("Scenario Studio", () => {
  it("starts as a private, non-canonical constellation without choosing a route", () => {
    const scenario = emptyConstellation();
    expect(scenario).toMatchObject({ privacy: "private", canonical: false, status: "author-draft" });
    expect(scenario.pathways).toEqual([]);
    expect(scenario.framing).toContain("None is ranked");
  });

  it("removes only the explicitly addressed evidence lane, including when lanes share source IDs", () => {
    const lanes: AtlasLaneSelectionInput[] = [
      { id: "creative-tech-study", sourceRecordIds: ["creative", "shared-study-relocation"] },
      { id: "relocation-career", sourceRecordIds: ["relocation", "shared-study-relocation", "shared-relocation-music"] },
      { id: "festival-infrastructure", sourceRecordIds: ["festival"] },
      { id: "music-listening", sourceRecordIds: ["music", "shared-relocation-music"] },
      { id: "public-practice", sourceRecordIds: ["public"] },
      { id: "selected-maps-list", sourceRecordIds: ["saved-maps"] },
    ];
    const allSelected = Object.fromEntries(lanes.map((lane) => [lane.id, lane.sourceRecordIds]));

    for (const lane of lanes) {
      const changed = toggleAtlasLaneSelection(allSelected, lane);
      expect(changed.atlasLaneSelections[lane.id]).toBeUndefined();
      for (const other of lanes.filter((candidate) => candidate.id !== lane.id)) expect(changed.atlasLaneSelections[other.id]).toEqual(other.sourceRecordIds);
      expect(changed.atlasSourceRecordIds).toEqual(sourceIdsForLaneSelections(changed.atlasLaneSelections));
      for (const other of lanes.filter((candidate) => candidate.id !== lane.id)) for (const sourceId of other.sourceRecordIds) expect(changed.atlasSourceRecordIds).toContain(sourceId);
    }
  });

  it("migrates an empty first-generation lane map without losing legacy evidence selections", () => {
    const lanes: AtlasLaneSelectionInput[] = [
      { id: "festival", sourceRecordIds: ["festival-source"] },
      { id: "maps", sourceRecordIds: ["maps-source"] },
    ];
    expect(normaliseAtlasLaneSelections(lanes, ["festival-source", "maps-source"], {})).toEqual({ festival: ["festival-source"], maps: ["maps-source"] });
  });
});
