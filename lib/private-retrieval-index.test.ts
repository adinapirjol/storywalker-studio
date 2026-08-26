import { describe, expect, it } from "vitest";
import { buildLocalRetrievalIndex } from "@/lib/private-retrieval-index";

describe("local retrieval index", () => {
  it("is rebuildable and excludes the source recovery document", () => {
    const index = buildLocalRetrievalIndex([{ id: "recovery:current", kind: "recovery-document", capturedAt: "2026-08-26T00:00:00Z", payload: { private: "skip" } }, { id: "moment:one", kind: "moment", capturedAt: "2026-08-26T00:00:00Z", payload: { note: "Festival access", when: "2026-08-09" } }], "2026-08-26T00:00:00Z");
    expect(index.indexedRecordCount).toBe(1);
    expect(index.records[0].terms).toContain("festival");
    expect(index.records[0].dates).toContain("2026-08-09");
  });
});
