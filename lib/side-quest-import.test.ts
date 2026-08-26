import { describe, expect, it } from "vitest";
import { prepareSideQuestVaultImport } from "@/lib/side-quest-import";

const fixture = {
  schema: "side-quest-control-room", schemaVersion: 1, exportType: "private-export", exportedAt: "2026-08-26T12:00:00Z", source: { title: "Fictional control room", purpose: "Fictional test", persistence: "local" },
  counts: { jobs: 1, volunteering: 1, studyProgrammes: 1, scheduleEvents: 1, scheduleActions: 1, unresolvedDates: 1 },
  pipelines: { jobs: { records: [{ id: "job-1", company: "Fictional company" }] }, volunteering: { records: [{ id: "volunteer-1", name: "Fictional festival" }] }, creativeTechStudy: { programmes: [{ id: "study-1", programme: "Fictional programme" }], applicationPlan: [{ id: "plan-1", milestone: "Fictional plan" }], credentialGuide: {}, importReport: {} } },
  schedule: { events: [{ id: "event-1", title: "Fictional event" }], actions: [{ id: "action-1", title: "Fictional action" }], unresolved: [{ id: "unresolved-1", title: "Fictional unknown" }], customEvents: [] }, restoreState: {},
};

describe("Side Quest Control Room import", () => {
  it("preserves the source snapshot and creates stable, opaque encrypted-Vault records", () => {
    const first = prepareSideQuestVaultImport(fixture, "2026-08-26T13:00:00Z");
    const repeated = prepareSideQuestVaultImport(fixture, "2026-08-26T13:00:00Z");
    expect(first.records).toHaveLength(8);
    expect(first.records[0].payload).toMatchObject({ source: "side-quest-control-room", canonical: false, evidenceStatus: "source-recorded" });
    expect(first.records.map((record) => record.id)).toEqual(repeated.records.map((record) => record.id));
    expect(first.records.some((record) => record.id.includes("Fictional") || record.id.includes("job-1"))).toBe(false);
  });
});
