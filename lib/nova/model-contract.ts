import { z } from "zod";

export const modelSelectionSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  hypothesisId: z.string().max(200), readingId: z.string().startsWith("research-session:").max(200),
  observationExcerpt: z.string().min(1).max(4000),
  editorialExcerpt: z.string().max(4000),
  includeOriginal: z.boolean(),
  evidenceIds: z.array(z.string().max(300)).max(4),
}).strict();
export type ModelSelection = z.infer<typeof modelSelectionSchema>;
export const modelRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preview"), selection: modelSelectionSchema }).strict(),
  z.object({ action: z.literal("generate"), selection: modelSelectionSchema, requestId: z.string().uuid(), snapshotHash: z.string().length(64), consent: z.literal(true) }).strict(),
]);
export const modelOutputSchema = z.object({
  outcome: z.enum(["proposal", "no-proposal"]),
  interpretation: z.string().max(2000),
  rationale: z.string().max(2000),
  whatChanged: z.string().max(1500),
  uncertainty: z.string().max(2000),
  experiment: z.string().max(2000),
  grounds: z.array(z.object({ source: z.string().max(40), quote: z.string().min(1).max(1000) }).strict()).max(6),
}).strict();
export type ModelOutput = z.infer<typeof modelOutputSchema>;
export type ModelPreview = {
  requestId: string; snapshotHash: string; configured: boolean;
  provider: "OpenAI"; model: string;
  items: Array<{ source: string; kind: string; text: string }>;
  body: { model: string; store: false; instructions: string; input: string; max_output_tokens: number; text: { format: { type: "json_schema"; name: string; strict: true; schema: Record<string, unknown> } } };
};
