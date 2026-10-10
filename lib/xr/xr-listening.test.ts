import { describe, expect, it } from "vitest";
import { analyseListening } from "./xr-listening";
import { buildListeningDraft, validateDraftReview, xrReviewSchema } from "./xr-draft";
import { DEMO_XR_SCENE } from "./xr-scene";
const row = (playedAt: string, artistName = "Synthetic A", trackName = "Test track") => ({ playedAt, artistName, trackName, albumName: "Test album", importerProvenance: "synthetic test" });
const doc = (records: ReturnType<typeof row>[]) => ({ schemaVersion: 1, source: "lastfm-scrobbles", importedAt: "2026-09-28T12:00:00Z", records });
describe("deterministic listening analysis", () => {
  it("uses inclusive local dates, excludes out-of-window records and deduplicates", () => {
    const inside = row("2026-05-14T21:00:00Z");
    const a = analyseListening(doc([inside, inside, row("2026-05-14T20:59:59Z"), row("2026-09-28T20:59:59Z"), row("2026-09-28T21:00:00Z")]), "2026-05-15", "2026-09-28");
    expect(a.total).toBe(2); expect(a.duplicatesRemoved).toBe(1);
    expect(a.daily[0].count).toBe(1); expect(a.daily.at(-1)?.count).toBe(1);
  });
  it("identifies distribution changes and observed absence without claiming silence", () => {
    const rows = [0, 7, 21].flatMap((day, j) => Array.from({ length: 12 }, (_, i) => row(new Date(Date.UTC(2026, 4, 15 + day, 12, i)).toISOString(), j ? "Synthetic B" : "Synthetic A")));
    const a = analyseListening(doc(rows), "2026-05-15", "2026-06-15");
    expect(a.transitions).toHaveLength(1); expect(a.transitions[0].distributionChange).toBe(1);
    expect(a.absences[0].label).toBe("Synthetic A"); expect(a.bursts).toHaveLength(3);
    expect(a.concentrations).toHaveLength(3); expect(a.coverage).toContain("not confirmed silence");
    expect(a).toEqual(analyseListening(doc([...rows].reverse()), "2026-05-15", "2026-06-15"));
  });
  it("allows repositioning but preserves evidence during review saves", () => {
    const moved = { ...DEMO_XR_SCENE, cues: DEMO_XR_SCENE.cues.map(c => ({ ...c, x: 3 })) };
    expect(validateDraftReview(DEMO_XR_SCENE, { scene: moved, decisions: {} }).scene.cues[0].x).toBe(3);
    expect(() => validateDraftReview(DEMO_XR_SCENE, { scene: { ...moved, title: "Changed source title" }, decisions: {} })).toThrow("Source evidence");
  });
  it("does not manufacture candidates from empty data or isolated plays", () => {
    const empty = analyseListening(doc([]), "2026-05-15", "2026-05-20");
    expect(empty.candidates).toEqual([]); expect(empty.first).toBeNull();
    expect(analyseListening(doc([row("2026-05-16T12:00:00Z")]), "2026-05-15", "2026-05-20").candidates).toEqual([]);
  });
  it("keeps draft candidates distinct from Author statements and review decisions", () => {
    const a = analyseListening(doc([row("2026-05-16T12:00:00Z"), row("2026-05-16T12:01:00Z")]), "2026-05-15", "2026-05-20");
    const scene = buildListeningDraft(DEMO_XR_SCENE, a, "test-source");
    expect(scene.cues.at(-1)?.evidence?.kind).toBe("source-analysis");
    expect(scene.cues.at(-1)?.evidence?.authorLabels).toEqual([]);
    expect(xrReviewSchema.safeParse({ scene, decisions: { unknown: "accepted" } }).success).toBe(false);
    expect(xrReviewSchema.safeParse({ scene, decisions: { listening: "refused" } }).success).toBe(true);
  });
});
