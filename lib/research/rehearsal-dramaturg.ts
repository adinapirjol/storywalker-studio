import { z } from "zod";
import { xrSceneSchema } from "@/lib/xr/xr-scene";
const scoreSchema = z.object({
  id: z.string(), title: z.string(), rationale: z.string(), uncertainty: z.literal("Composition proposal; no lived facts or emotional inference."),
  source_ids: z.array(z.string()), scene: xrSceneSchema,
  timing: z.array(z.object({cue_id:z.string(),start_seconds:z.number().int().min(0).max(120),duration_seconds:z.number().int().min(1).max(120)})),
}).strict().superRefine((score,ctx)=>{
  if(score.scene.cues.some(c=>c.source!=="demo"||c.treatment!=="synthetic-tone")||score.scene.draft||score.scene.journeyEpisodes||score.scene.evidenceArchive)ctx.addIssue({code:"custom",message:"Fictional cue scenes only"});
  const ids=score.scene.cues.map(c=>c.id);
  if(JSON.stringify([...ids].sort())!==JSON.stringify(score.timing.map(b=>b.cue_id).sort())||JSON.stringify([...ids].sort())!==JSON.stringify([...score.source_ids].sort())||score.timing.some(b=>b.start_seconds+b.duration_seconds>120))ctx.addIssue({code:"custom",message:"Inconsistent score timing or sources"});
});
export const dramaturgResultSchema=z.object({fictional:z.literal(true),canonical:z.literal(false),model:z.string(),scores:z.array(scoreSchema).length(3)}).strict();
export type RehearsalScore=z.infer<typeof scoreSchema>;
export type ReviewEvent={scoreId:string;action:"accepted"|"refused"|"reconsidered";at:string;author:"Author"};
export function appendReview(history:ReviewEvent[],scoreId:string,action:ReviewEvent["action"],at=new Date().toISOString()):ReviewEvent[]{
  return [...history,{scoreId,action,at,author:"Author"}];
}
export const dramaturgReviewSchema=z.object({format:z.literal("storywalker-dramaturg-review"),version:z.literal(1),scores:z.array(scoreSchema).max(300),history:z.array(z.object({scoreId:z.string(),action:z.enum(["accepted","refused","reconsidered"]),at:z.string().datetime(),author:z.literal("Author")})).max(1000),canonical:z.literal(false),activated:z.literal(false)}).strict().superRefine((review,ctx)=>{const ids=new Set(review.scores.map(s=>s.id));if(ids.size!==review.scores.length||review.history.some(h=>!ids.has(h.scoreId)))ctx.addIssue({code:"custom",message:"Unknown or duplicate reviewed score"});});
