import { DAY, HOUR, dates, sourceKey, type Night, type SleepRecord } from "./model";
type Interval = [number, number];
export function union(intervals: Interval[]): Interval[] {
  const merged: Interval[] = [];
  for (const [start, end] of [...intervals].sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}
/** Compare normalized coverage, not stage segmentation. Partial overlap is uncertainty,
 * not proof that either source is wrong. Exact duplicated coverage is harmless. */
function conflictingSources(records: SleepRecord[], clip: (r: SleepRecord) => Interval) {
  const bySource = new Map<string, Interval[]>();
  for (const r of records) {
    if (r.kind === "inBed" || r.kind === "awake") continue;
    const key = sourceKey(r);
    const intervals = bySource.get(key) ?? [];
    intervals.push(clip(r));
    bySource.set(key, intervals);
  }
  if (bySource.size < 2) return false;
  const unique = new Map<string, Interval>();
  for (const intervals of bySource.values())
    for (const interval of union(intervals)) unique.set(JSON.stringify(interval), interval);
  let end = -Infinity;
  for (const [a, b] of [...unique.values()].sort((a, b) => a[0] - b[0])) {
    if (a < end) return true;
    end = b;
  }
  return false;
}
const hours = (xs: Interval[]) =>
  xs.reduce((sum, [a, b]) => sum + (b - a) / HOUR, 0);
export function clockAt(ms: number, offset: number) {
  return new Date(ms + offset * 60_000).toISOString().slice(11, 16);
}
/** Fixed-offset noon-to-noon windows are always 24 elapsed hours. Original offsets remain evidence. */
export function timeline(
  records: SleepRecord[],
  from: string,
  to: string,
  offset: number,
  reviewed: Set<string>,
): Night[] {
  const sorted = [...records].sort((a, b) => a.start - b.start);
  let cursor = 0;
  return dates(from, to).map((day) => {
    const end = Date.parse(day) + 12 * HOUR - offset * 60_000,
      start = end - DAY;
    while (cursor < sorted.length && sorted[cursor].end <= start) cursor++;
    const window: SleepRecord[] = [];
    for (let i = cursor; i < sorted.length && sorted[i].start < end; i++)
      if (sorted[i].end > start) window.push(sorted[i]);
    const clip = (r: SleepRecord): Interval => [
      Math.max(start, r.start),
      Math.min(end, r.end),
    ];
    const sleep = union(
      window.filter((r) => r.kind !== "inBed" && r.kind !== "awake").map(clip),
    );
    const awake = union(window.filter((r) => r.kind === "awake").map(clip));
    let awakeIndex = 0;
    const conflictingWake = sleep.some(([a, b]) => {
      while (awakeIndex < awake.length && awake[awakeIndex][1] <= a)
        awakeIndex++;
      return awakeIndex < awake.length && awake[awakeIndex][0] < b;
    });
    const beds = union(window.filter((r) => r.kind === "inBed").map(clip));
    // Sleep intervals separated by <=90 minutes belong to one candidate main sleep bout.
    const bouts: Interval[][] = [];
    for (const interval of sleep) {
      const last = bouts.at(-1);
      if (last && interval[0] - last.at(-1)![1] <= 1.5 * HOUR)
        last.push(interval);
      else bouts.push([interval]);
    }
    const ranked = [...bouts].sort((a, b) => hours(b) - hours(a));
    const main = ranked[0];
    const offsets = new Set(
      window.flatMap((r) => [r.startOffset, r.endOffset]),
    );
    const uncertaintyReasons: string[] = [];
    if (conflictingWake) uncertaintyReasons.push("Awake and asleep records overlap");
    if (conflictingSources(window, clip)) uncertaintyReasons.push("Sleep sources report different overlapping coverage");
    if (offsets.size > 1 || [...offsets].some(o => o !== offset)) uncertaintyReasons.push("Original timezone offsets differ from the grouping offset");
    if (window.some(r => r.start < start || r.end > end)) uncertaintyReasons.push("A recording crosses the noon-to-noon window boundary");
    return {
      day,
      sleep: main ? hours(main) : null,
      inBed: beds.length ? hours(beds) : null,
      total: sleep.length ? hours(sleep) : null,
      naps: sleep.length ? hours(ranked.slice(1).flat()) : null,
      onset: main ? clockAt(main[0][0], offset) : null,
      waking: main ? clockAt(main.at(-1)![1], offset) : null,
      uncertain: uncertaintyReasons.length > 0,
      uncertaintyReasons,
      reviewed: reviewed.has(day),
      records: window.length,
    };
  });
}
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
export function baseline(nights: Night[]) {
  const valid = nights
    .filter((n) => n.sleep !== null && n.reviewed && !n.uncertain)
    .map((n) => n.sleep!);
  const sufficient = valid.length >= 7 && valid.length / nights.length >= 0.5;
  const value = sufficient ? median(valid) : null;
  return {
    count: valid.length,
    days: nights.length,
    median: value,
    mad: value === null ? null : median(valid.map((n) => Math.abs(n - value))),
  };
}
export function rolling(nights: Night[], index: number) {
  const valid = nights
    .slice(Math.max(0, index - 6), index + 1)
    .filter((n) => n.sleep !== null && n.reviewed && !n.uncertain);
  return {
    n: valid.length,
    value: valid.length >= 4 ? median(valid.map((n) => n.sleep!)) : null,
  };
}
export function changes(
  nights: Night[],
  reference: number | null,
  threshold: number,
  days: number,
): Set<string> {
  const highlighted = new Set<string>();
  if (
    reference === null ||
    !Number.isFinite(threshold) ||
    threshold <= 0 ||
    !Number.isInteger(days) ||
    days < 2
  )
    return highlighted;
  let run: string[] = [],
    direction = 0;
  for (const night of nights) {
    const difference = night.sleep === null ? 0 : night.sleep - reference;
    const sign =
      night.reviewed && !night.uncertain && Math.abs(difference) >= threshold
        ? Math.sign(difference)
        : 0;
    if (!sign || sign !== direction) run = [];
    direction = sign;
    if (!sign) continue;
    run.push(night.day);
    if (run.length >= days) for (const day of run) highlighted.add(day);
  }
  return highlighted;
}

/** Whole sleep bouts, assigned to the source-local waking date. Duration is elapsed
 * UTC time, independent of offset changes. This is not a fixed 24-hour total. */
export function researchTimeline(records: SleepRecord[], from: string, to: string): Night[] {
  const sleepRecords = records.filter(r => r.kind !== "inBed" && r.kind !== "awake");
  const bouts: Interval[][] = [];
  for (const interval of union(sleepRecords.map(r => [r.start, r.end]))) {
    const last = bouts.at(-1);
    if (last && interval[0] - last.at(-1)![1] <= 1.5 * HOUR) last.push(interval);
    else bouts.push([interval]);
  }
  const sortedRecords = [...records].sort((a,b) => a.start-b.start || a.id.localeCompare(b.id));
  let cursor = 0;
  const grouped = new Map<string, Array<{ intervals: Interval[]; records: SleepRecord[]; offset: number }>>();
  for (const intervals of bouts) {
    const start = intervals[0][0], end = intervals.at(-1)![1];
    while (cursor < sortedRecords.length && sortedRecords[cursor].end <= start) cursor++;
    const relevant: SleepRecord[] = [];
    for (let i = cursor; i < sortedRecords.length && sortedRecords[i].start < end; i++)
      if (sortedRecords[i].end > start) relevant.push(sortedRecords[i]);
    const ending = relevant.filter(r => r.end === end && r.kind !== "inBed" && r.kind !== "awake").sort((a,b) => a.id.localeCompare(b.id))[0];
    const day = new Date(end + ending.endOffset * 60_000).toISOString().slice(0,10);
    const group = grouped.get(day) ?? [];
    group.push({ intervals, records: relevant, offset: ending.endOffset });
    grouped.set(day, group);
  }
  return dates(from, to).map(day => {
    const ranked = (grouped.get(day) ?? []).sort((a,b) => hours(b.intervals) - hours(a.intervals));
    const main = ranked[0];
    const relevant = [...new Map(ranked.flatMap(b => b.records).map(r => [r.id, r])).values()];
    const uncertaintyReasons: string[] = [];
    const intervals = ranked.flatMap(b => b.intervals);
    if (relevant.some(r => r.kind === "awake" && intervals.some(([a,b]) => r.start < b && r.end > a))) uncertaintyReasons.push("Awake and asleep records overlap");
    if (conflictingSources(relevant, r => [r.start,r.end])) uncertaintyReasons.push("Sleep sources report different overlapping coverage");
    if (ranked.some(b => b.intervals.at(-1)![1] - b.intervals[0][0] > DAY)) uncertaintyReasons.push("A candidate sleep bout spans more than 24 hours");
    const timingNotes: string[] = [];
    if (new Set(relevant.flatMap(r => [r.startOffset,r.endOffset])).size > 1) timingNotes.push("Multiple source offsets; duration uses elapsed time, local timing needs care");
    const onset = main && relevant.filter(r => r.start === main.intervals[0][0] && r.kind !== "inBed" && r.kind !== "awake").sort((a,b) => a.id.localeCompare(b.id))[0];
    return { day, sleep: main ? hours(main.intervals) : null, total: main ? hours(intervals) : null,
      naps: main ? hours(ranked.slice(1).flatMap(b => b.intervals)) : null, inBed: null,
      onset: main && onset ? clockAt(main.intervals[0][0], onset.startOffset) : null,
      waking: main ? clockAt(main.intervals.at(-1)![1], main.offset) : null,
      uncertain: uncertaintyReasons.length > 0, uncertaintyReasons, timingNotes,
      reviewed: true, records: relevant.length };
  });
}

/** Descriptive summaries need three recordings, not a clinical baseline or a
 * coverage percentage. Missingness is always reported alongside the estimate. */
export function periodSummary(nights: Night[]) {
  const values = nights.filter(n => n.reviewed && !n.uncertain && n.sleep !== null).map(n => n.sleep!);
  const center = values.length >= 3 ? median(values) : null;
  return { from: nights[0]?.day ?? "", to: nights.at(-1)?.day ?? "", days: nights.length,
    count: values.length, missing: nights.filter(n => n.sleep === null).length,
    excluded: nights.filter(n => n.sleep !== null && (n.uncertain || !n.reviewed)).length,
    median: center, mad: center === null ? null : median(values.map(v => Math.abs(v-center))) };
}
export function periodComparisons(nights: Night[]) {
  const periods = [];
  for (let i = 0; i < nights.length; i += 30) periods.push(periodSummary(nights.slice(i, i+30)));
  return { overall: periodSummary(nights), periods };
}
