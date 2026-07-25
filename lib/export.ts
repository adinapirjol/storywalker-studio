import type { Privacy, Proposal, StudioState } from "@/lib/schema";

const allowedPrivacy: Record<Privacy, Privacy[]> = {
  public: ["public"],
  "friends-only": ["public", "friends-only"],
  private: ["public", "friends-only", "private"],
};

export function exportJourneyMarkdown(
  state: StudioState,
  maximumPrivacy: Privacy = "public",
): string {
  const allowed = new Set(allowedPrivacy[maximumPrivacy]);
  const events = state.lifeEvents.filter(
    (event) =>
      event.reviewStatus === "confirmed" && allowed.has(event.privacy),
  );
  const tracks = state.tracks.filter((track) => allowed.has(track.privacy));
  const eventIds = new Set(events.map((event) => event.id));
  const trackIds = new Set(tracks.map((track) => track.id));
  const proposals = state.proposals.filter(
    (proposal) =>
      proposal.status === "confirmed" &&
      eventIds.has(proposal.eventId) &&
      trackIds.has(proposal.trackId),
  );

  const trackLabel = (proposal: Proposal) => {
    const track = tracks.find((candidate) => candidate.id === proposal.trackId);
    return track ? `${track.trackName} — ${track.artistName}` : proposal.trackId;
  };
  const eventLabel = (proposal: Proposal) =>
    events.find((event) => event.id === proposal.eventId)?.title ?? proposal.eventId;

  return `# Aurora Coast

> Chapter One: Ten Days in Transit
> Fictional demonstration data
> Privacy-safe export: ${maximumPrivacy}
> Temporal proposals become canonical only after an Author decision.

## Route

Ljubljana → Afterlight Fields → Venice → Piran → Vienna → Berlin

## Author-confirmed life events

${events.length
  ? events
      .map(
        (event) => `### ${event.title}

- Window: ${event.startAt} → ${event.endAt}
- Certainty: ${event.certainty}
- Privacy: ${event.privacy}
- Location: ${event.location}

${event.description}`,
      )
      .join("\n\n")
  : "No events are eligible for this export."}

## Music trace

${tracks
  .map(
    (track) =>
      `- ${track.trackName} — ${track.artistName} · ${track.addedAt} · ${track.privacy}`,
  )
  .join("\n")}

## Confirmed by Author

${proposals.length
  ? proposals
      .map(
        (proposal) =>
          `- ${trackLabel(proposal)} → ${eventLabel(proposal)} (${proposal.basis}, ${proposal.confidence})`,
      )
      .join("\n")
  : "No confirmed connection is eligible at this privacy level."}

---

Generated locally by Storywalker Studio. Rejected and pending proposals are omitted.
`;
}
