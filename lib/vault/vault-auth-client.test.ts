import { afterEach, expect, it, vi } from "vitest";
import { browserVaultSession, vaultAuthRequest } from "./vault-auth-client";

afterEach(() => vi.unstubAllGlobals());
it.each(["/api/vault", "/api/vault/recovery-passphrase"] as const)("keeps %s same-origin, uncached and never replayed", async endpoint => {
  const send = vi.fn().mockResolvedValue(Response.json({ error: "Request failed" }, { status: 401 }));
  vi.stubGlobal("fetch", send);
  await expect(vaultAuthRequest(endpoint, { action: "unlock" })).rejects.toThrow("Request failed");
  expect(send).toHaveBeenCalledOnce();
  expect(send.mock.calls[0][1]).toMatchObject({ cache: "no-store", credentials: "same-origin" });
});
it("does not continue after cancellation even if a response arrives", async () => {
  const controller = new AbortController();
  vi.stubGlobal("fetch", vi.fn(async () => { controller.abort(); return Response.json({ session: { active: true } }); }));
  await expect(browserVaultSession(controller.signal)).rejects.toThrow();
});
