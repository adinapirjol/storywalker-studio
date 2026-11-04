import type { Hypothesis } from "./contracts";
import { researchSessionSchema } from "@/lib/research/research-session";

/** A present Author reading, separate from the source and the loop's verdict. */
export function connectionEditorial(h: Hypothesis, observation: string, reading: string, at: string) {
  if (!observation.trim()) throw new Error("Add your observation.");
  return researchSessionSchema.parse({
    study: "refusal",
    mode: "live",
    title: "CTM · Hypothesis Hyperloop · Author observation",
    sourceContext: JSON.stringify({
      origin: "nova-hypothesis-loop",
      hypothesisId: h.id,
      refs: h.refs,
      boundary: "This Author response is linked to a proposal; it does not approve that proposal or verify listening, attendance, artist identity or intent.",
    }),
    note: observation,
    entries: [
      { action: "author-observation", subject: h.id, wording: observation, at },
      ...(reading.trim() ? [{ action: "editorial-reading", subject: h.id, wording: reading, at }] : []),
    ],
  });
}
