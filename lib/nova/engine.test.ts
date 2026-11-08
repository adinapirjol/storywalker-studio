import { describe, expect, it } from "vitest";
import { initialState, type Evidence, type LoopState, type Rejection } from "./contracts";
import { reconcile, transition } from "./engine";
import { normalize } from "./normalize";
const now = "2026-01-06T12:00:00Z";
function row(id: string, day: string, track = "Fictional track", artist = "Fictional artist"): Evidence {
  return { id, sourceId: "import:lastfm-history:v1", revision: "v1", title: id, excerpt: null, sourceType: "lastfm", timestamp: `${day}T10:00:00Z`, temporalPrecision: "instant", location: null, artist, track, provenance: "fictional regression fixture", authority: "source-recorded", caveat: "No meaning inferred", gaps: [] };
}
const evidence = [row("a", "2026-01-05"), row("b", "2026-01-04"), row("c", "2026-01-03", "Different fictional track")];
const setup = (): LoopState => ({ ...initialState(), enabled: true, sourceIds: [evidence[0].sourceId] });
function analyze(state = setup(), rows = evidence, at = now) { return transition(state, rows, { action: "analyze", expectedRevision: state.revision }, at).state; }
function reject(state: LoopState, reason: Rejection, id = state.hypotheses[0].id) {
  return transition(state, evidence, { action: "reject", expectedRevision: state.revision, hypothesisId: id, reason, note: "" }, now);
}
describe("local grounded loop", () => {
  it("creates traceable cues, never calibrated probabilities or invented support", () => {
    const state = analyze(); expect(state.hypotheses).toHaveLength(2);
    for (const h of state.hypotheses) { expect(h.refs.every(r => evidence.some(e => e.id === r.id))).toBe(true); expect(h.confidence).toBe("uncalibrated"); }
  });
  it("does not infer from missing provenance, missing time or missing evidence", () => {
    expect(analyze(setup(), evidence.map(e => ({ ...e, provenance: null }))).hypotheses).toEqual([]);
    expect(analyze(setup(), evidence.map(e => ({ ...e, timestamp: null }))).hypotheses).toEqual([]);
    expect(analyze(setup(), []).hypotheses).toEqual([]);
  });
  it("is idempotent and rate limited", () => {
    const first = analyze(); expect(() => analyze(first)).toThrow("three seconds");
    expect(analyze(first, evidence, "2026-01-06T12:00:04Z").hypotheses).toEqual(first.hypotheses);
  });
  it("invalidates approved connections on source correction, deletion or revocation", () => {
    const first = analyze(); const h = first.hypotheses[0];
    const accepted = transition(first, evidence, { action: "approve", expectedRevision: first.revision, hypothesisId: h.id }, now).state;
    expect(reconcile(accepted, []).hypotheses.every(h => h.status === "invalidated")).toBe(true);
    expect(reconcile(accepted, evidence.map(e => ({ ...e, revision: "v2" }))).hypotheses[0].status).toBe("invalidated");
    expect(reconcile({ ...accepted, sourceIds: [] }, evidence).hypotheses[0].status).toBe("invalidated");
  });
  it("preserves revision lineage and source evidence on modification", () => {
    const first = analyze(); const original = structuredClone(evidence);
    const next = transition(first, evidence, { action: "modify", expectedRevision: first.revision, hypothesisId: first.hypotheses[0].id, interpretation: "My interpretation", relationship: "author-association", evidenceIds: ["a", "c"] }, now).state;
    expect(next.hypotheses[0].status).toBe("superseded"); expect(next.hypotheses.at(-1)?.supersedes).toBe(first.hypotheses[0].id); expect(evidence).toEqual(original);
    expect(() => transition(first, evidence, { action: "modify", expectedRevision: first.revision, hypothesisId: first.hypotheses[0].id, interpretation: "x", relationship: "author-association", evidenceIds: ["a", "unknown"] }, now)).toThrow();
  });
  it("blocks stale writes and decisions after evidence changed", () => {
    const state = analyze(); expect(() => transition(state, evidence, { action: "pause", expectedRevision: 0, paused: true }, now)).toThrow();
    expect(() => transition(state, [], { action: "approve", expectedRevision: state.revision, hypothesisId: state.hypotheses[0].id }, now)).toThrow();
  });
  it.each(["never-again", "incorrect-evidence", "insufficient-evidence", "not-now"] as Rejection[])("stops automatic alternatives for %s", reason => {
    const result = reject(analyze(), reason); expect(result.message).toContain("No justified alternative"); expect(result.state.decisions[0].reason).toBe(reason);
  });
  it("never-again invalidates queued neighbors and survives source revision changes", () => {
    const rejected = reject(analyze(), "never-again").state;
    expect(rejected.hypotheses.filter(h => ["proposed", "approved"].includes(h.status))).toHaveLength(0);
    const next = analyze(rejected, evidence.map(e => ({ ...e, id: `${e.id}-corrected`, revision: "v2" })), "2026-01-06T12:00:04Z");
    expect(next.hypotheses).toEqual(rejected.hypotheses);
  });
  it("does-not-fit generates at most one alternative with different pair and basis", () => {
    const state = analyze(setup(), evidence.slice(0, 2));
    const result = reject(state, "does-not-fit");
    const alternative = result.state.hypotheses.find(h => h.alternativeTo);
    expect(alternative?.relationship).toBe("same-artist"); expect(alternative?.refs.map(r => r.id)).toContain("c");
    expect(result.state.hypotheses.filter(h => h.alternativeTo)).toHaveLength(1);
  });
  it("other uses explicit feedback and no-alternative is valid", () => {
    const first = analyze(); const result = reject(first, "other");
    expect(result.message).toContain("No justified alternative"); expect(result.state.hypotheses).toHaveLength(first.hypotheses.length);
  });
  it("incorrect evidence quarantines intersecting current revisions", () => {
    const result = reject(analyze(), "incorrect-evidence").state;
    expect(result.hypotheses.filter(h => h.status === "proposed")).toHaveLength(0);
  });
  it("insufficient evidence can reconsider after an actual source correction", () => {
    const result = reject(analyze(setup(), evidence.slice(0, 2)), "insufficient-evidence").state;
    const corrected = evidence.slice(0, 2).map(e => ({ ...e, revision: "v2" }));
    expect(analyze(result, corrected, "2026-01-06T12:00:04Z").hypotheses.some(h => h.status === "proposed")).toBe(true);
  });
  it("pauses generation, disables source access, and defaults telemetry off", () => {
    const state = analyze(); expect(state.metrics).toEqual({});
    expect(() => analyze({ ...state, paused: true })).toThrow();
    const disabled = transition(state, evidence, { action: "disable", expectedRevision: state.revision }, now).state;
    expect(disabled.sourceIds).toEqual([]); expect(disabled.hypotheses.every(h => h.status === "invalidated")).toBe(true);
  });
  it("metrics are opt-in, inspectable and deletable", () => {
    const state = analyze({ ...setup(), metricsEnabled: true }); expect(state.metrics.generated).toBe(2);
    const cleared = transition(state, evidence, { action: "delete-metrics", expectedRevision: state.revision }, now).state;
    expect(cleared.metrics).toEqual({}); expect(cleared.metricsEnabled).toBe(false);
  });
});
describe("typed real-source adapter with fictional fixtures", () => {
  it("preserves missing capture dates and never substitutes save time", () => {
    const result = normalize({ id: "capture:test", kind: "capture", capturedAt: now, payload: { title: "Fictional capture", when: "sometime", evidenceStatus: "author-stated" } });
    expect(result.evidence[0].timestamp).toBeNull(); expect(result.evidence[0].gaps).toContain("Missing or ambiguous event timestamp");
  });
  it("rejects unsupported, revoked or malformed records", () => {
    expect(normalize({ id: "native:test", kind: "capture", capturedAt: now, payload: {} }).evidence).toEqual([]);
    expect(normalize({ id: "capture:test", kind: "capture", capturedAt: now, payload: { consent: false } }).evidence).toEqual([]);
    expect(normalize({ id: "import:lastfm-history:v1", kind: "import", capturedAt: now, payload: { document: {} } }).evidence).toEqual([]);
  });
  it("deduplicates and keeps row identities stable when imports append", () => {
    const raw = { playedAt: now, trackName: "Fictional track", artistName: "Fictional artist", importerProvenance: "fixture" };
    const source = { id: "import:lastfm-history:v1", kind: "import" as const, capturedAt: now, payload: { document: { schemaVersion: 1, source: "lastfm-scrobbles", importedAt: now, records: [raw, raw] } } };
    const one = normalize(source); expect(one.evidence).toHaveLength(1);
    source.payload.document.records.push({ ...raw, playedAt: "2026-01-05T12:00:00Z" });
    expect(normalize(source).evidence[0].id).toBe(one.evidence[0].id);
  });
});

it("reports the import processing bound without silently sampling an oversized source", () => {
  const result = normalize({ id: "import:lastfm-history:v1", kind: "import", capturedAt: now, payload: { document: { records: Array(50001).fill(null) } } });
  expect(result.evidence).toEqual([]); expect(result.gaps[0]).toContain("50,000-row");
});
it("collapses near-duplicate recurring-label proposals", () => {
  const rows = [row("a", "2026-01-01"), row("b", "2026-01-02"), row("c", "2026-01-03"), row("d", "2026-01-04")];
  expect(analyze(setup(), rows).hypotheses).toHaveLength(1);
});

it("explicit reauthorization permits a fresh proposal but never silently restores approval", () => {
  let state = analyze(setup(), evidence.slice(0, 2));
  const oldId = state.hypotheses[0].id;
  state = transition(state, evidence, { action: "approve", expectedRevision: state.revision, hypothesisId: oldId }, now).state;
  state = transition(state, evidence, { action: "disable", expectedRevision: state.revision }, now).state;
  state = transition(state, evidence, { action: "configure", expectedRevision: state.revision, sourceIds: setup().sourceIds, consent: true }, now).state;
  state = analyze(state, evidence.slice(0, 2), "2026-01-06T12:00:04Z");
  expect(state.hypotheses[0].status).toBe("invalidated");
  expect(state.hypotheses[1]).toMatchObject({ status: "proposed", supersedes: oldId });
});
it("explores an explicit selection in one transition, retaining consent and revision checks", () => {
  const original = initialState();
  const result = transition(original, evidence, { action: "configure", expectedRevision: 0, sourceIds: setup().sourceIds, consent: true, analyze: true }, now);
  expect(result.state.revision).toBe(1);
  expect(result.state.hypotheses).toHaveLength(2);
  expect(original.sourceIds).toEqual([]);
  expect(() => transition(result.state, evidence, { action: "configure", expectedRevision: 0, sourceIds: setup().sourceIds, consent: true, analyze: true }, now)).toThrow();
});
it("saving a selection alone still does not run analysis", () => {
  const result = transition(initialState(), evidence, { action: "configure", expectedRevision: 0, sourceIds: setup().sourceIds, consent: true }, now);
  expect(result.state.hypotheses).toEqual([]);
});
