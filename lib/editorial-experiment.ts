import { z } from "zod";

export const editorialActionSchema = z.enum(["accept", "revise", "refuse"]);
export const editorialStateSchema = z.enum(["unreviewed", "accepted", "revised", "refused"]);

export type EditorialAction = z.infer<typeof editorialActionSchema>;
export type EditorialState = z.infer<typeof editorialStateSchema>;

export interface EditorialExperiment {
  proposalId: "aurora-proposal-fence-lights";
  originalWording: string;
  revisedWording?: string;
  decision: EditorialState;
  canonical: boolean;
  visualConsequence: "trace-open" | "trace-stable" | "trace-interrupted" | "trace-gap";
  audioConsequence: "waiting" | "motif-repeats" | "motif-transforms" | "intentional-silence";
  audit: Array<{ action: EditorialAction; wording?: string }>;
}

export const FICTIONAL_EDITORIAL_PROPOSAL =
  "Fence Lights appears near a fictional volunteer shift. It is temporal evidence, not proof of what the shift meant.";

export function createEditorialExperiment(): EditorialExperiment {
  return {
    proposalId: "aurora-proposal-fence-lights",
    originalWording: FICTIONAL_EDITORIAL_PROPOSAL,
    decision: "unreviewed",
    canonical: false,
    visualConsequence: "trace-open",
    audioConsequence: "waiting",
    audit: [],
  };
}

export function applyEditorialAction(
  current: EditorialExperiment,
  action: EditorialAction,
  revisedWording?: string,
): EditorialExperiment {
  if (action === "accept") {
    return {
      ...current,
      decision: "accepted",
      canonical: false,
      visualConsequence: "trace-stable",
      audioConsequence: "motif-repeats",
      audit: [...current.audit, { action }],
    };
  }
  if (action === "revise") {
    const wording = revisedWording?.trim() || current.originalWording;
    return {
      ...current,
      decision: "revised",
      revisedWording: wording,
      canonical: false,
      visualConsequence: "trace-interrupted",
      audioConsequence: "motif-transforms",
      audit: [...current.audit, { action, wording }],
    };
  }
  return {
    ...current,
    decision: "refused",
    canonical: false,
    visualConsequence: "trace-gap",
    audioConsequence: "intentional-silence",
    audit: [...current.audit, { action }],
  };
}

export function editorialTranscript(state: EditorialExperiment): string {
  if (state.audioConsequence === "motif-repeats") {
    return "A short synthetic motif repeats while the drawn connection settles into a continuous line.";
  }
  if (state.audioConsequence === "motif-transforms") {
    return "A short synthetic motif changes contour and the drawn connection is interrupted by an editorial mark.";
  }
  if (state.audioConsequence === "intentional-silence") {
    return "No motif plays. A deliberate gap appears in the connection; the refusal stays visible in the audit history and is non-canonical.";
  }
  return "No consequence has been played. Choose an editorial action to hear or see its distinct result.";
}
