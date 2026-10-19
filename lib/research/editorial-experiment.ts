import { z } from "zod";

export const editorialActionSchema = z.enum(["accept", "revise", "refuse", "unresolved"]);
export const editorialStateSchema = z.enum(["unreviewed", "accepted", "revised", "refused", "unresolved"]);
export type EditorialAction = z.infer<typeof editorialActionSchema>;
export type EditorialState = z.infer<typeof editorialStateSchema>;

// Public invented stimulus, authored with Codex; not inferred from listening data.
export const FICTIONAL_EDITORIAL_PROPOSAL =
  "Perhaps the tiring Aurora Coast encounter became a story of resilience through Fence Lights.";
export const FICTIONAL_LISTENING_EVIDENCE = Object.freeze({
  encounter: "Invented Author account: an unidentified performer played a cover at Aurora Coast. The encounter felt tiring.",
  platform: "Invented playlist snapshot: Fence Lights is listed. No recorded play or match to the live performance is supplied.",
  selectionContext: "unknown" as const,
  occurredAt: "Fictional encounter date unspecified",
  recordedAt: "Fixture composed 13 October 2026; not an event timestamp",
});

export interface EditorialExperiment {
  proposalId: "aurora-proposal-fence-lights";
  originalWording: string;
  revisedWording?: string;
  decision: EditorialState;
  canonical: boolean;
  evidence: typeof FICTIONAL_LISTENING_EVIDENCE;
  visualConsequence: "trace-open" | "trace-stable" | "trace-interrupted" | "trace-gap" | "trace-unresolved";
  audioConsequence: "waiting" | "motif-repeats" | "motif-transforms" | "intentional-silence";
  audit: Array<{ action: EditorialAction; wording?: string; at?: string }>;
}

export function createEditorialExperiment(): EditorialExperiment {
  return {
    proposalId: "aurora-proposal-fence-lights", originalWording: FICTIONAL_EDITORIAL_PROPOSAL,
    decision: "unreviewed", canonical: false, evidence: FICTIONAL_LISTENING_EVIDENCE,
    visualConsequence: "trace-open", audioConsequence: "waiting", audit: [],
  };
}

export function applyEditorialAction(current: EditorialExperiment, action: EditorialAction, revisedWording?: string, at = new Date().toISOString()): EditorialExperiment {
  const wording = revisedWording?.trim() || undefined;
  if (action === "revise" && !wording) throw new Error("Write your revision before choosing Revise.");
  if (wording && wording.length > 4000) throw new Error("Keep a response within 4,000 characters.");
  const last = current.audit.at(-1);
  if (last?.action === action && last.wording === wording && last.at === at) return current;
  if (current.audit.length >= 500) throw new Error("Save this bounded session before starting another.");
  const consequences = {
    accept: { decision: "accepted", visualConsequence: "trace-stable", audioConsequence: "motif-repeats" },
    revise: { decision: "revised", visualConsequence: "trace-interrupted", audioConsequence: "motif-transforms" },
    refuse: { decision: "refused", visualConsequence: "trace-gap", audioConsequence: "intentional-silence" },
    unresolved: { decision: "unresolved", visualConsequence: "trace-unresolved", audioConsequence: "waiting" },
  } as const;
  return {
    ...current, ...consequences[action], canonical: false,
    ...(action === "revise" ? { revisedWording: wording } : {}),
    audit: [...current.audit, { action, wording, at }],
  };
}

export function editorialTranscript(state: EditorialExperiment): string {
  const boundary = " The encounter and playlist remain separate; selection context is unknown. No factual evidence is accepted by this decision.";
  if (state.decision === "accepted") return "You endorse the original proposed relationship. A continuous line links distinct sources. On Play, a soft motif repeats between left and right." + boundary;
  if (state.decision === "revised") return "Your wording governs this reading. An editorial mark interrupts the line. On Play, the motif changes contour between left and right." + boundary;
  if (state.decision === "refused") return "No motif plays. A deliberate gap removes the proposal’s authority. Your disagreement and earlier readings remain in history, non-canonical." + boundary;
  if (state.decision === "unresolved") return "An unanswered dotted connection remains. Silence leaves meaning open without endorsing or rejecting it." + boundary;
  return "Read the separate sources at your own pace. No interpretation has authority and sound is stopped." + boundary;
}
