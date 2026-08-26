import { describe, expect, it } from "vitest";
import { buildDirectorModelBrief, buildDirectorPreview } from "@/lib/nova-director";

describe("NOVA Director preview", () => {
  it("returns competing readings without making a canonical decision", () => {
    const preview = buildDirectorPreview({ mode: "local-retrieval-v1", query: "festival", consent: "this-tab-only", externalModelCalled: false, notice: "test", evidence: [{ id: "moment:one", kind: "moment", title: "First", authority: "source-recorded", matchedTerms: ["festival"], dateHints: ["2026-08-09"], snippet: "test", excerpts: [{ text: "A source line.", authority: "source-recorded" }] }], connectionCandidates: [] });
    expect(preview.canonical).toBe(false);
    expect(preview.readings).toHaveLength(2);
    expect(preview.questions).toHaveLength(3);
  });

  it("only places explicitly selected records in a model brief", () => {
    const preview = buildDirectorPreview({ mode: "local-retrieval-v1", query: "festival", consent: "this-tab-only", externalModelCalled: false, notice: "test", evidence: [
      { id: "moment:one", kind: "moment", title: "First", authority: "source-recorded", matchedTerms: ["festival"], dateHints: [], snippet: "one", excerpts: [{ text: "One source line.", authority: "source-recorded" }] },
      { id: "moment:two", kind: "moment", title: "Second", authority: "author-stated", matchedTerms: ["festival"], dateHints: [], snippet: "two", excerpts: [{ text: "Two source line.", authority: "author-stated" }] },
    ], connectionCandidates: [] });
    expect(buildDirectorModelBrief(preview, ["moment:two"]).selectedEvidence).toEqual([expect.objectContaining({ id: "moment:two" })]);
  });
});
