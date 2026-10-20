import { z } from "zod";
import type { ResearchNote } from "./research-journal";

/** Calendar self-report only. No phase estimation or automatic day progression. */
export const cycleContextSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const time = Date.parse(value);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
  }),
  day: z.number().int().min(1).max(366),
  expectedLength: z.number().int().min(1).max(366).optional(),
  included: z.boolean(),
}).strict();
export type CycleContext = z.infer<typeof cycleContextSchema>;

export function selectedCycleContext(context: CycleContext | undefined, range: { from: string; to: string }): CycleContext | undefined {
  if (!context?.included || context.date < range.from || context.date > range.to) return undefined;
  return context;
}

export function cycleContextNote(context: CycleContext): ResearchNote {
  return {
    id: "cycle-context",
    title: "Optional cycle context · self-reported",
    evidence: `${context.date}: reported cycle day ${context.day}.${context.expectedLength === undefined ? " Expected cycle length unknown." : ` Expected cycle length ${context.expectedLength} days (self-reported, not a completed-cycle measurement).`}`,
    uncertainty: "Calendar context only. No hormonal phase, ovulation, mood, symptoms or causes inferred. Sleep calculations are unchanged; no prediction is generated.",
  };
}
