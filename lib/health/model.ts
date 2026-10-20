/** HEALTH stays separate from generic Vault captures and public research envelopes. */
export type SleepKind = "inBed" | "awake" | "asleep" | "core" | "deep" | "rem";
export type SleepRecord = {
  id: string;
  source: string;
  sourceVersion: string;
  device: string;
  startRaw: string;
  endRaw: string;
  creationRaw: string;
  start: number;
  end: number;
  startOffset: number;
  endOffset: number;
  kind: SleepKind;
  ordinal: number;
};
export const ratings = {
  low: "Low mood",
  elevated: "Elevated mood",
  irritable: "Irritable mood",
  energy: "Energy",
  sleepiness: "Sleepiness",
  rested: "Restedness",
  racing: "Racing thoughts / difficulty slowing down",
} as const;
export type RatingKey = keyof typeof ratings;
export type Rating = number | "unknown" | "skipped";
export type Diary = {
  id: string;
  day: string;
  enteredAt: string;
  entryOffset: number;
  mode: "contemporaneous" | "retrospective";
  certainty: "unknown" | "low" | "medium" | "high";
  ratings: Record<RatingKey, Rating>;
  wantedMore: "unknown" | "skipped" | "yes" | "no";
  activity: "unknown" | "skipped" | "less" | "usual" | "more";
  impulsivity: string;
  functioning: string;
  medication: string;
  substances: string;
  illness: string;
  travel: string;
  stress: string;
};
export type Night = {
  day: string;
  sleep: number | null;
  inBed: number | null;
  naps: number | null;
  total: number | null;
  onset: string | null;
  waking: string | null;
  uncertain: boolean;
  uncertaintyReasons?: string[];
  timingNotes?: string[];
  reviewed: boolean;
  records: number;
};
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export function dayKey(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}
export function dates(from: string, to: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    return [];
  const start = Date.parse(from),
    end = Date.parse(to);
  if (!Number.isFinite(start + end) || end < start || end - start > 730 * DAY)
    return [];
  return Array.from({ length: Math.round((end - start) / DAY) + 1 }, (_, i) =>
    dayKey(start + i * DAY),
  );
}
export function sourceKey(r: Pick<SleepRecord, "source" | "device">) {
  return JSON.stringify([r.source, r.device]);
}
