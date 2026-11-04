import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { initialState } from "./contracts";
import { issueModelPreviewPermit } from "./model-permit";
const mocks = vi.hoisted(() => ({ active: vi.fn(), withVault: vi.fn(), prepare: vi.fn(), validate: vi.fn(), hypothesis: vi.fn(), model: vi.fn(), view: vi.fn(), write: vi.fn(), guard: vi.fn(), forbidden: vi.fn() }));
vi.mock("@/lib/vault/vault-session", () => ({ VAULT_SESSION_COOKIE: "vault", vaultSessionActive: mocks.active, vaultSessionFailure: () => undefined, assertVaultSessionActive: mocks.guard }));
vi.mock("@/lib/vault/vault-route-access", () => ({ withBrowserVault: mocks.withVault }));
vi.mock("@/lib/vault/private-vault", () => ({ assertVaultSnapshotCurrent: mocks.guard }));
vi.mock("./model-packet", () => ({ prepareModelPacket: mocks.prepare, validateModelOutput: mocks.validate, modelHypothesis: mocks.hypothesis }));
vi.mock("./model-transport", () => ({ requestModel: mocks.model, ModelConfigurationError: class extends Error {} }));
vi.mock("./store", () => ({ loopView: mocks.view, writeLoopState: mocks.write }));
vi.mock("./engine", async importOriginal => ({ ...await importOriginal<typeof import("./engine")>(), forbidden: mocks.forbidden }));
import { POST } from "@/app/api/nova/model/route";
const selection = { expectedRevision: 0, hypothesisId: "h", readingId: "research-session:r", observationExcerpt: "Fictional observation", editorialExcerpt: "", includeOriginal: false, evidenceIds: [] };
const modelKey = Buffer.from("fictional model route Vault key");
const requestId = "00000000-0000-4000-8000-000000000001";
const snapshotHash = "a".repeat(64);
const command = { action: "generate", selection, requestId, snapshotHash, ...issueModelPreviewPermit(modelKey, requestId, snapshotHash), consent: true };
function request(body: unknown, origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/nova/model", { method: "POST", headers: { host: "localhost:3000", origin, cookie: "vault=fixture" }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("OPENAI_API_KEY", "fictional-key");
  mocks.active.mockReturnValue(true); mocks.guard.mockImplementation(() => undefined); mocks.forbidden.mockReturnValue(false);
  mocks.validate.mockImplementation(() => undefined);
  mocks.withVault.mockImplementation(async (_token, work) => work({ key: modelKey }));
  const state = { ...initialState(), enabled: true };
  mocks.view.mockReturnValue({ state });
  mocks.prepare.mockReturnValue({ view: { state }, original: { id: "h" }, reading: { id: selection.readingId }, refs: [{ id: selection.readingId, sourceId: selection.readingId, revision: "v1" }], packetHash: "hash", snapshotHash: command.snapshotHash, body: { model: "fixture" }, preview: { configured: true } });
  mocks.hypothesis.mockReturnValue({ id: "new-proposal", interpretation: "A fictional direction", refs: [], status: "proposed", alternativeTo: "h" });
  mocks.model.mockResolvedValue({ outcome: "proposal" });
});
afterEach(() => vi.unstubAllEnvs());
it("never calls a model for preview, missing consent, foreign origin or a locked session", async () => {
  const preview = await POST(request({ action: "preview", selection }));
  expect(preview.status).toBe(200);
  expect(await preview.json()).toMatchObject({ requestSignature: expect.stringMatching(/^[a-f0-9]{64}$/), expiresAt: expect.any(String) });
  expect((await POST(request({ ...command, consent: false }))).status).toBe(422);
  expect((await POST(request(command, "https://foreign.example"))).status).toBe(403);
  mocks.active.mockReturnValue(false);
  expect((await POST(request(command))).status).toBe(401);
  expect(mocks.model).not.toHaveBeenCalled();
});
it("rejects permits tampered with or replayed under a different preview", async () => {
  expect((await POST(request({ ...command, requestSignature: "f".repeat(64) })))).toHaveProperty("status", 422);
  expect(mocks.model).not.toHaveBeenCalled();
  mocks.prepare().view.state.modelAttempts.push({ id: command.requestId, packetHash: "hash", at: new Date().toISOString(), status: "failed" });
  expect((await POST(request(command))).status).toBe(409);
  expect(mocks.model).not.toHaveBeenCalled();
});
it("rejects stale previews, repeated request IDs and absent configuration before export", async () => {
  expect((await POST(request({ ...command, snapshotHash: "b".repeat(64) }))).status).toBe(422);
  mocks.prepare().view.state.modelAttempts.push({ id: command.requestId, packetHash: "hash", at: new Date().toISOString(), status: "failed" });
  expect((await POST(request(command))).status).toBe(409);
  vi.stubEnv("OPENAI_API_KEY", "");
  expect((await POST(request(command))).status).toBe(422);
  expect(mocks.model).not.toHaveBeenCalled();
});
it("reserves once, rechecks after the model, and saves a pending proposal", async () => {
  const response = await POST(request(command));
  expect(response.status).toBe(200);
  expect(mocks.model).toHaveBeenCalledOnce();
  expect(mocks.prepare).toHaveBeenCalledTimes(2);
  expect(mocks.prepare.mock.calls[1][1].expectedRevision).toBe(selection.expectedRevision + 1);
  expect(mocks.write).toHaveBeenCalledTimes(2);
  expect(mocks.view().state.hypotheses[0].status).toBe("proposed");
  expect(mocks.view().state.modelAttempts[0].status).toBe("completed");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("discards results when the snapshot changes during generation", async () => {
  mocks.model.mockImplementation(async () => { mocks.prepare().snapshotHash = "c".repeat(64); return { outcome: "proposal" }; });
  expect((await POST(request(command))).status).toBe(409);
  expect(mocks.view().state.hypotheses).toHaveLength(0);
  expect(mocks.view().state.modelAttempts[0].status).toBe("failed");
});
it("does not export after a final access guard fails and never saves invalid citations", async () => {
  mocks.guard.mockImplementation(() => { throw new Error("session expired"); });
  expect((await POST(request(command))).status).toBe(422);
  expect(mocks.model).not.toHaveBeenCalled();
  mocks.guard.mockImplementation(() => undefined);
  mocks.prepare().view.state.modelAttempts = [];
  mocks.validate.mockImplementation(() => { throw new Error("invalid citation"); });
  expect((await POST(request({ ...command, requestId: "00000000-0000-4000-8000-000000000002" }))).status).toBe(422);
  expect(mocks.view().state.hypotheses).toHaveLength(0);
});
it("retains history on no-alternative and redacts provider failures", async () => {
  mocks.model.mockResolvedValue({ outcome: "no-proposal" });
  expect((await POST(request(command))).status).toBe(200);
  expect(mocks.view().state.hypotheses).toHaveLength(0);
  expect(mocks.view().state.modelAttempts[0].status).toBe("no-proposal");
  mocks.prepare().view.state.modelAttempts = [];
  mocks.model.mockRejectedValue(new Error("PRIVATE-PROVIDER-CANARY"));
  const result = await POST(request({ ...command, requestId: "00000000-0000-4000-8000-000000000002" }));
  expect(await result.text()).not.toContain("PRIVATE-PROVIDER-CANARY");
  expect(mocks.view().state.hypotheses).toHaveLength(0);
});
