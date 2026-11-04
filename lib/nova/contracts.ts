import { z } from "zod";

export const relationshipSchema = z.enum(["same-day", "same-track", "same-artist", "author-association"]);
export const rejectionSchema = z.enum(["does-not-fit", "incorrect-evidence", "insufficient-evidence", "not-now", "never-again", "other"]);
export type Relationship = z.infer<typeof relationshipSchema>;
export type Rejection = z.infer<typeof rejectionSchema>;
export type Evidence = {
  id: string; sourceId: string; revision: string; title: string; excerpt: string | null;
  sourceType: string; timestamp: string | null; temporalPrecision: "instant" | "day" | "unknown";
  location: string | null; artist: string | null; track: string | null;
  provenance: string | null; authority: "author-stated" | "source-recorded";
  caveat: string; gaps: string[];
};
const refSchema = z.object({ id: z.string(), sourceId: z.string(), revision: z.string() });
export const hypothesisSchema = z.object({
  id: z.string(), key: z.string(), refs: z.array(refSchema).min(1).max(8),
  relationship: relationshipSchema, interpretation: z.string().max(2000),
  observation: z.string(), uncertainty: z.string(), validation: z.string(),
  contradictingEvidence: z.array(z.string()), reason: z.string(), createdAt: z.string(),
  modelVersion: z.enum(["nova-local-rules-v1", "conversation-assisted-v1", "local-reflection-v1", "consented-model-v1"]), confidence: z.literal("uncalibrated"),
  modelReceipt: z.object({ provider: z.literal("OpenAI"), model: z.string(), packetHash: z.string(), grounds: z.array(z.object({ source: z.string(), quote: z.string() })), sources: z.array(z.object({ alias: z.string(), id: z.string(), revision: z.string() })).default([]) }).optional(),
  status: z.enum(["proposed", "approved", "modified", "rejected", "superseded", "invalidated"]),
  supersedes: z.string().optional(), alternativeTo: z.string().optional(),
  readingId: z.string().optional(),
});
export type Hypothesis = z.infer<typeof hypothesisSchema>;
const decisionSchema = z.object({
  id: z.string(), hypothesisId: z.string(), action: z.enum(["approve", "modify", "reject"]),
  at: z.string(), reason: rejectionSchema.optional(), note: z.string().max(2000),
  replacementId: z.string().optional(),
});
export const stateSchema = z.object({
  schemaVersion: z.literal(1), revision: z.number().int().nonnegative(),
  enabled: z.boolean(), paused: z.boolean(), sourceIds: z.array(z.string()).max(8),
  hypotheses: z.array(hypothesisSchema).max(1000), decisions: z.array(decisionSchema).max(2000),
  lastAnalysis: z.string().nullable(), metricsEnabled: z.boolean(),
  metrics: z.record(z.string(), z.number()),
  modelAttempts: z.array(z.object({ id: z.string(), packetHash: z.string(), at: z.string(), status: z.enum(["pending", "outcome-unknown", "completed", "no-proposal", "failed"]), hypothesisId: z.string().optional(), summary: z.string().max(2000).optional() })).max(50).default([]),
});
export type LoopState = z.infer<typeof stateSchema>;
export const initialState = (): LoopState => ({ schemaVersion: 1, revision: 0, enabled: false, paused: false, sourceIds: [], hypotheses: [], decisions: [], lastAnalysis: null, metricsEnabled: false, metrics: {}, modelAttempts: [] });
const base = { expectedRevision: z.number().int().nonnegative() };
export const commandSchema = z.discriminatedUnion("action", [
  z.object({ ...base, action: z.literal("reconsider-reading"), hypothesisId: z.string(), readingId: z.string().startsWith("research-session:").max(200), consent: z.literal(true) }).strict(),
  z.object({ ...base, action: z.literal("propose-reading"), hypothesisId: z.string(), readingId: z.string().startsWith("research-session:").max(200), consent: z.literal(true), interpretation: z.string().trim().min(1).max(2000), experiment: z.string().trim().min(1).max(2000) }).strict(),
  z.object({ ...base, action: z.literal("configure"), sourceIds: z.array(z.string().min(1).max(300)).max(8), consent: z.literal(true), analyze: z.boolean().optional() }).strict(),
  z.object({ ...base, action: z.literal("analyze") }).strict(),
  z.object({ ...base, action: z.literal("pause"), paused: z.boolean() }).strict(),
  z.object({ ...base, action: z.literal("disable") }).strict(),
  z.object({ ...base, action: z.literal("metrics"), enabled: z.boolean() }).strict(),
  z.object({ ...base, action: z.literal("delete-metrics") }).strict(),
  z.object({ ...base, action: z.literal("delete-derived") }).strict(),
  z.object({ ...base, action: z.literal("approve"), hypothesisId: z.string() }).strict(),
  z.object({ ...base, action: z.literal("reject"), hypothesisId: z.string(), reason: rejectionSchema, note: z.string().trim().max(2000).default("") }).strict(),
  z.object({ ...base, action: z.literal("modify"), hypothesisId: z.string(), interpretation: z.string().trim().min(1).max(2000), relationship: relationshipSchema, evidenceIds: z.array(z.string()).min(1).max(8) }).strict(),
]);
export type Command = z.infer<typeof commandSchema>;
/** Modality adapters emit semantic actions; no sensor permissions are implied. */
export type InteractionAction =
  | { type: "INSPECT_CONNECTION"; id: string }
  | { type: "RELOAD_CONNECTION"; id: string; message?: string }
  | { type: "APPROVE_CONNECTION" | "REJECT_CONNECTION" | "MODIFY_CONNECTION"; command: Command }
  | { type: "MOVE_EVIDENCE_NODE"; id: string; x: number; y: number }
  | { type: "RECOMPOSE_CONNECTION"; evidenceIds: string[] };
export type LoopView = {
  state: LoopState; evidence: Evidence[];
  inventory: Array<{ id: string; kind: string; title: string; description: string; supported: boolean; selected: boolean }>;
  gaps: string[]; message: string;
};
