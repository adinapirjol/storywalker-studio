/** Fictional temporary Vaults only; never opens the Author's database. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const io = vi.hoisted(() => ({ jar: new Map<string, string>(), fail: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => ({ value: io.jar.get(name) }) }) }));
vi.mock("node:fs", async original => {
  const fs = await original<typeof import("node:fs")>();
  return { ...fs,
    unlinkSync: (...args: Parameters<typeof fs.unlinkSync>) => { if (io.fail === "unlock" && String(args[0]).endsWith(".lock")) throw new Error("Synthetic lock cleanup failure"); return fs.unlinkSync(...args); },
    renameSync: (...args: Parameters<typeof fs.renameSync>) => { if (io.fail === "rename") throw new Error("Synthetic rename failure"); return fs.renameSync(...args); },
    fsyncSync: (...args: Parameters<typeof fs.fsyncSync>) => { if (io.fail === "fsync") throw new Error("Synthetic fsync failure"); return fs.fsyncSync(...args); },
  };
});
const original = "fictional-original-recovery";
const next = "fictional-replacement-recovery";
let temporary: string;
let vault: typeof import("./private-vault");
let sessions: typeof import("./vault-session");
let token: string;
function query(database: import("sql.js/dist/sql-wasm.js").SqlDatabase, sql: string) {
  const statement = database.prepare(sql);
  try { const result: Record<string, unknown>[] = []; while (statement.step()) result.push(statement.getAsObject()); return result; }
  finally { statement.free(); }
}
const filename = () => path.join(temporary, "private-data/vault/storywalker-vault.sqlite");

beforeEach(async () => {
  mkdirSync(path.join(process.cwd(), "tmp"), { recursive: true });
  temporary = mkdtempSync(path.join(process.cwd(), "tmp", "recovery-test-"));
  vi.spyOn(process, "cwd").mockReturnValue(temporary);
  vi.resetModules(); io.jar.clear(); io.fail = "";
  vault = await import("./private-vault"); sessions = await import("./vault-session");
  sessions.deleteAllVaultSessions();
  await vault.initialiseVault(original);
  const opened = await vault.openVault(original);
  vault.putVaultRecords(opened, [{ id: "fictional:pending", kind: "reference", capturedAt: "2026-01-01T00:00:00.000Z", payload: { text: "Fictional pending evidence", accepted: false } }]);
  token = sessions.createVaultSession(opened.key).token;
  io.jar.set(sessions.VAULT_SESSION_COOKIE, token); vault.closeVault(opened);
});
afterEach(() => { sessions?.deleteAllVaultSessions(); vi.restoreAllMocks(); io.fail = ""; rmSync(temporary, { recursive: true, force: true }); });
async function call(overrides: Record<string, unknown> = {}, options: { origin?: string; signal?: AbortSignal } = {}) {
  const { POST } = await import("@/app/api/vault/recovery-passphrase/route");
  return POST(new Request("http://localhost:3000/api/vault/recovery-passphrase", { method: "POST", headers: { origin: options.origin ?? "http://localhost:3000" }, signal: options.signal, body: JSON.stringify({ currentPassphrase: original, newPassphrase: next, confirmation: next, ...overrides }) }));
}
it("preserves ciphertext, data key and passkey identity through repeated changes and reload", async () => {
  const opened = await vault.openVault(original);
  const key = Buffer.from(opened.key);
  const identity = await vault.vaultKeyIdentity();
  const passkeys = await import("./vault-passkeys");
  const prf = Buffer.alloc(32, 9);
  const credential = { id: Buffer.alloc(32, 1).toString("base64url"), publicKey: Buffer.alloc(32, 2).toString("base64url"), counter: 0, salt: Buffer.alloc(32, 3).toString("base64url"), vaultId: identity, origin: "http://localhost:3000", label: "Fictional key", createdAt: "2026-01-01T00:00:00.000Z" };
  passkeys.changePasskeys(() => [{ ...credential, wrapped: passkeys.wrapVaultKey(key, prf, credential) }]);
  const sidecar = path.join(temporary, "private-data/vault/passkeys.json");
  const savedPasskeys = readFileSync(sidecar);
  const records = query(opened.database, "SELECT * FROM vault_records ORDER BY record_id");
  const oldMeta = String(query(opened.database, "SELECT value FROM vault_meta")[0].value);
  const secondToken = sessions.createVaultSession(opened.key).token;
  vault.closeVault(opened);
  const response = await call();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  expect(sessions.vaultSessionActive(token)).toBe(false);
  expect(sessions.vaultSessionActive(secondToken)).toBe(false);
  expect(statSync(filename()).mode & 0o777).toBe(0o600);
  expect(readFileSync(filename()).includes(Buffer.from(JSON.parse(oldMeta).salt))).toBe(false);
  await expect(vault.openVault(original)).rejects.toThrow();
  expect(await vault.vaultKeyIdentity()).toBe(identity);
  expect(readFileSync(sidecar)).toEqual(savedPasskeys);
  const passkeyKey = passkeys.unwrapVaultKey(prf, passkeys.readPasskeys()[0]);
  await vault.verifyVaultKey(passkeyKey);
  const viaPasskey = await vault.openVaultWithKey(passkeyKey);
  expect(vault.readVaultRecord(viaPasskey, "fictional:pending")?.payload).toEqual({ text: "Fictional pending evidence", accepted: false });
  vault.closeVault(viaPasskey); passkeyKey.fill(0); prf.fill(0);
  const reopened = await vault.openVault(next);
  expect(reopened.key).toEqual(key);
  expect(query(reopened.database, "SELECT * FROM vault_records ORDER BY record_id")).toEqual(records);
  vault.changeVaultRecoveryPassphrase(reopened, next, "fictional-third-recovery"); vault.closeVault(reopened);
  vi.resetModules(); vault = await import("./private-vault");
  const reloaded = await vault.openVault("fictional-third-recovery");
  expect(reloaded.key).toEqual(key);
  expect(vault.readVaultRecord(reloaded, "fictional:pending")?.payload).toEqual({ text: "Fictional pending evidence", accepted: false });
  expect(query(reloaded.database, "SELECT * FROM vault_records ORDER BY record_id")).toEqual(records);
  vault.closeVault(reloaded); key.fill(0);
  await expect(vault.openVault(next)).rejects.toThrow();
});
it.each([
  { currentPassphrase: "fictional-wrong-recovery" },
  { newPassphrase: "short", confirmation: "short" },
  { confirmation: "fictional-mismatch-recovery" },
  { newPassphrase: original, confirmation: original },
  { action: "capture" },
])("rejects invalid changes without altering data or sessions: %j", async body => {
  const before = readFileSync(filename());
  expect((await call(body)).status).toBe(400);
  expect(readFileSync(filename())).toEqual(before);
  expect(sessions.vaultSessionActive(token)).toBe(true);
});
it.each(["rename", "fsync"])("retains the previous recovery and active session on %s failure", async failure => {
  const before = readFileSync(filename()); io.fail = failure;
  expect((await call()).status).toBe(400);
  expect(readFileSync(filename())).toEqual(before);
  expect(sessions.vaultSessionActive(token)).toBe(true);
  const reopened = await vault.openVault(original); vault.closeVault(reopened);
});
it("rejects foreign origins, missing authority and cancelled requests without writes", async () => {
  const before = readFileSync(filename());
  expect((await call({}, { origin: "https://example.invalid" })).status).toBe(403);
  const controller = new AbortController(); controller.abort();
  expect((await call({}, { signal: controller.signal })).status).toBe(400);
  io.jar.clear(); expect((await call()).status).toBe(401);
  expect(readFileSync(filename())).toEqual(before);
});
it("rejects expiry after opening the Vault and before persistence", async () => {
  const before = readFileSync(filename());
  const open = vault.openVaultWithKey;
  vi.spyOn(vault, "openVaultWithKey").mockImplementation(async key => {
    const result = await open(key); sessions.deleteVaultSession(token); return result;
  });
  expect((await call()).status).toBe(401);
  expect(readFileSync(filename())).toEqual(before);
});
it("rejects stale writers and stale passphrase authority after recovery changes", async () => {
  const stale = await vault.openVault(original);
  expect((await call()).status).toBe(200);
  const before = readFileSync(filename());
  expect(() => vault.assertVaultSnapshotCurrent(stale)).toThrow("Vault changed");
  expect(() => vault.changeVaultRecoveryPassphrase(stale, original, "fictional-concurrent-recovery")).toThrow("Vault changed");
  expect(() => vault.putVaultRecords(stale, [])).toThrow("Vault changed");
  expect(readFileSync(filename())).toEqual(before); vault.closeVault(stale);
});

it("rechecks cancellation at the final write boundary", async () => {
  const opened = await vault.openVault(original), before = readFileSync(filename());
  let checks = 0;
  vault.setVaultAccessGuard(opened, () => { if (++checks === 2) throw new Error("Fictional cancelled request"); });
  expect(() => vault.changeVaultRecoveryPassphrase(opened, original, next)).toThrow("Fictional cancelled request");
  expect(checks).toBe(2); expect(readFileSync(filename())).toEqual(before); vault.closeVault(opened);
});
it("fails closed on a corrupted recovery envelope", async () => {
  const { replaceRecoveryEnvelope, unlockRecoveryKey, vaultMetadataSchema } = await import("./vault-recovery");
  const opened = await vault.openVault(original);
  const metadata = vaultMetadataSchema.parse(JSON.parse(String(query(opened.database, "SELECT value FROM vault_meta")[0].value)));
  const replacement = replaceRecoveryEnvelope(metadata, opened.key, original, next);
  if (replacement.schemaVersion !== 2) throw new Error("Expected new envelope");
  for (const field of ["iv", "tag", "ciphertext", "salt"] as const) {
    const changed = Buffer.from(replacement.recovery[field], "base64url"); changed[0] ^= 1;
    expect(() => unlockRecoveryKey({ ...replacement, recovery: { ...replacement.recovery, [field]: changed.toString("base64url") } }, next)).toThrow();
  }
  expect(() => unlockRecoveryKey({ ...replacement, vaultId: Buffer.alloc(32).toString("base64url") }, next)).toThrow();
  expect(vaultMetadataSchema.safeParse({ ...replacement, salt: metadata.schemaVersion === 1 ? metadata.salt : "legacy" }).success).toBe(false);
  expect(vaultMetadataSchema.safeParse({ ...replacement, schemaVersion: 3 }).success).toBe(false);
  vault.closeVault(opened);
});

it("revokes every session even if expiry is detected just after the replacement", async () => {
  const opened = await vault.openVault(original);
  const other = sessions.createVaultSession(opened.key).token; vault.closeVault(opened);
  const change = vault.changeVaultRecoveryPassphrase;
  vi.spyOn(vault, "changeVaultRecoveryPassphrase").mockImplementation((...args) => {
    change(...args); sessions.deleteVaultSession(token);
  });
  expect((await call()).status).toBe(401);
  expect(sessions.vaultSessionActive(other)).toBe(false);
  const changed = await vault.openVault(next); vault.closeVault(changed);
});

it("keeps a competing writer's lock and the original database", async () => {
  const before = readFileSync(filename());
  writeFileSync(`${filename()}.lock`, "fictional competing writer");
  expect((await call()).status).toBe(409);
  expect(readFileSync(filename())).toEqual(before);
  expect(readFileSync(`${filename()}.lock`, "utf8")).toBe("fictional competing writer");
  expect(sessions.vaultSessionActive(token)).toBe(true);
});
it("requires the session key to match the authenticated recovery key", async () => {
  const before = readFileSync(filename());
  const other = sessions.createVaultSession(Buffer.alloc(32, 7)).token;
  io.jar.set(sessions.VAULT_SESSION_COOKIE, other);
  expect((await call()).status).toBe(400);
  expect(readFileSync(filename())).toEqual(before);
  expect(sessions.vaultSessionActive(token)).toBe(true);
});

it("revokes sessions when lock cleanup fails after the passphrase was saved", async () => {
  io.fail = "unlock";
  expect((await call()).status).toBe(400);
  const changed = await vault.openVault(next); vault.closeVault(changed);
  await expect(vault.openVault(original)).rejects.toThrow();
  expect(sessions.vaultSessionActive(token)).toBe(false);
});
