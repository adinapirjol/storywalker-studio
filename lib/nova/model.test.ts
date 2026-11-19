import { beforeEach, expect, it, vi } from "vitest";
import { initialState, type Evidence, type Hypothesis } from "./contracts";
import { connectionEditorial } from "./editorial";
import { researchPayload } from "@/lib/research/research-session";
import { modelOutputSchema, type ModelSelection } from "./model-contract";
const mocks = vi.hoisted(() => ({ view: vi.fn(), read: vi.fn(), current: vi.fn() }));
vi.mock("./store", () => ({ loopView: mocks.view }));
vi.mock("@/lib/vault/private-vault", () => ({ readVaultRecord: mocks.read, assertVaultSnapshotCurrent: mocks.current }));
import { prepareModelPacket, validateModelOutput, modelHypothesis } from "./model-packet";
import { requestModel } from "./model-transport";
const at = "2026-01-01T00:00:00.000Z";
const original: Hypothesis = { id: "hypothesis:fixture", key: "fixture", refs: [{ id: "capture:a", sourceId: "capture:a", revision: "v1" }], relationship: "author-association", interpretation: "Could this fictional crossing be an arrival?", observation: "Fictional author context", uncertainty: "Unknown", validation: "Ask", contradictingEvidence: [], reason: "Fixture", createdAt: at, modelVersion: "local-reflection-v1", confidence: "uncalibrated", status: "proposed" };
const note = "The fictional name makes me think of returning, not arriving.";
const record = { id: "research-session:fixture", kind: "capture", capturedAt: at, payload: researchPayload(connectionEditorial(original, note, "An optional fictional editorial sentence.", at), at) };
const selection: ModelSelection = { expectedRevision: 0, hypothesisId: original.id, readingId: record.id, observationExcerpt: note, editorialExcerpt: "", includeOriginal: false, evidenceIds: [] };
const output = modelOutputSchema.parse({ outcome: "proposal", interpretation: "Could the crossing become a rehearsal of return?", rationale: "The Author contrasts returning with arriving.", whatChanged: "Destination becomes repetition.", uncertainty: "A creative association, not travel evidence.", experiment: "Repeat the fictional crossing with two different endings.", grounds: [{ source: "observation", quote: "returning, not arriving" }] });
beforeEach(() => {
  vi.unstubAllGlobals(); vi.clearAllMocks();
  mocks.view.mockReturnValue({ state: { ...initialState(), enabled: true, hypotheses: [structuredClone(original)] }, evidence: [] });
  mocks.read.mockReturnValue(structuredClone(record));
});
it("previews exactly the selected text with no Vault IDs, unrelated context or hidden transcript", () => {
  const packet = prepareModelPacket({} as never, selection);
  expect(packet.body.store).toBe(false);
  expect(packet.items).toEqual([{ source: "observation", kind: "Author observation", text: note }]);
  expect(packet.body.input).not.toContain("research-session:");
  expect(packet.body.input).not.toContain("optional fictional");
  expect(packet.body.input).not.toContain("arrival?");
  expect(packet.body).not.toHaveProperty("tools");
  expect(packet.body).not.toHaveProperty("previous_response_id");
  expect(packet.preview.body).toEqual(packet.body);
});
it("rejects unsaved text, revoked responses, missing context, paused inference and stale revisions", () => {
  expect(() => prepareModelPacket({} as never, { ...selection, observationExcerpt: "Unstored words" })).toThrow();
  expect(() => prepareModelPacket({} as never, { ...selection, expectedRevision: 1 })).toThrow();
  expect(() => prepareModelPacket({} as never, { ...selection, evidenceIds: ["not-accessible"] })).toThrow();
  mocks.read.mockReturnValue({ ...record, payload: { ...record.payload, consent: false } });
  expect(() => prepareModelPacket({} as never, selection)).toThrow();
  mocks.read.mockReturnValue(record);
  mocks.view().state.paused = true;
  expect(() => prepareModelPacket({} as never, selection)).toThrow();
});
it("binds the preview to model, evidence revisions and the selected text", () => {
  const first = prepareModelPacket({} as never, selection);
  const other = prepareModelPacket({} as never, { ...selection, includeOriginal: true });
  expect(other.snapshotHash).not.toBe(first.snapshotHash);
  mocks.read.mockReturnValue({ ...record, payload: { ...record.payload, revision: 2 } });
  expect(prepareModelPacket({} as never, selection).snapshotHash).not.toBe(first.snapshotHash);
});
it("requires real supplied citations and preserves pending status and history", () => {
  const packet = prepareModelPacket({} as never, selection);
  expect(() => validateModelOutput(output, packet)).not.toThrow();
  expect(() => validateModelOutput({ ...output, grounds: [{ source: "invented", quote: note }] }, packet)).toThrow();
  expect(() => validateModelOutput({ ...output, grounds: [{ source: "observation", quote: "invented quotation" }] }, packet)).toThrow();
  expect(() => validateModelOutput({ ...output, grounds: [] }, packet)).toThrow();
  expect(() => validateModelOutput({ ...output, grounds: [{ source: "observation", quote: " " }] }, packet)).toThrow();
  expect(() => validateModelOutput({ ...output, outcome: "no-proposal", rationale: "" }, packet)).toThrow();
  const h = modelHypothesis(output, packet, at);
  expect(h).toMatchObject({ status: "proposed", alternativeTo: original.id, readingId: record.id, modelVersion: "consented-model-v1" });
  expect(mocks.view().state.hypotheses).toHaveLength(1);
});
it("does not repeat a model packet even after its proposal is rejected", () => {
  const packet = prepareModelPacket({} as never, selection);
  mocks.view().state.hypotheses.push({ ...modelHypothesis(output, packet, at), status: "rejected" });
  expect(() => prepareModelPacket({} as never, selection)).toThrow("already has");
});
it("includes only explicitly checked evidence and cites its current revision", () => {
  mocks.view().state.sourceIds = ["capture:a"];
  mocks.view().evidence = [{ id: "capture:a", sourceId: "capture:a", revision: "v1", title: "Fictional note", excerpt: "Fictional context", authority: "author-stated", provenance: "Author", caveat: "Unconfirmed" } as Evidence];
  const packet = prepareModelPacket({} as never, { ...selection, evidenceIds: ["capture:a"] });
  expect(packet.items.map(i => i.source)).toEqual(["observation", "evidence-1"]);
  expect(packet.refs).toContainEqual({ id: "capture:a", sourceId: "capture:a", revision: "v1" });
});
it("parses REST structured output and does not retry errors or expose their body", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }] })));
  vi.stubGlobal("fetch", fetcher);
  const packet = prepareModelPacket({} as never, selection);
  expect(await requestModel(packet.body, "fictional-key", new AbortController().signal)).toEqual(output);
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls[0][0]).toBe("https://api.openai.com/v1/responses");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(packet.preview.body);
  fetcher.mockClear().mockResolvedValue(new Response("PRIVATE-ERROR-CANARY", { status: 500 }));
  await expect(requestModel(packet.body, "fictional-key", new AbortController().signal)).rejects.toThrow("MODEL_UNAVAILABLE");
  expect(fetcher).toHaveBeenCalledOnce();
});
it("discards refusals, incomplete and oversized responses", async () => {
  const packet = prepareModelPacket({} as never, selection);
  for (const result of [{ status: "incomplete" }, { status: "completed", output: [{ type: "message", content: [{ type: "refusal" }] }] }]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(result))));
    await expect(requestModel(packet.body, "fixture", new AbortController().signal)).rejects.toThrow();
  }
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x".repeat(262145))));
  await expect(requestModel(packet.body, "fixture", new AbortController().signal)).rejects.toThrow("MODEL_OVERSIZE");
});
it("reports exhausted quota without leaking provider messages or credentials", async () => {
  const packet = prepareModelPacket({} as never, selection);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { type: "insufficient_quota", code: "credit_balance_exhausted", message: "PRIVATE-PROVIDER-CANARY" } }), { status: 429 })));
  await expect(requestModel(packet.body, "fixture", new AbortController().signal)).rejects.toThrow("no available credit or quota");
});
