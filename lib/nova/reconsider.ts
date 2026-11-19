import type { VaultRecord } from "@/lib/vault/private-vault";
import { researchSessionSchema } from "@/lib/research/research-session";
import type { Command, Evidence, Hypothesis, LoopState } from "./contracts";
import { digest, normalize } from "./normalize";
import { forbidden, LoopInputError, reconcile } from "./engine";

export function reconsiderReading(input: LoopState, evidence: Evidence[], record: VaultRecord, command: Extract<Command, { action: "propose-reading" | "reconsider-reading" }>, now: string): LoopState {
  const state = structuredClone(reconcile(input, evidence));
  if (!state.enabled || state.paused) throw new LoopInputError("Resume Hyperloop before reconsidering.");
  const original = state.hypotheses.find(h => h.id === command.hypothesisId);
  if (!original || !["proposed", "approved", "modified", "invalidated", "superseded"].includes(original.status) || forbidden(state, original)) throw new LoopInputError("The original connection is unavailable or constrained by your decisions.");
  const reading = normalize(record).evidence[0];
  const session = researchSessionSchema.safeParse(record.payload);
  if (!reading || reading.sourceType !== "author-editorial-reading" || record.id !== command.readingId || !session.success ||
      !session.data.entries.some(e => e.subject === original.id && e.action === "author-observation")) throw new LoopInputError("Choose a saved live Author response to this connection.");
  const automatic = command.action === "reconsider-reading";
  const words = session.data.entries.find(e => e.subject === original.id && e.action === "editorial-reading")?.wording?.trim() || session.data.note.trim();
  if (!words) throw new LoopInputError("The reading contains no observation to explore.");
  const excerpt = words.length > 600 ? `${words.slice(0, 600)}…` : words;
  const interpretation = automatic
    ? `Could your own reading become the starting point for the next experiment?\n\nYou wrote: “${excerpt}”\n\nTry composing a response from these words, then compare it with the original connection. What would you keep, change or leave unresolved?`
    : command.interpretation;
  const experiment = automatic
    ? "Make two short versions: one following the original suggestion, one following your observation. Compare them in words, sound or another medium you choose. Keep only what fits; you can also leave both unresolved. This is a local reflection prompt quoting your response, not a semantic analysis of it."
    : command.experiment;
  const key = digest(["reading-proposal", original.id, reading.id, reading.revision, interpretation, experiment]);
  // Repeated submissions never replace an earlier decision or regenerate a rejection.
  if (state.hypotheses.some(h => h.key === key)) return state;
  if (state.hypotheses.some(h => h.readingId === record.id && h.alternativeTo === original.id)) throw new LoopInputError("This reading already has a proposal. Review it before creating a new reading.");
  if (state.hypotheses.length >= 1000 || state.hypotheses.filter(h => h.status === "proposed").length >= 24) throw new LoopInputError("Review existing proposals before adding more.");
  const sources = [...new Set([...state.sourceIds, record.id])];
  if (sources.length > 8) throw new LoopInputError("Source capacity reached. Adjust your selection first.");
  const proposal: Hypothesis = {
    id: `hypothesis:${key.slice(0, 32)}`, key,
    refs: [{ id: reading.id, sourceId: reading.sourceId, revision: reading.revision }],
    relationship: "author-association", interpretation,
    observation: automatic ? "Your saved response is the starting point for this reflection. The original connection remains in history; its meaning has not been confirmed." : "Your saved observation supplies a new creative association. The original connection is retained as historical context, not evidence of that meaning.",
    uncertainty: automatic ? "A deterministic reflection prompt built from your words, without semantic inference. It does not decide what your observation means. Historical claims and the original interpretation remain unconfirmed." : "This is a conversation-assisted creative proposal, not an automatic discovery. Track recognition and historical meaning remain unresolved. No artist intent, attendance or psychological state is inferred.",
    validation: experiment, contradictingEvidence: [],
    reason: "You explicitly asked to reconsider the original connection using this saved Author response.",
    createdAt: now, modelVersion: automatic ? "local-reflection-v1" : "conversation-assisted-v1", confidence: "uncalibrated",
    status: "proposed", alternativeTo: original.id, readingId: record.id,
  };
  if (forbidden(state, proposal)) throw new LoopInputError("This proposal conflicts with a rejection boundary.");
  state.sourceIds = sources;
  state.hypotheses.push(proposal);
  state.revision++;
  if (state.metricsEnabled) state.metrics.authorReadingProposals = (state.metrics.authorReadingProposals ?? 0) + 1;
  return state;
}
