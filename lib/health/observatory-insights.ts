import { changes, median, periodComparisons } from "./analysis";
import type { Night } from "./model";

/** Invented experience values, never inferred from a person's sleep. */
export function exampleExperience(day: string) {
  const number = Number(day.slice(-2));
  if (!day.startsWith("2026-02-") || number === 12 || number === 24) return null;
  const energy = number > 20 ? [1, 2, 1, 3][number % 4] : [3, 2, 4, 3][number % 4];
  return {
    energy,
    low: number > 20 ? 2 : number % 5 === 0 ? 1 : 0,
    elevated: number % 6 === 0 ? 1 : 0,
    irritable: number > 20 ? 2 : number % 4 === 0 ? 1 : 0,
    context: number === 20 ? "Invented deadline / stress starts" : number === 25 ? "Invented late caffeine" : "",
  };
}
export type Association = { r: number | null; paired: number; missing: number };
/** Descriptive Pearson association; minimum is a design choice, not clinical validation. */
export function association(pairs: Array<[number | null, number | null]>): Association {
  const valid = pairs.filter((pair): pair is [number, number] => pair.every(v => v !== null && Number.isFinite(v)));
  const result: Association = { r: null, paired: valid.length, missing: pairs.length - valid.length };
  if (valid.length < 14) return result;
  const mx = valid.reduce((sum, p) => sum + p[0], 0) / valid.length;
  const my = valid.reduce((sum, p) => sum + p[1], 0) / valid.length;
  let numerator = 0, xx = 0, yy = 0;
  for (const [x, y] of valid) { numerator += (x - mx) * (y - my); xx += (x - mx) ** 2; yy += (y - my) ** 2; }
  if (xx > 0 && yy > 0) result.r = Math.max(-1, Math.min(1, numerator / Math.sqrt(xx * yy)));
  return result;
}
export function observatoryInsights(nights: Night[], experience: typeof exampleExperience = () => null, synthetic = false) {
  const usable = (n: Night) => n.reviewed && !n.uncertain ? n.sleep : null;
  const first = (synthetic ? nights.slice(0, 14) : nights).map(usable).filter((v): v is number => v !== null);
  const reference = synthetic ? (first.length >= 7 && first.length >= Math.min(nights.length, 14) / 2 ? median(first) : null) : (first.length >= 7 ? median(first) : null);
  const shifted = changes(nights, reference, 1, 3);
  const signals = (["energy", "low", "elevated", "irritable"] as const).map(signal => ({
    signal,
    label: { energy: "energy", low: "low mood", elevated: "elevated mood", irritable: "irritability" }[signal],
    ...association(nights.map(n => [usable(n), experience(n.day)?.[signal] ?? null])),
  }));
  const notes: Array<{ id: string; title: string; evidence: string; uncertainty: string }> = [];
  if (!synthetic && nights.length) {
    const { overall, periods } = periodComparisons(nights);
    const format = (p: typeof overall) => `${p.from} to ${p.to}: ${p.count}/${p.days} usable dates, ${p.missing} missing, ${p.excluded} excluded; median of recorded dates ${p.median === null ? "unavailable (fewer than 3 recordings)" : p.median.toFixed(2) + " h"}, median absolute deviation ${p.mad === null ? "unavailable" : p.mad.toFixed(2) + " h"}.`;
    notes.push({ id: "duration-coverage", title: "Recorded sleep across the full period", evidence: format(overall), uncertainty: "Main-bout elapsed durations, grouped by source-local waking date. Missing dates are unknown, not zero. Timezone changes alone do not exclude duration. Incomplete recordings can underestimate sleep; Observed dates may not represent missing dates. This is not an estimate of typical sleep across all dates; missingness may be related to sleep itself, and the direction of bias is unknown." });
    notes.push({ id: "period-comparison", title: "Sleep in consecutive 30-day periods", evidence: periods.map(format).join(" "), uncertainty: "At least 3 usable recordings per median is an analytical display rule, not a clinical criterion. The final period may be shorter. Different coverage and source availability can explain differences; these are descriptions, not causal or diagnostic findings." });
    const firstPeriod = periods[0], lastPeriod = periods.at(-1)!;
    if (periods.length > 1 && firstPeriod.median !== null && lastPeriod.median !== null) {
      const difference = lastPeriod.median - firstPeriod.median;
      notes.push({ id: "period-difference", title: "First and last period compared", evidence: `Last-period recorded-date median minus first-period recorded-date median: ${difference.toFixed(2)} h; ${firstPeriod.count} versus ${lastPeriod.count} usable dates.`, uncertainty: "This is a difference between observed subsets, not proof of a steady trend. No interpolation or missing-data imputation is applied." });
    }
  }
  if (shifted.size) notes.push({ id: "sleep-shift", title: "A sustained sleep change is worth investigating",
    evidence: `${[...shifted].join(", ")}: recorded sleep differs by at least 1 hour from ${synthetic ? "the first 14-window comparison" : "the full-period median"} across runs of at least 3 usable nights.`,
    uncertainty: "Gaps break a run. This descriptive rule does not identify an episode or establish reduced need for sleep." });
  for (const signal of signals.filter(s => s.r !== null && Math.abs(s.r) >= 0.5)) notes.push({
    id: `association-${signal.signal}`, title: `Sleep and ${signal.label} vary together ${synthetic ? "in this example" : "in these recordings"}`,
    evidence: `Pearson r = ${signal.r!.toFixed(2)} across ${signal.paired} paired days; ${signal.missing} days excluded for missing or uncertain data.`,
    uncertainty: `Exploratory same-day association only. ${synthetic ? "These invented values demonstrate the analysis; " : ""}serial dependence, shared trends and context can explain an association. No causal or predictive claim.` });
  const contexts = nights.filter(n => experience(n.day)?.context);
  if (contexts.length) notes.push({ id: "context", title: "Context to compare with the timing of changes",
    evidence: contexts.map(n => `${n.day}: ${experience(n.day)!.context}`).join("; "),
    uncertainty: "Annotations are displayed alongside the sleep changes. They do not establish a cause or indicate a clinical episode." });
  return { signals, notes, shifted, reference };
}

export const exampleInsights = (nights: Night[]) => observatoryInsights(nights, exampleExperience, true);
