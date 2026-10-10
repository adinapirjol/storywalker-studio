import { z } from "zod";

export const privateDetailSchema = z.object({
  field: z.string().min(1),
  value: z.string().min(1),
  knowledge: z.enum(["recorded", "author-reported", "inferred", "unknown", "proposed"]),
});

export const privateProposalSchema = z.object({
  id: z.string().min(1),
  label: z.enum(["possible-interpretation", "seductive-interpretation"]),
  originalText: z.string().min(1),
  revisedText: z.string().min(1).optional(),
  status: z.enum(["pending", "accepted", "revised", "refused"]),
  audit: z.array(z.object({ action: z.enum(["accept", "revise", "refuse"]), at: z.string().datetime({ offset: true }), revisedText: z.string().min(1).optional() })),
});

export const privateCandidateSchema = z.object({
  id: z.string().min(1),
  privacy: z.literal("private"),
  canonical: z.literal(false),
  reviewStatus: z.literal("pending"),
  details: z.array(privateDetailSchema),
  proposals: z.array(privateProposalSchema).min(1),
});

export const privateAuthorReviewDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  privacy: z.literal("private"),
  reviewStatus: z.literal("pending"),
  purpose: z.string().min(1),
  candidates: z.array(privateCandidateSchema),
});

export type PrivateAuthorReviewDocument = z.infer<typeof privateAuthorReviewDocumentSchema>;
export type PrivateProposalAction = "accept" | "revise" | "refuse";

export function applyPrivateProposalAction(
  document: PrivateAuthorReviewDocument,
  candidateId: string,
  proposalId: string,
  action: PrivateProposalAction,
  revisedText?: string,
  now = new Date(),
): PrivateAuthorReviewDocument {
  return privateAuthorReviewDocumentSchema.parse({
    ...document,
    candidates: document.candidates.map((candidate) => candidate.id !== candidateId ? candidate : {
      ...candidate,
      proposals: candidate.proposals.map((proposal) => {
        if (proposal.id !== proposalId) return proposal;
        const text = revisedText?.trim();
        if (action === "revise" && !text) throw new Error("A revision needs Author wording.");
        return {
          ...proposal,
          ...(action === "revise" ? { revisedText: text } : {}),
          status: action === "accept" ? "accepted" : action === "revise" ? "revised" : "refused",
          audit: [...proposal.audit, { action, at: now.toISOString(), ...(action === "revise" ? { revisedText: text } : {}) }],
        };
      }),
    }),
  });
}
