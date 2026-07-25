import { reconcileProposals } from "@/lib/correlation";
import { reviewBundle } from "@/lib/demo";
import {
  studioStateSchema,
  type Proposal,
  type StudioState,
} from "@/lib/schema";

const REVIEW_TIME = new Date("2027-07-28T08:10:00+02:00");

export function reviewAllLifeEvents(
  state: StudioState,
  status: "confirmed" | "rejected" = "confirmed",
  now = REVIEW_TIME,
): StudioState {
  const reviewed = {
    ...state,
    lifeEvents: state.lifeEvents.map((event) => ({
      ...event,
      reviewStatus: status,
    })),
  };
  return studioStateSchema.parse({
    ...reviewed,
    proposals: status === "confirmed" ? reconcileProposals(reviewed, now) : [],
  });
}

export function reviewProposal(
  state: StudioState,
  proposalId: string,
  status: Extract<Proposal["status"], "confirmed" | "rejected">,
  now = REVIEW_TIME,
): StudioState {
  return studioStateSchema.parse({
    ...state,
    proposals: state.proposals.map((proposal) =>
      proposal.id === proposalId && proposal.status !== "invalidated"
        ? { ...proposal, status, reviewedAt: now.toISOString() }
        : proposal,
    ),
  });
}

export function reviseVeniceWindow(
  state: StudioState,
  now = new Date("2027-07-28T08:15:00+02:00"),
): StudioState {
  const guided = reviewBundle().guidedReview;
  const revised = studioStateSchema.parse({
    ...state,
    lifeEvents: state.lifeEvents.map((event) =>
      event.id === guided.reviseEventId
        ? {
            ...event,
            startAt: guided.revisedStartAt,
            endAt: guided.revisedEndAt,
            revision: event.revision + 1,
          }
        : event,
    ),
  });
  return studioStateSchema.parse({
    ...revised,
    proposals: reconcileProposals(revised, now),
  });
}

export function applyGuidedReview(state: StudioState): StudioState {
  const guided = reviewBundle().guidedReview;
  let next = reviewAllLifeEvents(state);
  next = reviewProposal(next, guided.confirmProposalId, "confirmed");
  next = reviewProposal(next, guided.rejectProposalId, "rejected");
  return reviseVeniceWindow(next);
}
