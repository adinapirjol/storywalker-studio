import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ active: vi.fn(), withVault: vi.fn(), view: vi.fn(), execute: vi.fn() }));
vi.mock("@/lib/vault/vault-session", () => ({ VAULT_SESSION_COOKIE: "vault", vaultSessionActive: mocks.active, vaultSessionFailure: () => undefined }));
vi.mock("@/lib/vault/vault-route-access", () => ({ withBrowserVault: mocks.withVault }));
vi.mock("@/lib/nova/store", () => ({ loopView: mocks.view, executeLoop: mocks.execute }));
import { GET, POST } from "@/app/api/nova/route";
function request(body?: unknown, origin = "http://localhost:3000") { return new NextRequest("http://localhost:3000/api/nova", { method: body === undefined ? "GET" : "POST", headers: { host: "localhost:3000", origin, cookie: "vault=fixture" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
beforeEach(() => { vi.clearAllMocks(); mocks.active.mockReturnValue(true); mocks.withVault.mockImplementation(async (_token, work) => work({})); mocks.view.mockReturnValue({ state: {}, evidence: [] }); mocks.execute.mockReturnValue({ state: {} }); });
it("denies locked sessions before reads or writes", async () => {
  mocks.active.mockReturnValue(false);
  expect((await GET(request())).status).toBe(401);
  expect((await POST(request({ action: "analyze", expectedRevision: 0 }))).status).toBe(401);
  expect(mocks.withVault).not.toHaveBeenCalled();
});
it("rejects foreign origins and malformed or unconsented commands", async () => {
  expect((await GET(request(undefined, "https://foreign.example"))).status).toBe(403);
  expect((await POST(request({ action: "analyze", expectedRevision: 0 }, "https://foreign.example"))).status).toBe(403);
  expect((await POST(request({ action: "configure", expectedRevision: 0, sourceIds: [] }))).status).toBe(422);
  expect((await POST(request({ action: "analyze", expectedRevision: 0, rawEvidence: "not allowed" }))).status).toBe(422);
  expect(mocks.withVault).not.toHaveBeenCalled();
});
it("uses the shared guarded Vault and private cache headers", async () => {
  const response = await GET(request()); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store"); expect(mocks.withVault).toHaveBeenCalledOnce();
});
it("requires explicit consent for observation-driven reconsideration", async () => {
  const command = { action: "reconsider-reading", expectedRevision: 1, hypothesisId: "fixture", readingId: "research-session:fixture" };
  expect((await POST(request(command))).status).toBe(422);
  expect(mocks.execute).not.toHaveBeenCalled();
  expect((await POST(request({ ...command, consent: true }))).status).toBe(200);
  expect(mocks.execute).toHaveBeenCalledOnce();
});
it("never releases raw exception details", async () => {
  mocks.withVault.mockRejectedValue(new Error("PRIVATE-CANARY"));
  const response = await GET(request()); expect(response.status).toBe(422); expect(await response.text()).not.toContain("PRIVATE-CANARY");
});
it("refuses an oversized request before entering private work", async () => {
  const response = await POST(request({ action: "reject", note: "x".repeat(17000) }));
  expect(response.status).toBe(422); expect(mocks.withVault).not.toHaveBeenCalled();
});
