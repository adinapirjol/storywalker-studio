import { describe, expect, it } from "vitest";
import lifeEvents from "@/examples/aurora-coast/life-events.demo.json";
import musicTimeline from "@/examples/aurora-coast/music-timeline.demo.json";
import expectedState from "@/examples/aurora-coast/expected-review-state.demo.json";
import { generateProposals } from "@/lib/correlation";
import { seedAuroraCoast, validateAuroraCoastDemo } from "@/lib/demo";
import { exportJourneyMarkdown } from "@/lib/export";
import {
  applyGuidedReview,
  reviewAllLifeEvents,
  reviewProposal,
} from "@/lib/review-state";

describe("Aurora Coast demo", () => {
  it("validates one exact revision with exactly 12 tracks and 8 events", () => {
    expect(validateAuroraCoastDemo()).toEqual({
      revision: "aurora-coast-r1-2027-07",
      label: "Fictional demonstration data",
      trackCount: 12,
      lifeEventCount: 8,
      exactRevisionValidated: true,
    });
    expect(new Set(musicTimeline.tracks.map((track) => track.id)).size).toBe(12);
    expect(new Set(lifeEvents.events.map((event) => event.id)).size).toBe(8);
  });

  it("uses only the required fictional track and artist names", () => {
    expect(musicTimeline.tracks.map((track) => track.trackName)).toEqual([
      "Temporary Cities",
      "Orange Wristband",
      "Fence Lights",
      "Rain on Canvas",
      "Same Name, Different Map",
      "Borrowed Lanyard",
      "Last Vaporetto",
      "Salt on the Camera",
      "Piran at Blue Hour",
      "Platform Seventeen",
      "Night Bus North",
      "Birthday Weather",
    ]);
    expect(new Set(musicTimeline.tracks.map((track) => track.artistName)).size).toBe(12);
    expect(musicTimeline.tracks.every((track) => track.sourceUri.includes("demo"))).toBe(true);
  });

  it("does not generate proposals until LifeEvents are Author-confirmed", () => {
    const seeded = seedAuroraCoast();
    expect(seeded.lifeEvents.every((event) => event.reviewStatus === "pending")).toBe(true);
    expect(generateProposals(seeded)).toEqual([]);
    expect(reviewAllLifeEvents(seeded).proposals.length).toBeGreaterThan(2);
  });

  it("generates the same proposal ordering from the same input", () => {
    const reviewed = reviewAllLifeEvents(seedAuroraCoast());
    const first = generateProposals(reviewed);
    const second = generateProposals(reviewed);
    expect(second).toEqual(first);
  });

  it("supports explicit confirmation and rejection", () => {
    const reviewed = reviewAllLifeEvents(seedAuroraCoast());
    const first = reviewed.proposals[0];
    const confirmed = reviewProposal(reviewed, first.id, "confirmed");
    const rejected = reviewProposal(confirmed, reviewed.proposals[1].id, "rejected");
    expect(rejected.proposals.find((proposal) => proposal.id === first.id)?.status).toBe(
      "confirmed",
    );
    expect(
      rejected.proposals.find((proposal) => proposal.id === reviewed.proposals[1].id)
        ?.status,
    ).toBe("rejected");
  });

  it("revises the uncertain Venice window and retains stale overlap as audit history", () => {
    const result = applyGuidedReview(seedAuroraCoast());
    const expected = expectedState.afterGuidedReview;
    const venice = result.lifeEvents.find((event) => event.id === expected.revisedEvent.id);

    expect(venice).toMatchObject(expected.revisedEvent);
    for (const id of expected.confirmedProposalIds) {
      expect(result.proposals.find((proposal) => proposal.id === id)?.status).toBe(
        "confirmed",
      );
    }
    for (const id of expected.rejectedProposalIds) {
      expect(result.proposals.find((proposal) => proposal.id === id)?.status).toBe(
        "rejected",
      );
    }
    for (const id of expected.invalidatedProposalIds) {
      expect(result.proposals.find((proposal) => proposal.id === id)?.status).toBe(
        "invalidated",
      );
    }
  });

  it("omits private source events and rejected proposals from public export", () => {
    const reviewed = applyGuidedReview(seedAuroraCoast());
    const markdown = exportJourneyMarkdown(reviewed, "public");
    expect(markdown).toContain("Privacy-safe export: public");
    expect(markdown).toContain("Arrival under a moving sky");
    expect(markdown).not.toContain("Humidity and the last vaporetto");
    expect(markdown).not.toContain("Rejected by Author");
    expect(markdown).not.toContain("authorNote");
  });
});
