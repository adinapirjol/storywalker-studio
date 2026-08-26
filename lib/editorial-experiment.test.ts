import { describe, expect, it } from "vitest";
import { applyEditorialAction, createEditorialExperiment, editorialTranscript } from "@/lib/editorial-experiment";

describe("fictional refusal experiment", () => {
  it("gives accept, revise and refuse distinct perceptible consequence states", () => {
    const initial = createEditorialExperiment();
    const accepted = applyEditorialAction(initial, "accept");
    const revised = applyEditorialAction(initial, "revise", "A shorter Author revision.");
    const refused = applyEditorialAction(initial, "refuse");
    expect([accepted.visualConsequence, accepted.audioConsequence]).toEqual(["trace-stable", "motif-repeats"]);
    expect([revised.visualConsequence, revised.audioConsequence]).toEqual(["trace-interrupted", "motif-transforms"]);
    expect([refused.visualConsequence, refused.audioConsequence]).toEqual(["trace-gap", "intentional-silence"]);
  });

  it("preserves the original wording and leaves refused interpretations non-canonical in audit history", () => {
    const initial = createEditorialExperiment();
    const revised = applyEditorialAction(initial, "revise", "Author wording.");
    const refused = applyEditorialAction(revised, "refuse");
    expect(refused.originalWording).toBe(initial.originalWording);
    expect(refused.revisedWording).toBe("Author wording.");
    expect(refused.canonical).toBe(false);
    expect(refused.audit).toEqual([{ action: "revise", wording: "Author wording." }, { action: "refuse" }]);
    expect(editorialTranscript(refused)).toContain("non-canonical");
  });
});
