import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { vaultKeyIdentity, verifyVaultKey } from "@/lib/private-vault";
import { createVaultSession, readVaultSession, VAULT_SESSION_COOKIE, vaultSessionCookie } from "@/lib/vault-session";
import { authenticationOptions, changePasskeys, decodePrf, passkeyCeremonies, passkeyOrigin, readPasskeys, registrationOptions, requirePasskeyOrigin, unwrapVaultKey, verifyAssertion, verifyRegistration, wrapVaultKey } from "@/lib/vault-passkeys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const BROWSER_COOKIE = "storywalker_passkey_browser";
const bodySchema = z.object({ action: z.enum(["status", "begin-enroll", "verify-registration", "finish-enroll", "begin-unlock", "finish-unlock", "remove"]),
  ceremonyId: z.string().max(100).optional(), credentialId: z.string().max(16_384).optional(),
  label: z.string().trim().min(1).max(80).optional(), recoveryAcknowledged: z.literal(true).optional(),
  response: z.record(z.unknown()).optional(), prf: z.string().max(100).optional(),
});
function json(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store", "Pragma": "no-cache" } }); }
async function boundedBody(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") throw new Error("JSON required.");
  const reader = request.body?.getReader(); if (!reader) throw new Error("Missing request.");
  const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 65_536) { await reader.cancel(); throw new Error("Request too large."); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  return bodySchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}
export async function POST(request: Request) {
  let secret: Buffer | undefined, key: Buffer | undefined;
  try {
    requirePasskeyOrigin(request);
    const body = await boundedBody(request), jar = await cookies();
    const sessionToken = jar.get(VAULT_SESSION_COOKIE)?.value;
    const session = readVaultSession(sessionToken);
    // Keep one transient copy and erase it before returning, including errors.
    key = session?.key;
    const vaultId = await vaultKeyIdentity(), { origin } = passkeyOrigin();
    const available = () => readPasskeys().filter((item) => item.vaultId === vaultId && item.origin === origin);
    if (body.action === "status") return json({ credentials: available().map(({ id, label, createdAt }) => ({ id, label, createdAt })), origin });
    if (["begin-enroll", "verify-registration", "finish-enroll", "remove"].includes(body.action) && (!session || !sessionToken)) return json({ error: "Unlock the Vault before adding or removing a passkey." }, 401);
    if (body.action === "remove") {
      if (!body.credentialId) throw new Error("Missing credential.");
      changePasskeys((items) => items.filter((item) => !(item.id === body.credentialId && item.vaultId === vaultId && item.origin === origin)));
      return json({ removed: true });
    }
    const browser = jar.get(BROWSER_COOKIE)?.value ?? randomBytes(32).toString("base64url");
    function reply(value: unknown) {
      const result = json(value);
      result.cookies.set(BROWSER_COOKIE, browser, { httpOnly: true, sameSite: "strict", secure: origin.startsWith("https:"), path: "/api/vault/passkeys", maxAge: 600 });
      return result;
    }
    if (body.action === "begin-enroll") {
      if (!body.recoveryAcknowledged || !body.label) return json({ error: "Keep your recovery passphrase and give this passkey a name first." }, 400);
      if (readPasskeys().length >= 10) return json({ error: "Remove an unused passkey before adding another." }, 400);
      const options = await registrationOptions(vaultId, available());
      const ceremonyId = passkeyCeremonies.put({ kind: "register", challenge: options.challenge, browser, vaultId, origin, sessionToken: sessionToken!, label: body.label });
      return reply({ options, ceremonyId });
    }
    if (body.action === "begin-unlock") {
      const credential = available().find((item) => item.id === body.credentialId);
      if (!credential) return json({ error: "No matching passkey is enrolled here. Unlock with your passphrase to add one." }, 400);
      const { options, salt } = await authenticationOptions(credential);
      const ceremonyId = passkeyCeremonies.put({ kind: "unlock", challenge: options.challenge, browser, vaultId, origin, credential });
      return reply({ options, salt, ceremonyId });
    }
    if (!body.ceremonyId || !body.response) throw new Error("Missing passkey response.");
    const kind = body.action === "verify-registration" ? "register" : body.action === "finish-enroll" ? "enroll" : "unlock";
    const ceremony = passkeyCeremonies.take(body.ceremonyId, browser, kind, sessionToken);
    if (ceremony.vaultId !== vaultId || ceremony.origin !== origin) throw new Error("Vault changed.");
    if (ceremony.kind === "register") {
      const result = await verifyRegistration(body.response as unknown as RegistrationResponseJSON, ceremony);
      if (!result.verified) throw new Error("Registration failed.");
      const credential = { id: result.registrationInfo.credential.id, publicKey: Buffer.from(result.registrationInfo.credential.publicKey).toString("base64url"), counter: result.registrationInfo.credential.counter,
        vaultId, origin, label: ceremony.label, createdAt: new Date().toISOString(), salt: randomBytes(32).toString("base64url") };
      const { options, salt } = await authenticationOptions(credential);
      const ceremonyId = passkeyCeremonies.put({ kind: "enroll", challenge: options.challenge, browser, vaultId, origin, credential, sessionToken: sessionToken! });
      return reply({ options, salt, ceremonyId });
    }
    const credential = ceremony.credential;
    const counter = await verifyAssertion(body.response as unknown as AuthenticationResponseJSON, ceremony, credential);
    secret = decodePrf(body.prf);
    if (ceremony.kind === "enroll") {
      // Session may have expired or been locked while the authenticator was verifying.
      const fresh = readVaultSession(sessionToken); if (!fresh) throw new Error("Session expired.");
      key?.fill(0); key = fresh.key;
      await verifyVaultKey(key);
      const wrapped = wrapVaultKey(key, secret, credential);
      const roundTrip = unwrapVaultKey(secret, { ...credential, wrapped });
      try { await verifyVaultKey(roundTrip); } finally { roundTrip.fill(0); }
      if (!readVaultSession(sessionToken)) throw new Error("Session expired.");
      changePasskeys((items) => { if (items.some((item) => item.id === credential.id)) throw new Error("Already enrolled."); return [...items, { ...credential, counter, wrapped }]; });
      return reply({ enrolled: true });
    }
    key?.fill(0); key = unwrapVaultKey(secret, ceremony.credential);
    await verifyVaultKey(key);
    // Check the fresh store before granting access: removal/counter changes invalidate in-flight assertions.
    changePasskeys((items) => {
      const current = items.find((item) => item.id === credential.id && item.vaultId === vaultId && item.origin === origin);
      if (!current || JSON.stringify(current) !== JSON.stringify(credential)) throw new Error("Passkey changed. Start again.");
      return items.map((item) => item === current ? { ...item, counter } : item);
    });
    const unlocked = createVaultSession(key);
    const result = reply({ session: { active: true, expiresAt: unlocked.expiresAt } });
    result.cookies.set(vaultSessionCookie(unlocked.token, unlocked.expiresAt));
    return result;
  } catch {
    // Never include library diagnostics, PRF material, or request contents in logs or responses.
    return json({ error: "Passkey verification did not complete. Retry from the Vault, or unlock with your recovery passphrase. Nothing was migrated." }, 400);
  } finally { secret?.fill(0); key?.fill(0); }
}
