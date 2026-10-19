import { describe, expect, it } from "vitest";
import { applyEditorialAction, createEditorialExperiment, editorialTranscript } from "./editorial-experiment";

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
    expect(refused.audit).toMatchObject([{ action: "revise", wording: "Author wording.", at: expect.any(String) }, { action: "refuse", at: expect.any(String) }]);
    expect(editorialTranscript(refused)).toContain("non-canonical");
  });
});

it("keeps evidence unchanged through four decisions and retains disagreeing dated readings", () => {
  const initial = createEditorialExperiment();
  let state = applyEditorialAction(initial, "accept", "First reading", "2026-10-13T10:00:00Z");
  state = applyEditorialAction(state, "revise", "I do not need a resilience story.", "2026-10-20T10:00:00Z");
  state = applyEditorialAction(state, "refuse");
  state = applyEditorialAction(state, "unresolved");
  expect(state.evidence).toEqual(initial.evidence);
  expect(state.evidence.selectionContext).toBe("unknown");
  expect(state.audit).toHaveLength(4);
  expect(state.audit[0].wording).toBe("First reading");
  expect(state.audit[1].wording).toBe("I do not need a resilience story.");
  expect(state.decision).toBe("unresolved");
  expect(state.canonical).toBe(false);
  expect(editorialTranscript(state)).toContain("without endorsing or rejecting");
});

it("requires an actual revision and ignores an identical delivered decision", () => {
  expect(() => applyEditorialAction(createEditorialExperiment(), "revise", " ")).toThrow();
  const at = "2026-10-13T10:00:00Z";
  const once = applyEditorialAction(createEditorialExperiment(), "accept", undefined, at);
  expect(applyEditorialAction(once, "accept", undefined, at)).toBe(once);
});
