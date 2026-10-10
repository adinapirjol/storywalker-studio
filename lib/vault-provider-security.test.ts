import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createVaultSession, deleteVaultSession, VAULT_SESSION_MAX_AGE_SECONDS } from "./vault-session";
const io = vi.hoisted(() => ({ token: undefined as string | undefined, open: vi.fn(), close: vi.fn(), import: vi.fn(), provider: vi.fn(), markers: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => io.token ? { value: io.token } : undefined }) }));
vi.mock("./lastfm-server", async (original) => ({ ...await original<typeof import("./lastfm-server")>(), readLastFmScrobbles: io.provider }));
vi.mock("./private-vault", async (original) => ({
  ...await original<typeof import("./private-vault")>(), openVaultWithKey: io.open, openVault: io.open, closeVault: io.close,
  importLastFmHistory: io.import, vaultSummary: () => ({ fictional: true }), readAtlasNow: () => null,
  vaultExists: () => true, vaultImportMarkers: io.markers,
}));
import { GET, POST } from "../app/api/vault/route";
const request = () => new Request("http://localhost:3000/api/vault", {
  method: "POST", headers: { host: "localhost:3000", origin: "http://localhost:3000" },
  body: JSON.stringify({ action: "import-lastfm-history", lastFm: { username: "fictional", from: "2030-01-01T00:00:00Z", to: "2030-01-02T00:00:00Z", consent: true } }),
});
beforeEach(() => {
  io.token = createVaultSession(Buffer.alloc(32, 1)).token;
  io.open.mockResolvedValue({ database: {}, key: Buffer.alloc(32) });
  vi.stubEnv("LASTFM_API_KEY", "fictional-key");
});
afterEach(() => { deleteVaultSession(io.token); io.token = undefined; vi.resetAllMocks(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it.each(["lock", "expiry"])("does not commit provider results after session %s", async (reason) => {
  const started = Date.now();
  io.provider.mockImplementation(async () => {
    if (reason === "lock") deleteVaultSession(io.token);
    else vi.spyOn(Date, "now").mockReturnValue(started + (VAULT_SESSION_MAX_AGE_SECONDS + 1) * 1000);
    return { recenttracks: { track: [{ name: "fictional-private-canary" }] }, pagination: {} };
  });
  const response = await POST(request());
  expect(io.provider).toHaveBeenCalledOnce(); expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({ code: "VAULT_SESSION_EXPIRED" });
  expect(io.import).not.toHaveBeenCalled(); expect(io.close).toHaveBeenCalledOnce();
});

it("does not expose a summary when locked during its asynchronous marker read", async () => {
  io.markers.mockImplementation(async () => { deleteVaultSession(io.token); return {}; });
  const response = await GET(new Request("http://localhost:3000/api/vault", { headers: { host: "localhost:3000" } }));
  expect(response.status).toBe(401); expect(await response.json()).toMatchObject({ code: "VAULT_SESSION_EXPIRED" });
});

it("does not echo a private provider error into the browser", async () => {
  io.provider.mockRejectedValue(new Error("fictional-provider-secret-canary"));
  const response = await POST(request());
  expect(io.provider).toHaveBeenCalledOnce(); expect(response.status).toBe(400);
  expect(await response.text()).not.toContain("canary");
});

it("closes a Vault opened during cancellation without issuing a replacement session", async () => {
  const abort = new AbortController();
  io.open.mockImplementationOnce(async () => {
    abort.abort();
    return { database: {}, key: Buffer.alloc(32) };
  });
  const response = await POST(new Request("http://localhost:3000/api/vault", {
    method: "POST", signal: abort.signal,
    headers: { host: "localhost:3000", origin: "http://localhost:3000" },
    body: JSON.stringify({ action: "unlock", passphrase: "synthetic-recovery-only" }),
  }));
  expect(response.status).toBe(400);
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(io.close).toHaveBeenCalledOnce();
});
