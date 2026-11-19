import { expect, it } from "vitest";
import { reconsiderReading } from "./reconsider";
import { initialState, type Command } from "./contracts";
import { normalize } from "./normalize";
import { transition, reconcile, forbidden } from "./engine";
import { connectionEditorial } from "./editorial";
import { researchPayload } from "@/lib/research/research-session";

function fixture() {
  const at = "2026-01-01T12:00:00.000Z";
  const evidence = ["a", "b"].flatMap(id => normalize({ id: `capture:${id}`, kind: "capture", capturedAt: at, payload: { title: `Fictional ${id}`, when: "2026-01-01", evidenceStatus: "author-stated" } }).evidence);
  const configured = transition(initialState(), evidence, { action: "configure", expectedRevision: 0, sourceIds: evidence.map(e => e.sourceId), consent: true, analyze: true }, at).state;
  const original = configured.hypotheses[0];
  const record = { id: "research-session:fictional", kind: "capture" as const, capturedAt: at, payload: researchPayload(connectionEditorial(original, "I do not recognize this.", "The name suggests returning.", at), at) };
  const command: Extract<Command, { action: "propose-reading" }> = { action: "propose-reading", expectedRevision: configured.revision, hypothesisId: original.id, readingId: record.id, consent: true, interpretation: "Could returning become a creative question?", experiment: "Try two readings, then decide." };
  return { at, evidence, configured, original, record, command };
}
it("adds an unapproved grounded alternative, preserves history, deduplicates and invalidates when the response disappears", () => {
  const f = fixture();
  const next = reconsiderReading(f.configured, f.evidence, f.record, f.command, f.at);
  expect(next.hypotheses[0]).toEqual(f.original);
  expect(next.decisions).toEqual(f.configured.decisions);
  expect(next.hypotheses[1]).toMatchObject({ status: "proposed", alternativeTo: f.original.id, readingId: f.record.id, modelVersion: "conversation-assisted-v1" });
  const all = [...f.evidence, ...normalize(f.record).evidence];
  expect(reconsiderReading(next, all, f.record, f.command, f.at).hypotheses).toHaveLength(2);
  const revised = transition(next, all, { action: "modify", expectedRevision: next.revision, hypothesisId: next.hypotheses[1].id, relationship: "author-association", interpretation: "My own wording about return.", evidenceIds: [f.record.id] }, f.at).state;
  expect(revised.hypotheses.at(-1)).toMatchObject({ status: "modified", supersedes: next.hypotheses[1].id, readingId: f.record.id });
  expect(reconcile(next, f.evidence).hypotheses[1].status).toBe("invalidated");
});
it("rejects revoked, unrelated and fictional readings and honors pause and source boundaries", () => {
  const f = fixture();
  for (const patch of [{ consent: false }, { mode: "fictional" }, { entries: [] }]) {
    expect(() => reconsiderReading(f.configured, f.evidence, { ...f.record, payload: { ...f.record.payload, ...patch } }, f.command, f.at)).toThrow();
  }
  expect(() => reconsiderReading({ ...f.configured, paused: true }, f.evidence, f.record, f.command, f.at)).toThrow();
  const next = reconsiderReading(f.configured, f.evidence, f.record, f.command, f.at);
  next.decisions.push({ id: "d", hypothesisId: f.original.id, action: "reject", reason: "never-again", at: f.at, note: "" });
  expect(forbidden(next, next.hypotheses[1])).toBe(true);
});
it("uses an Author response to reconsider an archived connection without reviving its old evidence", () => {
  const f = fixture();
  const next = reconsiderReading(f.configured, [], f.record, f.command, f.at);
  expect(next.hypotheses[0].status).toBe("invalidated");
  expect(next.hypotheses[1].refs.map(r => r.sourceId)).toEqual([f.record.id]);
  expect(reconcile(next, normalize(f.record).evidence).hypotheses[1].status).toBe("proposed");
});
it("generates one local prompt directly from an observation, preserves history and does not approve it", () => {
  const f = fixture();
  const record = { ...f.record, payload: researchPayload(connectionEditorial(f.original, "Fictional doorway makes me think of return.", "", f.at), f.at) };
  const command = { action: "reconsider-reading" as const, expectedRevision: f.configured.revision, hypothesisId: f.original.id, readingId: record.id, consent: true as const };
  const next = reconsiderReading(f.configured, f.evidence, record, command, f.at);
  const proposal = next.hypotheses[1];
  expect(proposal).toMatchObject({ modelVersion: "local-reflection-v1", status: "proposed", alternativeTo: f.original.id, readingId: record.id });
  expect(proposal.interpretation).toContain(record.payload.note);
  expect(next.hypotheses[0]).toEqual(f.original);
  expect(next.decisions).toEqual([]);
  const all = [...f.evidence, ...normalize(record).evidence];
  expect(reconsiderReading(next, all, record, command, f.at).hypotheses).toHaveLength(2);
  const rejected = transition(next, all, { action: "reject", expectedRevision: next.revision, hypothesisId: proposal.id, reason: "does-not-fit", note: "" }, f.at).state;
  expect(reconsiderReading(rejected, all, record, command, f.at).hypotheses.find(h => h.id === proposal.id)?.status).toBe("rejected");
  expect(() => reconsiderReading({ ...f.configured, paused: true }, f.evidence, record, command, f.at)).toThrow();
});
it("retains an explicit boundary across multiple generations of Author responses", () => {
  const f = fixture();
  const second = reconsiderReading(f.configured, f.evidence, f.record, f.command, f.at);
  const secondProposal = second.hypotheses[1];
  const response = { ...f.record, id: "research-session:second-fictional", payload: researchPayload(connectionEditorial(secondProposal, "Another fictional response.", "", f.at), f.at) };
  const third = reconsiderReading(second, [...f.evidence, ...normalize(f.record).evidence], response, { action: "reconsider-reading", expectedRevision: second.revision, hypothesisId: secondProposal.id, readingId: response.id, consent: true }, f.at);
  third.decisions.push({ id: "boundary", hypothesisId: f.original.id, action: "reject", reason: "never-again", at: f.at, note: "" });
  expect(forbidden(third, third.hypotheses[2])).toBe(true);
});
it("treats playlist snapshots as context, never as a dated listening observation", () => {
  const at = "2026-01-01T12:00:00.000Z";
  const result = normalize({ id: "import:spotify-playlist:fictional", kind: "import", capturedAt: at, payload: { snapshot: {
    schemaVersion: 2, source: "spotify-playlist", playlist: { id: "fictional", name: "Fictional return" }, importedAt: at,
    rawOrder: "spotify-playlist-position", occurrenceCount: 0, missingTimestampPositions: [], unavailablePositions: [], occurrences: [], chronologicalOccurrencePositions: [],
  } } });
  expect(result.evidence[0]).toMatchObject({ sourceType: "spotify-playlist-context", timestamp: null, artist: null, track: null });
  expect(result.evidence[0].caveat).toContain("not proof of listening");
});
