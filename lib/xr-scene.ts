import { z } from "zod";
import {soundDecisionSchema} from "./xr-sound";
import {SOUND_CATALOG} from "./xr-sound-catalog";
import { journeyLayoutSchema } from "./journey-profile";
import { journeyEpisodeSchema, notionEvidenceSchema } from "./journey-episode";
import { evidenceArchiveSchema } from "./xr-evidence";

export const xrSceneSchema = z.object({
  version: z.literal(1),
  title: z.string().trim().min(1).max(120),
  journeyEpisodes: z.array(journeyEpisodeSchema).optional(),
  journeyLayout: journeyLayoutSchema.optional(),
  evidenceArchive: evidenceArchiveSchema.optional(),
  experience: z.object({
    soundDecisions: z.array(soundDecisionSchema).max(10000).optional(),
    regime: z.enum(["WORLD", "TIME", "MEMORY"]), memoryBase: z.enum(["WORLD", "TIME"]),
    fragmentDecisions: z.array(z.object({ cueId: z.string(), episodeId: z.string().nullable(), at: z.string().datetime(), author: z.literal("Author"), interpretation: z.literal("Composition only; no factual association inferred") }).strict()),
  }).strict().optional(),
  notionContext: z.object({
    retrievedAt: z.string().datetime(),
    records: z.array(z.object({
      evidence: notionEvidenceSchema,
      source: z.object({ url: z.string().url(), databaseLabel: z.string(), lastEditedAt: z.string().datetime(), dateBasis: z.string(), verification: z.string(), fingerprint: z.string().regex(/^[a-f0-9]{64}$/), summaryAuthorship: z.literal("Editor") }).strict(),
      status: z.enum(["ATTACHED", "HUMAN_REVIEW", "UNMAPPED"]),
      episodeIds: z.array(z.string()),
    }).strict()),
  }).strict().optional(),
  draft: z.object({
    status: z.literal("draft"), privacy: z.literal("private"), canonical: z.literal(false),
    authorLabels: z.array(z.string().max(500)).max(20),
    assemblyReason: z.string().max(1000),
    sourceRequest: z.string().max(500),
  }).strict().optional(),
  cues: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/).max(60),
    title: z.string().trim().min(1).max(120),
    source: z.enum(["demo", "spotify", "lastfm", "google-maps", "calendar", "letterboxd", "imdb", "author"]),
    provenance: z.string().trim().min(1).max(500),
    note: z.string().max(1000),
    x: z.number().finite().min(-20).max(20),
    z: z.number().finite().min(-20).max(20),
    radius: z.number().finite().min(1).max(20),
    frequency: z.number().finite().min(80).max(1200),
    evidence: z.object({
      kind: z.enum(["author-statement", "source-analysis"]),
      sourceId: z.string().max(300),
      facts: z.array(z.string().max(1000)).max(12),
      authorLabels: z.array(z.string().max(500)).max(12),
      interpretation: z.string().max(1000),
    }).strict().optional(),
    treatment: z.enum(["silent", "synthetic-tone"]).optional(),
    colour: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    minutes: z.number().int().min(1).max(120),
  }).strict()).min(1).max(12),
}).strict().superRefine((scene, ctx) => {
  const archive=scene.evidenceArchive;
  if(archive){
    const ids=new Set(archive.artifacts.map(a=>a.id)),windows=new Set(scene.journeyEpisodes?.map(e=>e.id));
    if(ids.size!==archive.artifacts.length)ctx.addIssue({code:'custom',message:'Duplicate archive artefact'});
    const pairs=new Set<string>();
    for(const m of archive.matches){const key=JSON.stringify([m.artifactId,m.windowId]);if(!ids.has(m.artifactId)||!windows.has(m.windowId)||pairs.has(key))ctx.addIssue({code:'custom',message:'Invalid archive match'});pairs.add(key);}
    for(const d of archive.decisions)if(!pairs.has(JSON.stringify([d.artifactId,d.windowId])))ctx.addIssue({code:'custom',message:'Evidence decision requires an existing candidate'});
  }
  for (const decision of scene.experience?.fragmentDecisions ?? []) {
    if (!scene.cues.some(c=>c.id===decision.cueId && c.source==='author') || (decision.episodeId !== null && !scene.journeyEpisodes?.some(e=>e.id===decision.episodeId))) ctx.addIssue({code:"custom",message:"Unknown fragment or episode in composition decision"});
  }
  for(const d of scene.experience?.soundDecisions??[]){
    const sound=SOUND_CATALOG.find(s=>s.id===d.soundId);
    if(!scene.journeyEpisodes?.some(e=>e.id===d.episodeId)||(d.soundId?(!sound||JSON.stringify(d.source)!==JSON.stringify(sound.source)):d.source!==null))ctx.addIssue({code:'custom',message:'Sound composition requires an existing episode and verified catalogue provenance'});
  }
  const context = scene.notionContext?.records ?? [];
  if (new Set(context.map(item => item.evidence.pageId)).size !== context.length) ctx.addIssue({ code: "custom", message: "Duplicate contextual page IDs" });
  for (const item of context) {
    if (item.episodeIds.some(id => !scene.journeyEpisodes?.some(episode => episode.id === id))) ctx.addIssue({ code: "custom", message: "Unknown Notion candidate episode" });
    if (item.status === "ATTACHED" && (item.episodeIds.length !== 1 || !scene.journeyEpisodes?.find(episode => episode.id === item.episodeIds[0])?.notionEvidence.some(page => JSON.stringify(page) === JSON.stringify(item.evidence)))) ctx.addIssue({ code: "custom", message: "Attached Notion context requires matching episode evidence" });
    if (item.status === "UNMAPPED" && item.episodeIds.length) ctx.addIssue({ code: "custom", message: "Unmapped page cannot have episode candidates" });
  }
  if (scene.journeyLayout && (!scene.journeyEpisodes?.length || scene.journeyEpisodes.some(episode => !episode.worldPosition || !episode.memoryPosition))) ctx.addIssue({ code: "custom", message: "Geographic layout requires positioned episodes" });
  if (scene.journeyLayout) for (const episode of scene.journeyEpisodes ?? []) {
    const world = episode.worldPosition?.position, memory = episode.memoryPosition;
    if (world && memory && (!episode.memoryDecisions.length && JSON.stringify(world) !== JSON.stringify(memory))) ctx.addIssue({ code: "custom", message: "Memory displacement requires an Author decision" });
    if (world && memory && [world.x, world.z, memory.x, memory.z].some(value => Math.abs(value) > 20)) ctx.addIssue({ code: "custom", message: "Journey positions must fit the 40x40 room" });
  }
  if (scene.journeyEpisodes && new Set(scene.journeyEpisodes.map(episode => episode.id)).size !== scene.journeyEpisodes.length) ctx.addIssue({ code: "custom", message: "Episode IDs must be unique" });
  if (new Set(scene.cues.map(cue => cue.id)).size !== scene.cues.length)
    ctx.addIssue({ code: "custom", message: "Cue IDs must be unique", path: ["cues"] });
});
export type XRScene = z.infer<typeof xrSceneSchema>;
export type Decision = "pending" | "accepted" | "refused";
export const DEMO_XR_SCENE: XRScene = {
  version: 1, title: "A room for possible departures",
  cues: [
    { id: "listening", title: "A listening threshold", source: "demo", provenance: "Synthetic music cue; no listening history used.", note: "Try a low tone to your left. What would you choose to hear here?", x: -8, z: -6, radius: 12, frequency: 174, minutes: 5 },
    { id: "screen", title: "An afterimage", source: "demo", provenance: "Fictional cinema cue; no film diary imported.", note: "A film could leave a visual or sonic fragment in the room. The connection is yours to make.", x: 8, z: -4, radius: 12, frequency: 261, minutes: 10 },
    { id: "making", title: "A small space for making", source: "demo", provenance: "Fictional creative-session cue; no calendar read.", note: "A short making session can become a spatial invitation. Time budget is entered manually.", x: 0, z: 10, radius: 12, frequency: 348, minutes: 20 },
  ],
};
export function cueGain(cue: XRScene["cues"][number], x: number, z: number, decision: Decision, budget: number) {
  if (decision !== "accepted" || cue.minutes > budget) return 0;
  return Math.max(0, 1 - Math.hypot(cue.x - x, cue.z - z) / cue.radius) * 0.08;
}
export function reviewExport(scene: XRScene, decisions: Record<string, Decision>) {
  return { format: "storywalker-xr-review", version: 1, scene, decisions: Object.fromEntries(scene.cues.map(cue => [cue.id, decisions[cue.id] ?? "pending"])), canonical: false, destination: "local-only; not an Echoes import format" };
}

const sceneFileSchema = z.object({
  format: z.literal("storywalker-xr-review"), version: z.literal(1),
  scene: xrSceneSchema, decisions: z.record(z.enum(["pending", "accepted", "refused"])),
  canonical: z.literal(false), destination: z.string().optional(), activated: z.literal(false).optional(),
}).strict().superRefine((file, ctx) => {
  if (Object.keys(file.decisions).some(id => !file.scene.cues.some(cue => cue.id === id))) ctx.addIssue({ code: "custom", message: "Unknown cue in saved decisions" });
});
export function parseSceneFile(input: unknown) {
  if (input && typeof input === "object" && "format" in input) {
    const parsed = sceneFileSchema.parse(input);
    return { scene: parsed.scene, decisions: parsed.decisions };
  }
  return { scene: xrSceneSchema.parse(input), decisions: {} as Record<string, Decision> };
}
export function movementFeedback(cue: XRScene["cues"][number], decision: Decision, active: boolean, playing: boolean, budget: number) {
  const prefix = `Listener moved to ${cue.title} (X ${cue.x}, Z ${cue.z}); distance 0 m.`;
  const reason = decision !== "accepted" ? "This cue is not accepted." : !active ? "Activate the accepted mapping to rehearse it." : cue.minutes > budget ? "This cue is outside the current time budget." : cue.treatment === "silent" ? "This is a silent visual cue; open projection to see it." : !playing ? "Enable spatial sound to hear it." : "You are at the sound source. Move slightly away and turn to hear its direction.";
  return `${prefix} ${reason}`;
}
