import { describe, expect, it } from "vitest";
import { attachNotionEvidence, journeyEpisodeSchema, notionEvidenceSchema, type JourneyEpisode } from "./journey-episode";
import { DEMO_XR_SCENE, parseSceneFile, reviewExport } from "./xr-scene";

const page = { pageId: "fixture-page", title: "Prototype published", date: "2026-07-07", locationLabel: "City A–City B", sourceDatabase: "Projects", contentSummary: "A publication milestone recorded in the page." };
const episode = (): JourneyEpisode => journeyEpisodeSchema.parse({
  id: "stop-1", label: "Author label", start: "2026-07-07T00:00:00Z", end: "2026-07-08T00:00:00Z", timeZone: "UTC", routeOrder: 0,
  provenance: { nodes: [
    { id: "trace", type: "timeline", sourceId: "fixture-timeline:1", start: "2026-07-07T00:00:00Z", end: "2026-07-08T00:00:00Z", coordinates: { latitude: 45, longitude: 7 }, certainty: "platform-inferred" },
    { id: "author", type: "author", sourceId: "fixture-statement", statement: "My closing episode" },
    { id: "calendar", type: "calendar", sourceId: "fixture-event", start: "2026-07-07T10:00:00Z", end: "2026-07-07T11:00:00Z" },
    { id: "music", type: "lastfm", sourceId: "fixture-listening", start: "2026-07-07T10:00:00Z", end: "2026-07-07T11:00:00Z" },
  ], edges: [
    { evidenceId: "trace", role: "physical-geography", basis: "source-record" },
    { evidenceId: "author", role: "authored-context", basis: "author-confirmed" },
    { evidenceId: "calendar", role: "temporal-context", basis: "temporal-overlap" },
    { evidenceId: "music", role: "listening-observation", basis: "temporal-overlap" },
  ] },
  worldPosition: { position: { x: 1, y: 0, z: 2 }, projection: "fixture-local-projection", evidenceIds: ["trace"] }, memoryPosition: { x: 4, y: 0, z: 8 },
});

describe("JourneyEpisode contextual evidence", () => {
  it("enriches context without moving, renaming or mutating the episode; preserves five independent sources on export", () => {
    const original = episode();
    const result = attachNotionEvidence([original], [page]);
    const enriched = result.episodes[0];
    expect(result.outcomes[0].status).toBe("ATTACHED");
    expect(enriched.worldPosition).toEqual(original.worldPosition);
    expect(enriched.memoryPosition).toEqual(original.memoryPosition);
    expect(enriched.label).toBe(original.label);
    expect(original.notionEvidence).toEqual([]);
    expect(enriched.provenance.nodes.map(node => node.type)).toEqual(["timeline", "author", "calendar", "lastfm", "notion"]);
    expect(enriched.context[0]).toMatchObject({ kind: "episode-label", text: page.title });
    const file = reviewExport({ ...DEMO_XR_SCENE, journeyEpisodes: [enriched] }, { listening: "accepted" });
    expect(parseSceneFile(JSON.parse(JSON.stringify(file))).scene.journeyEpisodes).toEqual([enriched]);
    expect(attachNotionEvidence([enriched], [page]).episodes).toEqual([enriched]);
  });
  it("rejects Notion, Calendar, Last.fm and unconfirmed Author evidence as geographic authority", () => {
    const enriched = attachNotionEvidence([episode()], [page]).episodes[0];
    for (const evidenceId of ["notion:fixture-page", "calendar", "music", "author"]) {
      const invalid = structuredClone(enriched);
      invalid.worldPosition!.evidenceIds = [evidenceId];
      invalid.provenance.edges.push({ evidenceId, role: "physical-geography", basis: "source-record" });
      expect(journeyEpisodeSchema.safeParse(invalid).success).toBe(false);
    }
    const confirmed = structuredClone(enriched);
    confirmed.provenance.nodes.push({ id: "confirmed", type: "author", sourceId: "fixture-confirmation", statement: "I confirm this physical location", confirmedGeography: { latitude: 45, longitude: 7 } });
    confirmed.provenance.edges.push({ evidenceId: "confirmed", role: "physical-geography", basis: "author-confirmed" });
    confirmed.worldPosition!.evidenceIds = ["confirmed"];
    expect(journeyEpisodeSchema.safeParse(confirmed).success).toBe(true);
  });
  it("leaves unmatched and ambiguous day-only pages unresolved", () => {
    const second = { ...episode(), id: "stop-2" };
    expect(attachNotionEvidence([episode(), second], [page]).outcomes[0].status).toBe("HUMAN_REVIEW");
    expect(attachNotionEvidence([episode()], [{ ...page, date: "2026-07-08" }]).outcomes[0].status).toBe("UNMAPPED");
    const local = { ...episode(), timeZone: "Europe/Bucharest", start: "2026-07-06T21:00:00Z", end: "2026-07-07T21:00:00Z" };
    expect(attachNotionEvidence([local], [page]).outcomes[0].status).toBe("ATTACHED");
    expect(attachNotionEvidence([local], [{ ...page, date: "2026-07-08" }]).outcomes[0].status).toBe("UNMAPPED");
  });
  it("validates dates, graph links and duplicate inputs; flags revised page content", () => {
    expect(notionEvidenceSchema.safeParse({ ...page, date: "2026-02-30" }).success).toBe(false);
    expect(notionEvidenceSchema.safeParse({ ...page, locationLabel: null }).success).toBe(true);
    const invalid = episode();
    invalid.context.push({ kind: "project-milestone", text: "Milestone", evidenceId: "missing" });
    expect(journeyEpisodeSchema.safeParse(invalid).success).toBe(false);
    expect(() => attachNotionEvidence([episode()], [page, page])).toThrow("Duplicate");
    const enriched = attachNotionEvidence([episode()], [page]).episodes;
    expect(attachNotionEvidence(enriched, [{ ...page, title: "Changed" }]).outcomes[0].status).toBe("HUMAN_REVIEW");
  });
  it("preserves unresolved Notion context on export and rejects dangling candidate links", () => {
    const e = episode();
    const record = { evidence: page, source: { url: "https://www.notion.so/fixture", databaseLabel: "Projects", lastEditedAt: "2026-07-07T12:00:00Z", dateBasis: "Notion Date property", verification: "unverified", fingerprint: "a".repeat(64), summaryAuthorship: "Editor" as const }, status: "HUMAN_REVIEW" as const, episodeIds: [e.id] };
    const scene = { ...DEMO_XR_SCENE, journeyEpisodes: [e], notionContext: { retrievedAt: "2026-09-29T00:00:00Z", records: [record] } };
    const exported = parseSceneFile(reviewExport(scene, { listening: "accepted" }));
    expect(exported.scene.notionContext).toEqual(scene.notionContext);
    expect(exported.scene.journeyEpisodes![0].notionEvidence).toEqual([]);
    expect(exported.decisions.listening).toBe("accepted");
    expect(() => parseSceneFile({ ...scene, notionContext: { ...scene.notionContext, records: [{ ...record, episodeIds: ["missing"] }] } })).toThrow();
    expect(() => parseSceneFile({ ...scene, notionContext: { ...scene.notionContext, records: [{ ...record, status: "ATTACHED" }] } })).toThrow();
  });

});
