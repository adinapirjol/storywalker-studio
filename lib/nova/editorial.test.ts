import { expect, it } from "vitest";
import { connectionEditorial } from "./editorial";
import { researchPayload } from "@/lib/research/research-session";
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
  expect(session.entries.map(e => e.action)).toEqual(["author-observation", "editorial-reading"]);
  expect(h).toEqual(before);
  expect(() => connectionEditorial(h, "", "A reading", "2026-10-20T12:00:00.000Z")).toThrow();
});
