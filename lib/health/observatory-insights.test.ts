import { expect, it } from "vitest";
import { association, exampleExperience, exampleInsights } from "./observatory-insights";
import { timeline } from "./analysis";
import { syntheticImport } from "./fixture";
import { dates } from "./model";
it("withholds correlations for short, missing, constant or invalid series", () => {
  expect(association(Array.from({ length: 13 }, (_, i) => [i, i])).r).toBeNull();
  expect(association(Array.from({ length: 20 }, () => [1, 2])).r).toBeNull();
  expect(association([[null, 2], [3, null], [NaN, 4]])).toEqual({ r: null, paired: 0, missing: 3 });
  expect(association([...Array.from({ length: 14 }, (_, i): [number, number] => [i, -i]), [null, 2]])).toEqual({ r: -1, paired: 14, missing: 1 });
});
it("generates evidence-bound notes, preserves gaps and excludes unreviewed observations", () => {
  const nights = timeline(syntheticImport().records, "2026-02-01", "2026-02-28", 120, new Set(dates("2026-02-01", "2026-02-28")));
  const insights = exampleInsights(nights);
  expect(insights.signals[0].paired).toBe(25);
  expect(insights.signals[0].missing).toBe(3);
  expect(insights.shifted.has("2026-02-24")).toBe(false);
  expect(insights.notes.some(n => n.id === "sleep-shift")).toBe(true);
  expect(exampleInsights(nights.map(n => ({ ...n, reviewed: false }))).signals.every(s => s.r === null)).toBe(true);
  expect(exampleExperience("2026-03-01")).toBeNull();
});
