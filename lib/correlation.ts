import {
  proposalSchema,
  type LifeEvent,
  type Proposal,
  type StudioState,
  type Track,
} from "@/lib/schema";

const HOUR = 60 * 60 * 1000;

function distanceToRange(track: Track, event: LifeEvent): number {
  const instant = new Date(track.addedAt).getTime();
  const start = new Date(event.startAt).getTime();
  const end = new Date(event.endAt).getTime();
  if (instant >= start && instant <= end) return 0;
  return Math.min(Math.abs(instant - start), Math.abs(instant - end)) / HOUR;
}

function temporalBasis(
  track: Track,
  event: LifeEvent,
): Pick<Proposal, "basis" | "confidence" | "distanceHours"> | undefined {
  const distanceHours = Math.round(distanceToRange(track, event) * 10) / 10;
  if (distanceHours === 0) {
    return {
      basis: "within-range",
      confidence: event.certainty === "range-approximate" ? "low" : "moderate",
      distanceHours,
    };
  }
  if (track.addedAt.slice(0, 10) === event.startAt.slice(0, 10)) {
    return { basis: "same-day", confidence: "low", distanceHours };
  }
  if (distanceHours <= 24) {
    return { basis: "within-24-hours", confidence: "low", distanceHours };
  }
  if (distanceHours <= 72) {
    return {
      basis: "within-72-hours",
      confidence: "very-low",
      distanceHours,
    };
  }
  return undefined;
}

function proposalReason(track: Track, event: LifeEvent, basis: Proposal["basis"]): string {
  if (basis === "within-range") {
    return `${track.trackName} falls inside the Author-reviewed window for “${event.title}”. This is temporal evidence, not proof of meaning.`;
  }
  if (basis === "same-day") {
    return `${track.trackName} and “${event.title}” share a local calendar day. The Author decides whether that proximity belongs in the story.`;
  }
  if (basis === "within-24-hours") {
    return `${track.trackName} appears within 24 hours of “${event.title}”. Timing suggests a possible connection, not a cause.`;
  }
  return `${track.trackName} appears in the same 72-hour window as “${event.title}”. Treat this as weak temporal evidence only.`;
}

function proposalId(track: Track, event: LifeEvent, basis: Proposal["basis"]): string {
  return `proposal-${track.id}-${event.id}-${basis}`;
}

export function generateProposals(
  state: Pick<StudioState, "tracks" | "lifeEvents">,
  now = new Date("2027-07-28T08:05:00+02:00"),
): Proposal[] {
  const proposals: Proposal[] = [];
  for (const track of state.tracks) {
    for (const event of state.lifeEvents) {
      if (event.reviewStatus !== "confirmed") continue;
      const temporal = temporalBasis(track, event);
      if (!temporal) continue;
      proposals.push(
        proposalSchema.parse({
          id: proposalId(track, event, temporal.basis),
          trackId: track.id,
          eventId: event.id,
          ...temporal,
          reason: proposalReason(track, event, temporal.basis),
          status: "pending",
          createdAt: now.toISOString(),
          eventRevision: event.revision,
        }),
      );
    }
  }
  return proposals.sort(
    (a, b) =>
      a.distanceHours - b.distanceHours ||
      a.trackId.localeCompare(b.trackId) ||
      a.eventId.localeCompare(b.eventId),
  );
}

export function reconcileProposals(
  state: StudioState,
  now = new Date("2027-07-28T08:10:00+02:00"),
): Proposal[] {
  const next = generateProposals(state, now);
  const existing = new Map(state.proposals.map((proposal) => [proposal.id, proposal]));
  const nextIds = new Set(next.map((proposal) => proposal.id));
  const reconciled = next.map((proposal) => {
    const previous = existing.get(proposal.id);
    if (!previous || previous.status === "invalidated") return proposal;
    return {
      ...proposal,
      status: previous.status,
      reviewedAt: previous.reviewedAt,
    };
  });
  const invalidated = state.proposals
    .filter((proposal) => proposal.status !== "invalidated" && !nextIds.has(proposal.id))
    .map((proposal) =>
      proposalSchema.parse({
        ...proposal,
        status: "invalidated",
        invalidatedAt: now.toISOString(),
      }),
    );
  return [...reconciled, ...invalidated].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}
