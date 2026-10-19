import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/health-rehearsal/route";
import { createVaultSession, deleteAllVaultSessions, deleteVaultSession, VAULT_SESSION_COOKIE } from "@/lib/vault/vault-session";
import { withSyntheticArchive } from "./server/archive-session";
import { decryptArchive } from "./server/archive-crypto";

let root: string, token: string;
const key = Buffer.alloc(32, 21);
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "health-route-synthetic-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
  token = createVaultSession(key).token;
});
afterEach(() => { deleteAllVaultSessions(); vi.restoreAllMocks(); rmSync(root, { recursive: true, force: true }); });
function request(body?: unknown, origin = "http://localhost:3000", authenticated = true) {
  return new NextRequest("http://localhost:3000/api/health-rehearsal", {
    method: body === undefined ? "GET" : "POST",
    headers: { origin, ...(authenticated ? { cookie: `${VAULT_SESSION_COOKIE}=${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
it("rejects foreign origins and locked access before any archive filesystem work", async () => {
  expect((await GET(request(undefined, "https://foreign.example"))).status).toBe(403);
  expect((await POST(request({ action: "seed", expectedRevision: null }, "https://foreign.example"))).status).toBe(403);
  expect((await GET(request(undefined, undefined, false))).status).toBe(401);
  expect(existsSync(join(root, "private-data"))).toBe(false);
});
it("saves only the server fixture, reloads it and deletes a selected observation", async () => {
  const response = await POST(request({ action: "seed", expectedRevision: null }));
  expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
  const { archive } = await response.json();
  expect(archive.mode).toBe("synthetic");
  expect((await (await GET(request())).json()).archive).toEqual(archive);
  const deleted = await POST(request({ action: "delete-observation", id: "fixture-diary-1", expectedRevision: archive.revision }));
  expect(deleted.status).toBe(200);
  expect((await deleted.json()).archive.observations.some((o: { id: string }) => o.id === "fixture-diary-1")).toBe(false);
  // Only the isolated archive exists: never open/write the personal SQLite store.
  expect(existsSync(join(root, "private-data/vault"))).toBe(false);
});
it("rejects arbitrary diary/source fields and bounded oversized requests without storing them", async () => {
  const invalid = await POST(request({ action: "seed", expectedRevision: null, notes: "PERSONAL_ROUTE_CANARY" }));
  expect(invalid.status).toBe(422); expect(await invalid.text()).not.toContain("PERSONAL_ROUTE_CANARY");
  expect((await POST(request({ action: "seed", notes: "x".repeat(1500) }))).status).toBe(413);
  expect(existsSync(join(root, "private-data"))).toBe(false);
});
it("prevents stale retries and persists clear-all as an empty encrypted snapshot", async () => {
  const { archive } = await (await POST(request({ action: "seed", expectedRevision: null }))).json();
  expect((await POST(request({ action: "seed", expectedRevision: null }))).status).toBe(409);
  const cleared = await POST(request({ action: "delete-all", expectedRevision: archive.revision }));
  expect((await cleared.json()).archive.observations).toEqual([]);
  const bytes = readFileSync(join(root, "private-data/health-study04-synthetic/archive.enc"));
  expect(decryptArchive(bytes, key).observations).toEqual([]);
});
it("rechecks revocation after asynchronous body reading, before creating a store", async () => {
  const body = new ReadableStream<Uint8Array>({ pull(controller) {
    deleteVaultSession(token);
    controller.enqueue(new TextEncoder().encode('{"action":"seed","expectedRevision":null}'));
    controller.close();
  } });
  const req = new NextRequest("http://localhost:3000/api/health-rehearsal", {
    method: "POST", headers: { origin: "http://localhost:3000", cookie: `${VAULT_SESSION_COOKIE}=${token}` }, body,
    // Node requires duplex for a streamed request body.
    duplex: "half",
  });
  const response = await POST(req);
  expect(response.status).toBe(401);
  expect((await response.json()).code).toBe("VAULT_SESSION_EXPIRED");
  expect(existsSync(join(root, "private-data"))).toBe(false);
});
it("honors cancellation and expiry without retaining a capability in the repository", () => {
  const controller = new AbortController(); controller.abort();
  expect(() => withSyntheticArchive(token, controller.signal, store => store.read())).toThrow();
  expect(existsSync(join(root, "private-data"))).toBe(false);
  let retained: Parameters<Parameters<typeof withSyntheticArchive>[2]>[0] | undefined;
  withSyntheticArchive(token, new AbortController().signal, store => { retained = store; });
  expect(() => retained!.read()).toThrow("ARCHIVE_SESSION_CLOSED");
  deleteVaultSession(token);
  expect(() => retained!.read()).toThrow("ARCHIVE_SESSION_CLOSED");
});

const recoveryRequest = () => new NextRequest("http://localhost:3000/api/health-rehearsal?recovery=1", { headers: { origin: "http://localhost:3000", cookie: `${VAULT_SESSION_COOKIE}=${token}` } });
it("authenticates recovery preview and restores with a new session key without opening the personal Vault", async () => {
  const { archive } = await (await POST(request({ action: "seed", expectedRevision: null }))).json();
  const { recovery } = await (await GET(recoveryRequest())).json();
  const code = "ab".repeat(32); // Synthetic test code.
  const expected = { expectedCurrentToken: recovery.currentToken, expectedBackupToken: recovery.backupToken };
  const created = await POST(request({ action: "create-backup", ...expected, recoveryCode: code }));
  expect(created.status).toBe(200);
  const { recovery: after } = await created.json();
  deleteAllVaultSessions(); token = createVaultSession(Buffer.alloc(32, 22)).token;
  expect((await GET(request())).status).toBe(422);
  const inspected = await GET(recoveryRequest());
  expect(inspected.status).toBe(200); expect((await inspected.json()).recovery).toEqual(after);
  const selected = { expectedCurrentToken: after.currentToken, expectedBackupToken: after.backupToken };
  const preview = await POST(request({ action: "preview-restore", ...selected, recoveryCode: code }));
  expect(preview.status).toBe(200); expect(preview.headers.get("Cache-Control")).toBe("no-store");
  expect((await preview.json()).preview.observations).toBe(archive.observations.length);
  const restored = await POST(request({ action: "restore-backup", ...selected, recoveryCode: code, confirmReplace: true }));
  expect(restored.status).toBe(200);
  const result = await (await GET(request())).json();
  expect(result.archive.observations).toEqual(archive.observations);
  expect(result.archive.revision).not.toBe(archive.revision);
  expect(existsSync(join(root, "private-data/vault"))).toBe(false);
});
it("keeps recovery failures generic and requires confirmation, authorization and local origin", async () => {
  const command = { action: "restore-backup", expectedCurrentToken: null, expectedBackupToken: null, recoveryCode: "cd".repeat(32), confirmReplace: true };
  expect((await POST(request(command, "https://foreign.example"))).status).toBe(403);
  expect((await POST(request(command, undefined, false))).status).toBe(401);
  expect((await POST(request({ ...command, confirmReplace: false }))).status).toBe(422);
  const failure = await POST(request(command));
  expect(failure.status).toBe(422);
  expect(await failure.json()).toEqual({ code: "ARCHIVE_UNAVAILABLE_RELOAD" });
  expect((await POST(request({ ...command, arbitraryObservations: [] }))).status).toBe(422);
});
