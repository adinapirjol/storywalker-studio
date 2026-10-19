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
it("explains an unidentified unlock failure without assuming a wrong passphrase or retrying", async () => {
  const send=vi.fn().mockResolvedValue(Response.json({error:"Local Vault request failed. Check your inputs and unlock state before retrying."},{status:400}));
  vi.stubGlobal("fetch",send);
  await expect(vaultAuthRequest('/api/vault',{action:'unlock',passphrase:'fictional-only'})).rejects.toThrow('The server did not identify the cause');
  expect(send).toHaveBeenCalledOnce();
});

it.each([["/api/vault", "unlock"], ["/api/vault/passkeys", "finish-unlock"]] as const)("starts saved delivery only after %s authentication returns", async (endpoint, action) => {
 const events: string[] = [], dispatchEvent = vi.fn((event: Event) => { events.push(event.type); return true; });
 vi.stubGlobal("window", { dispatchEvent });
 vi.stubGlobal("fetch", vi.fn(async () => { expect(events).toEqual([]); return Response.json({ session: { active: true } }); }));
 await vaultAuthRequest(endpoint, { action });
 expect(events).toEqual(["storywalker-vault-unlocked"]);
});
it("does not start delivery from a cancelled unlock response", async () => {
 const controller = new AbortController(), dispatchEvent = vi.fn(); vi.stubGlobal("window", { dispatchEvent });
 vi.stubGlobal("fetch", vi.fn(async () => { controller.abort(); return Response.json({ session: { active: true } }); }));
 await expect(vaultAuthRequest("/api/vault", { action: "unlock" }, controller.signal)).rejects.toThrow();
 expect(dispatchEvent).not.toHaveBeenCalled();
});
