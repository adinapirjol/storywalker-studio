import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { isoCBOR } from "@simplewebauthn/server/helpers";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { decodePrf, passkeyOrigin, PasskeyCeremonies, requirePasskeyOrigin, unwrapVaultKey, verifyAssertion, verifyRegistration, wrapVaultKey } from "./vault-passkeys";

const b64 = (value: Uint8Array) => Buffer.from(value).toString("base64url");
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => jar.has(name) ? { value: jar.get(name) } : undefined }) }));

function fixture() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const cose = isoCBOR.encode(new Map<number, number | Uint8Array>([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x!, "base64url")], [-3, Buffer.from(jwk.y!, "base64url")]]));
  const credential = { id: b64(randomBytes(32)), publicKey: b64(cose), counter: 0, salt: b64(randomBytes(32)), vaultId: b64(randomBytes(32)), origin: "http://localhost:3011", label: "Synthetic test key", createdAt: new Date().toISOString() };
  const ceremony = { kind: "register" as const, challenge: b64(randomBytes(32)), browser: "browser", expiresAt: Date.now() + 60_000, vaultId: credential.vaultId, origin: credential.origin, sessionToken: "session", label: credential.label };
  function assertion(overrides: { origin?: string; challenge?: string; flags?: number; rpID?: string; counter?: number } = {}): AuthenticationResponseJSON {
    const client = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge: overrides.challenge ?? ceremony.challenge, origin: overrides.origin ?? credential.origin }));
    const counter = Buffer.alloc(4); counter.writeUInt32BE(overrides.counter ?? 1);
    const auth = Buffer.concat([createHash("sha256").update(overrides.rpID ?? "localhost").digest(), Buffer.from([overrides.flags ?? 5]), counter]);
    const signature = sign("sha256", Buffer.concat([auth, createHash("sha256").update(client).digest()]), privateKey);
    return { id: credential.id, rawId: credential.id, type: "public-key", clientExtensionResults: {}, response: { clientDataJSON: b64(client), authenticatorData: b64(auth), signature: b64(signature) } };
  }
  function registration(): RegistrationResponseJSON {
    const client = Buffer.from(JSON.stringify({ type: "webauthn.create", challenge: ceremony.challenge, origin: credential.origin }));
    const id = Buffer.from(credential.id, "base64url"), length = Buffer.alloc(2); length.writeUInt16BE(id.length);
    const authData = Buffer.concat([createHash("sha256").update("localhost").digest(), Buffer.from([0x45]), Buffer.alloc(4), Buffer.alloc(16), length, id, cose]);
    const attestation = isoCBOR.encode(new Map<string, string | Uint8Array | Map<string, never>>([["fmt", "none"], ["authData", authData], ["attStmt", new Map<string, never>()]]));
    return { id: credential.id, rawId: credential.id, type: "public-key", clientExtensionResults: {}, response: { clientDataJSON: b64(client), attestationObject: b64(attestation) } };
  }
  return { credential, ceremony, assertion, registration };
}

describe("Vault passkey cryptography", () => {
  it("wraps the same Vault key, exposes no plaintext key, and authenticates every binding", () => {
    const { credential } = fixture(), key = randomBytes(32), prf = randomBytes(32);
    const wrapped = wrapVaultKey(key, prf, credential), saved = { ...credential, wrapped };
    expect(unwrapVaultKey(prf, saved)).toEqual(key);
    expect(JSON.stringify(saved)).not.toContain(b64(key)); expect(JSON.stringify(saved)).not.toContain(b64(prf));
    expect(() => unwrapVaultKey(randomBytes(32), saved)).toThrow();
    for (const field of ["id", "vaultId", "origin", "salt"] as const) expect(() => unwrapVaultKey(prf, { ...saved, [field]: "changed" })).toThrow();
    const changed = Buffer.from(wrapped.ciphertext, "base64url"); changed[0] ^= 1;
    expect(() => unwrapVaultKey(prf, { ...saved, wrapped: { ...wrapped, ciphertext: b64(changed) } })).toThrow();
  });
  it("rejects missing, truncated, and malformed PRF output", () => {
    for (const input of [undefined, "", b64(randomBytes(31)), "x".repeat(44), "!".repeat(43)]) expect(() => decodePrf(input)).toThrow();
    const bytes = randomBytes(32); expect(decodePrf(b64(bytes))).toEqual(bytes);
  });
});
describe("WebAuthn verification with real synthetic signatures", () => {
  it("verifies registration and a subsequent signed, user-verified assertion", async () => {
    const { credential, ceremony, registration, assertion } = fixture();
    const result = await verifyRegistration(registration(), ceremony);
    expect(result.verified).toBe(true);
    if (result.verified) expect(b64(result.registrationInfo.credential.publicKey)).toBe(credential.publicKey);
    expect(await verifyAssertion(assertion(), ceremony, credential)).toBe(1);
  });
  it("rejects wrong origin, challenge, relying party, absent verification or presence, and repeated counters", async () => {
    const { credential, ceremony, assertion } = fixture();
    for (const overrides of [{ origin: "https://attacker.example" }, { challenge: "wrong" }, { rpID: "attacker.example" }, { flags: 1 }, { flags: 4 }]) await expect(verifyAssertion(assertion(overrides), ceremony, credential)).rejects.toThrow();
    await expect(verifyAssertion(assertion({ counter: 1 }), ceremony, { ...credential, counter: 1 })).rejects.toThrow();
  });
  it("rejects a tampered signature and a different credential", async () => {
    const { credential, ceremony, assertion } = fixture(), response = assertion();
    const signature = Buffer.from(response.response.signature, "base64url"); signature[signature.length - 1] ^= 1; response.response.signature = b64(signature);
    await expect(verifyAssertion(response, ceremony, credential)).rejects.toThrow();
    await expect(verifyAssertion({ ...assertion(), id: "wrong" }, ceremony, credential)).rejects.toThrow();
  });
});
describe("Passkey request isolation", () => {
  it("consumes a challenge exactly once, and rejects expiration and wrong browser/session", () => {
    const { ceremony } = fixture(), store = new PasskeyCeremonies();
    const once = store.put(ceremony); expect(store.take(once, "browser", "register", "session").challenge).toBe(ceremony.challenge);
    expect(() => store.take(once, "browser", "register", "session")).toThrow();
    for (const [browser, session] of [["other", "session"], ["browser", "other"]]) {
      const id = store.put(ceremony); expect(() => store.take(id, browser, "register", session)).toThrow(); expect(() => store.take(id, "browser", "register", "session")).toThrow();
    }
    expect(() => store.take(store.put(ceremony), "browser", "register", "session", Date.now() + 301_000)).toThrow();
    expect(() => store.take(store.put(ceremony), "browser", "unlock", "session")).toThrow();
  });
  it("trusts only the configured origin, never a request host or arbitrary HTTP origin", () => {
    expect(passkeyOrigin("http://localhost:3011").rpID).toBe("localhost");
    for (const value of ["http://example.com", "https://example.com/path", "https://user:password@example.com"]) expect(() => passkeyOrigin(value)).toThrow();
    expect(() => requirePasskeyOrigin(new Request("http://localhost:3011/api/vault/passkeys", { headers: { Origin: "https://attacker.example" } }))).toThrow();
    expect(() => requirePasskeyOrigin(new Request("http://attacker.example/api/vault/passkeys", { headers: { Origin: "http://localhost:3011" } }))).toThrow();
    expect(() => requirePasskeyOrigin(new Request("http://localhost:3011/api/vault/passkeys"))).toThrow();
    expect(() => requirePasskeyOrigin(new Request("http://localhost:3011/api/vault/passkeys", { headers: { Origin: "http://localhost:3011" } }))).not.toThrow();
  });
});


describe("Complete local Vault lifecycle", () => {
  it("enrolls, unlocks encrypted records, rejects replay/bad PRF/removal, and preserves passphrase recovery", async () => {
    const workspace = process.cwd();
    mkdirSync(path.join(workspace, "tmp"), { recursive: true });
    const temporary = mkdtempSync(path.join(workspace, "tmp", "passkey-test-"));
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(temporary);
    vi.resetModules(); jar.clear();
    try {
      const vault = await import("./private-vault"), sessions = await import("./vault-session");
      const { POST } = await import("../app/api/vault/passkeys/route");
      const passphrase = "synthetic-test-recovery-only";
      await vault.initialiseVault(passphrase);
      const opened = await vault.openVault(passphrase);
      vault.putVaultRecords(opened, [{ id: "test:record", kind: "reference", capturedAt: new Date().toISOString(), payload: { text: "synthetic evidence" } }]);
      const session = sessions.createVaultSession(opened.key);
      jar.set(sessions.VAULT_SESSION_COOKIE, session.token); vault.closeVault(opened);
      const dbPath = path.join(temporary, "private-data/vault/storywalker-vault.sqlite");
      const originalDatabase = readFileSync(dbPath);
      async function call(body: Record<string, unknown>) {
        const response = await POST(new Request("http://localhost:3011/api/vault/passkeys", { method: "POST", headers: { Origin: "http://localhost:3011", "Content-Type": "application/json" }, body: JSON.stringify(body) }));
        for (const cookie of response.cookies.getAll()) jar.set(cookie.name, cookie.value);
        return { status: response.status, body: await response.json() };
      }
      const f = fixture(), secret = b64(randomBytes(32));
      expect((await call({ action: "begin-enroll", label: "Fixture" })).status).toBe(400);
      const start = await call({ action: "begin-enroll", label: "Fixture", recoveryAcknowledged: true });
      expect(start.status).toBe(200); f.ceremony.challenge = start.body.options.challenge;
      const registered = await call({ action: "verify-registration", ceremonyId: start.body.ceremonyId, response: f.registration() });
      expect(registered.status).toBe(200);
      expect((await call({ action: "status" })).body.credentials).toHaveLength(0);
      f.ceremony.challenge = registered.body.options.challenge;
      const enrolled = await call({ action: "finish-enroll", ceremonyId: registered.body.ceremonyId, response: f.assertion(), prf: secret });
      expect(enrolled.status).toBe(200);
      const sidecarPath = path.join(temporary, "private-data/vault/passkeys.json");
      expect(statSync(sidecarPath).mode & 0o777).toBe(0o600);
      const persisted = readFileSync(sidecarPath, "utf8");
      expect(persisted).not.toContain(secret); expect(persisted).not.toContain(passphrase);
      expect((await call({ action: "status" })).body.credentials).toHaveLength(1);
      sessions.deleteVaultSession(session.token); jar.delete(sessions.VAULT_SESSION_COOKIE);
      const begin = await call({ action: "begin-unlock", credentialId: f.credential.id });
      f.ceremony.challenge = begin.body.options.challenge;
      const unlockBody = { action: "finish-unlock", ceremonyId: begin.body.ceremonyId, response: f.assertion({ counter: 2 }), prf: secret };
      const unlocked = await call(unlockBody); expect(unlocked.status).toBe(200);
      const unlockedSession = sessions.readVaultSession(jar.get(sessions.VAULT_SESSION_COOKIE)); expect(unlockedSession).toBeDefined();
      const viaPasskey = await vault.openVaultWithKey(unlockedSession!.key);
      expect(vault.readVaultRecord(viaPasskey, "test:record")?.payload).toEqual({ text: "synthetic evidence" }); vault.closeVault(viaPasskey);
      expect((await call(unlockBody)).status).toBe(400);
      const wrongSecret = await call({ action: "begin-unlock", credentialId: f.credential.id }); f.ceremony.challenge = wrongSecret.body.options.challenge;
      expect((await call({ action: "finish-unlock", ceremonyId: wrongSecret.body.ceremonyId, response: f.assertion({ counter: 3 }), prf: b64(randomBytes(32)) })).status).toBe(400);
      const inFlight = await call({ action: "begin-unlock", credentialId: f.credential.id }); f.ceremony.challenge = inFlight.body.options.challenge;
      expect((await call({ action: "remove", credentialId: f.credential.id })).status).toBe(200);
      sessions.deleteVaultSession(jar.get(sessions.VAULT_SESSION_COOKIE)); jar.delete(sessions.VAULT_SESSION_COOKIE);
      expect((await call({ action: "finish-unlock", ceremonyId: inFlight.body.ceremonyId, response: f.assertion({ counter: 3 }), prf: secret })).status).toBe(400);
      expect(jar.has(sessions.VAULT_SESSION_COOKIE)).toBe(false);
      expect((await call({ action: "begin-enroll", label: "Denied", recoveryAcknowledged: true })).status).toBe(401);
      expect(readFileSync(dbPath)).toEqual(originalDatabase);
      const recovered = await vault.openVault(passphrase);
      expect(vault.readVaultRecord(recovered, "test:record")?.payload).toEqual({ text: "synthetic evidence" }); vault.closeVault(recovered);
      await expect(vault.verifyVaultKey(randomBytes(32))).rejects.toThrow();
    } finally { cwd.mockRestore(); jar.clear(); rmSync(temporary, { recursive: true, force: true }); vi.resetModules(); }
  });
});
