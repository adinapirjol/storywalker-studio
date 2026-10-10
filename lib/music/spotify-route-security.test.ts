import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createVaultSession, deleteVaultSession } from "@/lib/vault/vault-session";

const io = vi.hoisted(() => ({ token: undefined as string | undefined, selection: vi.fn(), presentations: vi.fn(), import: vi.fn(), open: vi.fn(), write: vi.fn(), close: vi.fn(), guard: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => io.token ? { value: io.token } : undefined }) }));
vi.mock("./spotify-server", () => ({ spotifyEnvironmentSchema: { parse: () => ({}) }, readSpotifySelection: io.selection, readSpotifyPlaylistPresentations: io.presentations, importSpotifyPlaylists: io.import }));
vi.mock("@/lib/vault/private-vault", () => ({ openVaultWithKey: io.open, openVault: io.open, putVaultRecords: io.write, closeVault: io.close, setVaultAccessGuard: io.guard, refreshVaultDerivedViews: () => ({}), vaultSummary: () => ({}) }));
import { GET as selection } from "@/app/api/connectors/spotify/selection/route";
import { POST as playlists } from "@/app/api/connectors/spotify/playlists/route";
import { POST as importPlaylists } from "@/app/api/connectors/spotify/import/route";

const request = (write = false, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/connectors/spotify", {
  method: write ? "POST" : "GET", headers: { host: "localhost:3000", ...(write ? { origin } : {}) },
  ...(write ? { body: JSON.stringify({ playlistIds: ["fictional12345"], consent: true }) } : {}),
});
beforeEach(() => { io.open.mockResolvedValue({ database: {}, key: Buffer.alloc(32) }); });
afterEach(() => { deleteVaultSession(io.token); io.token = undefined; vi.resetAllMocks(); });

it("blocks locked and foreign requests before private providers or Vault access", async () => {
  expect((await selection(request())).status).toBe(401);
  expect((await playlists(request(true))).status).toBe(401);
  expect((await importPlaylists(request(true))).status).toBe(401);
  io.token = createVaultSession(Buffer.alloc(32, 1)).token;
  expect((await playlists(request(true, "https://outside.example"))).status).toBe(403);
  expect((await importPlaylists(request(true, "https://outside.example"))).status).toBe(403);
  expect(io.selection).not.toHaveBeenCalled(); expect(io.presentations).not.toHaveBeenCalled();
  expect(io.import).not.toHaveBeenCalled(); expect(io.open).not.toHaveBeenCalled();
});

it.each(["selection", "presentations", "import"] as const)("does not reveal or save a %s result received after lock", async (kind) => {
  io.token = createVaultSession(Buffer.alloc(32, 1)).token;
  const provider = io[kind];
  provider.mockImplementation(async () => { deleteVaultSession(io.token); return [{ playlist: { id: "fictional-private-canary" } }]; });
  const response = kind === "selection" ? await selection(request()) : kind === "presentations" ? await playlists(request(true)) : await importPlaylists(request(true));
  expect(response.status).toBe(401); expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toMatchObject({ code: "VAULT_SESSION_EXPIRED" });
  expect(io.write).not.toHaveBeenCalled();
  if (kind === "import") expect(io.close).toHaveBeenCalledOnce();
});

it("still saves an explicitly authorized fictional import", async () => {
  io.token = createVaultSession(Buffer.alloc(32, 1)).token;
  io.import.mockResolvedValue([{ playlist: { id: "fictional12345" } }]);
  expect((await importPlaylists(request(true))).status).toBe(200);
  expect(io.write).toHaveBeenCalledOnce(); expect(io.guard).toHaveBeenCalledOnce(); expect(io.close).toHaveBeenCalledOnce();
});

it("does not echo provider secrets into an error response", async () => {
  io.token = createVaultSession(Buffer.alloc(32, 1)).token;
  io.selection.mockRejectedValue(new Error("fictional-secret-canary"));
  const response = await selection(request());
  expect(response.status).toBe(400); expect(await response.text()).not.toContain("canary");
});
