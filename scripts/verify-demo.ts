import expected from "../examples/aurora-coast/expected-review-state.demo.json";
import { seedAuroraCoast, validateAuroraCoastDemo } from "../lib/demo";
import { applyGuidedReview } from "../lib/review-state";

const preview = validateAuroraCoastDemo();
const result = applyGuidedReview(seedAuroraCoast());
const expectedReview = expected.afterGuidedReview;

const failures: string[] = [];
if (result.tracks.length !== 12) failures.push("expected exactly 12 tracks");
if (result.lifeEvents.length !== 8) failures.push("expected exactly 8 life events");
for (const id of expectedReview.confirmedProposalIds) {
  if (result.proposals.find((proposal) => proposal.id === id)?.status !== "confirmed") {
    failures.push(`expected confirmed proposal ${id}`);
  }
}
for (const id of expectedReview.rejectedProposalIds) {
  if (result.proposals.find((proposal) => proposal.id === id)?.status !== "rejected") {
    failures.push(`expected rejected proposal ${id}`);
  }
}
for (const id of expectedReview.invalidatedProposalIds) {
  if (result.proposals.find((proposal) => proposal.id === id)?.status !== "invalidated") {
    failures.push(`expected invalidated proposal ${id}`);
  }
}

if (failures.length) {
  console.error(`Aurora Coast verification failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(
    [
      "Aurora Coast verified",
      `revision: ${preview.revision}`,
      "tracks: 12 synthetic records",
      "life events: 8 fictional records",
      `proposals after guided review: ${result.proposals.length}`,
      "confirmation, rejection, revision invalidation: stable",
    ].join("\n"),
  );
}
