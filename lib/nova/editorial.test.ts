import { expect, it } from "vitest";
import { connectionEditorial } from "./editorial";
import { researchPayload } from "@/lib/research/research-session";
import { buildLocalRetrievalIndex } from "@/lib/vault/private-retrieval-index";
import { isNovaEditorialSnapshot } from "@/lib/vault/record-policy";
import type { Hypothesis } from "./contracts";

it("preserves a live Author reading as evidence without changing the hypothesis verdict", () => {
  const h = {
    id: "fictional-proposal", relationship: "same-artist", status: "proposed",
    interpretation: "Explore this recurrence?", observation: "Two labels match.",
    refs: [{ id: "a", sourceId: "fixture", revision: "v1" }, { id: "b", sourceId: "fixture", revision: "v2" }],
  } as Hypothesis;
  const before = structuredClone(h);
  const session = connectionEditorial(h, "I do not recognize the fictional track.", "The name suggests a doorway to me; listening remains unresolved.", "2026-10-20T12:00:00.000Z");
  const payload = researchPayload(session, "2026-10-20T12:01:00.000Z");
  expect(payload).toMatchObject({ mode: "live", study: "refusal", privacy: "private", canonical: false, evidenceStatus: "author-stated" });
  expect(JSON.parse(session.sourceContext).refs).toEqual(h.refs);
  expect(JSON.parse(session.sourceContext)).not.toHaveProperty("proposedInterpretation");
  expect(JSON.parse(session.sourceContext)).not.toHaveProperty("observedCue");
  expect(payload.evidence).not.toContain(h.interpretation);
  expect(payload.evidence).not.toContain(h.observation);
  expect(payload.evidence).toContain("I do not recognize the fictional track.");
  expect(payload.evidence).toContain("The name suggests a doorway to me");
  expect(session.entries.map(e => e.action)).toEqual(["author-observation", "editorial-reading"]);
  expect(h).toEqual(before);
  expect(() => connectionEditorial(h, "", "A reading", "2026-10-20T12:00:00.000Z")).toThrow();
  expect(buildLocalRetrievalIndex([{ id: "research-session:fixture", kind: "capture", capturedAt: "2026-10-20T12:01:00.000Z", payload }]).records).toEqual([]);
});

it("excludes legacy Nova editorial snapshots from generic retrieval", () => {
  const legacy = researchPayload({
    study: "refusal",
    mode: "live",
    title: "CTM · Hypothesis Hyperloop · Author observation",
    sourceContext: JSON.stringify({ proposedInterpretation: "Private fictional model phrase" }),
    note: "A fictional Author observation.",
    entries: [],
  }, "2026-10-20T12:01:00.000Z");
  const index = buildLocalRetrievalIndex([{ id: "research-session:legacy-fixture", kind: "capture", capturedAt: "2026-10-20T12:01:00.000Z", payload: legacy }]);
  expect(index.records).toEqual([]);
  expect(isNovaEditorialSnapshot({ id: "research-session:nova:new-fixture", kind: "capture" })).toBe(true);
  expect(isNovaEditorialSnapshot({ id: "research-session:incomplete-header", kind: "capture" })).toBe(true);
});
