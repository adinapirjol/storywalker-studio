/** Scenario Studio holds possible routes side by side. It deliberately has no
 * score, recommendation, or single "best" path: time, conditions and links
 * remain inspectable and revisable by the Author. */
export type ScenarioPathway = {
  id: string;
  title: string;
  timing: string;
  currentCondition: string;
  connectedPathwayIds: string[];
};

export type ScenarioConnection = {
  id: string;
  pathwayIds: string[];
  note: string;
};

export type AtlasLaneSelection = Record<string, string[]>;
export type AtlasLaneSelectionInput = { id: string; sourceRecordIds: string[] };
const UNASSIGNED_EVIDENCE_SELECTION = "__preserved-unassigned-evidence__";

function uniqueIds(ids: string[]) { return [...new Set(ids)]; }

/**
 * Convert a legacy flat source list to independent, lane-addressed choices.
 * Records not represented by the current Atlas lanes stay in a private
 * preservation bucket so opening Scenario Studio cannot silently drop them.
 */
export function normaliseAtlasLaneSelections(lanes: AtlasLaneSelectionInput[], sourceRecordIds: string[], saved?: AtlasLaneSelection): AtlasLaneSelection {
  const available = new Map(lanes.map((lane) => [lane.id, new Set(lane.sourceRecordIds)]));
  const result: AtlasLaneSelection = {};
  for (const [laneId, ids] of Object.entries(saved ?? {})) {
    const laneIds = available.get(laneId);
    if (laneId === UNASSIGNED_EVIDENCE_SELECTION) result[laneId] = uniqueIds(ids);
    else if (laneIds && ids.length && ids.every((id) => laneIds.has(id))) result[laneId] = uniqueIds(ids);
  }
  // An empty object was emitted by the first client migration. Treat it as
  // legacy while source IDs exist, so those already-selected lanes are not
  // rendered as unlinked or dropped on the next save.
  if (!saved || !Object.keys(saved).length) {
    const selected = new Set(sourceRecordIds);
    for (const lane of lanes) if (lane.sourceRecordIds.length && lane.sourceRecordIds.every((id) => selected.has(id))) result[lane.id] = uniqueIds(lane.sourceRecordIds);
  }
  const represented = new Set(Object.values(result).flat());
  const unassigned = sourceRecordIds.filter((id) => !represented.has(id));
  if (unassigned.length) result[UNASSIGNED_EVIDENCE_SELECTION] = uniqueIds([...(result[UNASSIGNED_EVIDENCE_SELECTION] ?? []), ...unassigned]);
  return result;
}

export function sourceIdsForLaneSelections(selections: AtlasLaneSelection) { return uniqueIds(Object.values(selections).flat()); }

/** Each action addresses one stable Atlas lane ID. Shared source records stay
 * selected while any other independently-linked lane still references them. */
export function toggleAtlasLaneSelection(selections: AtlasLaneSelection, lane: AtlasLaneSelectionInput) {
  const next = { ...selections };
  if (next[lane.id]) delete next[lane.id];
  else next[lane.id] = uniqueIds(lane.sourceRecordIds);
  return { atlasLaneSelections: next, atlasSourceRecordIds: sourceIdsForLaneSelections(next) };
}

export type ScenarioConstellation = {
  schemaVersion: 1;
  kind: "storywalker-scenario-constellation";
  privacy: "private";
  canonical: false;
  status: "author-draft";
  title: string;
  framing: string;
  pathways: ScenarioPathway[];
  connections: ScenarioConnection[];
  atlasSourceRecordIds: string[];
  atlasLaneSelections?: AtlasLaneSelection;
  savedAt: string;
  boundary: string;
};

export function emptyConstellation(): Omit<ScenarioConstellation, "savedAt"> {
  return {
    schemaVersion: 1,
    kind: "storywalker-scenario-constellation",
    privacy: "private",
    canonical: false,
    status: "author-draft",
    title: "My possible routes",
    framing: "These pathways can overlap, support, constrain or change one another. None is ranked as the right life.",
    pathways: [],
    connections: [],
    atlasSourceRecordIds: [],
    boundary: "Scenario Studio stores authored plans and explicit links to evidence. It does not predict outcomes, infer commitment, create an Episode, or promote anything to public work.",
  };
}
