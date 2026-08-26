import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { seedAuroraCoast } from "@/lib/demo";
import { exportJourneyMarkdown } from "@/lib/export";
import { applyPrivateProposalAction, privateAuthorReviewDocumentSchema } from "@/lib/private-author-review";
import { applyGuidedReview } from "@/lib/review-state";

const initial = privateAuthorReviewDocumentSchema.parse({
  schemaVersion: 1, privacy: "private", reviewStatus: "pending", purpose: "Synthetic test document.",
  candidates: [{ id: "private-author-report-01", privacy: "private", canonical: false, reviewStatus: "pending",
    details: [
      { field: "Exact time", value: "Unknown", knowledge: "unknown" },
      { field: "Coordinates", value: "Unknown", knowledge: "unknown" },
      { field: "Playback context", value: "Unknown", knowledge: "unknown" },
      { field: "Association", value: "Author report", knowledge: "author-reported" },
    ],
    proposals: [
      { id: "possible", label: "possible-interpretation", originalText: "A proposed reading.", status: "pending", audit: [] },
      { id: "seductive", label: "seductive-interpretation", originalText: "A seductive proposed reading.", status: "pending", audit: [] },
    ],
  }],
});

describe("local private Author review", () => {
  it("is ignored by Git and cannot enter the Aurora Coast export boundary", () => {
    expect(() => execFileSync("git", ["check-ignore", "--no-index", "private-data/research/july-august-2026.author-review.private.json"])).not.toThrow();
    const exported = exportJourneyMarkdown(applyGuidedReview(seedAuroraCoast()));
    expect(exported).not.toContain(initial.candidates[0].id);
    expect(exported).not.toContain(initial.candidates[0].proposals[0].originalText);
  });

  it("keeps unknown fields unknown and starts proposals unresolved", () => {
    const candidate = initial.candidates[0];
    expect(candidate.canonical).toBe(false);
    expect(candidate.reviewStatus).toBe("pending");
    expect(candidate.details.filter((detail) => detail.knowledge === "unknown")).toHaveLength(3);
    expect(candidate.proposals.every((proposal) => proposal.status === "pending" && proposal.audit.length === 0)).toBe(true);
  });

  it("requires an explicit action and preserves refusal in private audit history", () => {
    const refused = applyPrivateProposalAction(initial, "private-author-report-01", "seductive", "refuse", undefined, new Date("2026-08-23T12:00:00Z"));
    expect(refused.candidates[0].proposals[1]).toMatchObject({ status: "refused", audit: [{ action: "refuse", at: "2026-08-23T12:00:00.000Z" }] });
    expect(refused.candidates[0].canonical).toBe(false);
  });

  it("does not accept or revise a proposal without an explicit Author action", () => {
    expect(initial.candidates[0].proposals[0].status).toBe("pending");
    const accepted = applyPrivateProposalAction(initial, "private-author-report-01", "possible", "accept", undefined, new Date("2026-08-23T12:00:00Z"));
    expect(accepted.candidates[0].proposals[0].status).toBe("accepted");
    expect(() => applyPrivateProposalAction(initial, "private-author-report-01", "possible", "revise")).toThrow("revision needs Author wording");
  });
});
