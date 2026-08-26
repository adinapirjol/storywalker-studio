import { describe, expect, it } from "vitest";
import { buildEvidencePack } from "@/lib/private-signal-engine";

describe("local evidence packet", () => {
  it("keeps retrieval cues separate from evidence authority", () => {
    const pack = buildEvidencePack([
      { id: "moment:one", kind: "moment", capturedAt: "2026-08-26T12:00:00.000Z", payload: { when: "2026-08-09", note: "Festival access shift" } },
      { id: "import:music", kind: "import", capturedAt: "2026-08-26T12:00:00.000Z", payload: { endedAt: "2026-08-09T20:00:00.000Z", track: "Festival signal" } },
      { id: "cut:one", kind: "editorial-cut", capturedAt: "2026-08-26T12:00:00.000Z", payload: { note: "Festival interpretation" } },
    ], "festival");
    expect(pack.externalModelCalled).toBe(false);
    expect(pack.evidence.map((item) => item.authority)).toContain("source-recorded");
    expect(pack.evidence.map((item) => item.authority)).toContain("editorial-proposal");
    expect(pack.evidence[0]).toMatchObject({ title: expect.any(String), excerpts: expect.any(Array) });
    expect(pack.connectionCandidates).toEqual(expect.arrayContaining([expect.objectContaining({ basis: "shared-day" })]));
  });
});
