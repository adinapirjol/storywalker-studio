import { z } from "zod";
import { xrSceneSchema, type XRScene } from "./xr-scene";
import type { ListeningAnalysis } from "./xr-listening";
export const xrReviewSchema = z.object({
  scene: xrSceneSchema,
  decisions: z.record(z.enum(["pending", "accepted", "refused"])),
}).strict().superRefine((value, context) => {
  if (Object.keys(value.decisions).some(id => !value.scene.cues.some(cue => cue.id === id))) context.addIssue({ code: "custom", message: "Unknown decision ID" });
});
export function buildListeningDraft(base: XRScene, analysis: ListeningAnalysis, sourceId: string) {
  const available = 12 - base.cues.length;
  const candidates: XRScene["cues"] = analysis.candidates.slice(0, available).map((candidate, index) => ({
    id: `music-candidate-${index + 1}`, title: candidate.label.slice(0, 120), source: "lastfm", provenance: `${sourceId}; ${analysis.method}; ${analysis.from} through ${analysis.to}, ${analysis.timeZone}.`,
    note: `Candidate ${candidate.kind}: ${candidate.reason}. Synthetic marker only; no recording is used.`,
    x: -12 + index * 4, z: -10, radius: 5, frequency: 174 + index * 29, minutes: 5, treatment: "synthetic-tone", colour: "#e9b987",
    evidence: { kind: "source-analysis", sourceId, facts: [`Exact source label: ${candidate.label}`, candidate.reason, `First observed: ${candidate.first}; last observed: ${candidate.last}`, `Grouping key: ${candidate.key}`], authorLabels: [], interpretation: "No emotional or autobiographical meaning inferred. Candidate selection is pending the Author." },
  }));
  return xrSceneSchema.parse({ ...base, cues: [...base.cues, ...candidates] });
}

/** Review edits change treatment/decisions only; source statements remain intact. */
export function validateDraftReview(original: XRScene, input: unknown) {
  original = xrSceneSchema.parse(original);
  const review = xrReviewSchema.parse(input);
  const oldEvidenceDecisions=original.evidenceArchive?.decisions??[];
  if(JSON.stringify((review.scene.evidenceArchive?.decisions??[]).slice(0,oldEvidenceDecisions.length))!==JSON.stringify(oldEvidenceDecisions))throw new Error('Evidence decisions cannot be rewritten');
  const previousSounds=original.experience?.soundDecisions??[];
  if(JSON.stringify((review.scene.experience?.soundDecisions??[]).slice(0,previousSounds.length))!==JSON.stringify(previousSounds))throw new Error('Existing Author sound decisions cannot be rewritten');
  const previousComposition = original.experience?.fragmentDecisions ?? [];
  if (JSON.stringify((review.scene.experience?.fragmentDecisions ?? []).slice(0, previousComposition.length)) !== JSON.stringify(previousComposition)) throw new Error("Existing Author composition decisions cannot be rewritten");
  for (const episode of review.scene.journeyEpisodes ?? []) {
    const previous = original.journeyEpisodes?.find(item => item.id === episode.id);
    if (!previous) throw new Error("Unknown journey episode");
    if (JSON.stringify(episode.memoryDecisions.slice(0, previous.memoryDecisions.length)) !== JSON.stringify(previous.memoryDecisions)) throw new Error("Existing Author displacement decisions cannot be rewritten");
    if (episode.worldPosition && !episode.memoryDecisions.length && JSON.stringify(episode.memoryPosition) !== JSON.stringify(episode.worldPosition.position)) throw new Error("A displacement requires an explicit Author decision");
  }
  const fixedFields = (scene: XRScene) => ({ ...scene,
    evidenceArchive:scene.evidenceArchive?{...scene.evidenceArchive,decisions:[]}:undefined,
    experience: undefined,
    journeyLayout: scene.journeyLayout ? { ...scene.journeyLayout, mode: "WORLD" } : undefined,
    journeyEpisodes: scene.journeyEpisodes?.map(({ memoryPosition, memoryDecisions, ...episode }) => { void memoryPosition; void memoryDecisions; return episode; }),
    cues: scene.cues.map(cue => ({ id: cue.id, title: cue.title, source: cue.source, provenance: cue.provenance, note: cue.note, evidence: cue.evidence, minutes: cue.minutes })) });
  if (JSON.stringify(fixedFields(original)) !== JSON.stringify(fixedFields(review.scene))) throw new Error("Source evidence and authored labels cannot be replaced by a mapping review. Reload the saved private draft.");
  return review;
}
