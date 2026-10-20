import type { CycleContext } from "./cycle-context";
import type { SleepRecord } from "./model";
export type ResearchNote = { id: string; title: string; evidence: string; uncertainty: string };
export type ResearchRun = { id: string; at: string; algorithm: "observatory-v1" | "observatory-v2" | "observatory-v3" | "observatory-v4"; source?: string | null; digest: string; range?: { from: string; to: string; offset: number }; recordCount?: number; omitted?: number; notes: ResearchNote[]; change: string };
export type ResearchJournal = {
  version: 1; connected: boolean; mode: "synthetic" | "healthkit"; source: string | null;
  history: ResearchRun[]; dropped: number;
  refreshRequired?: boolean;
  cycleContext?: CycleContext;
  hypothesis?: { text: string; enteredAt: string; from: string; to: string };
};
export type ResearchView = {
  journal: ResearchJournal | null; records: SleepRecord[];
  range: { from: string; to: string; offset: number };
  sources: Array<{ key: string; label: string; count: number }>;
  omitted: number;
  unavailable?: boolean;
};

/** Individual source keys are JSON arrays, so this value cannot collide. */
export const ALL_SLEEP_SOURCES = "all";
