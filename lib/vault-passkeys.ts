import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse, type AuthenticationResponseJSON, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { z } from "zod";

const encoded = z.string().min(1).max(16_384).regex(/^[A-Za-z0-9_-]+$/);
const recordSchema = z.object({
  id: encoded, publicKey: encoded, counter: z.number().int().nonnegative(),
  salt: encoded, vaultId: encoded, origin: z.string().url(), label: z.string().min(1).max(80), createdAt: z.string().datetime(),
  wrapped: z.object({ iv: encoded, tag: encoded, ciphertext: encoded }),
});
export type VaultPasskey = z.infer<typeof recordSchema>;
type NewCredential = Omit<VaultPasskey, "wrapped">;
type Ceremony = { challenge: string; browser: string; expiresAt: number; vaultId: string; origin: string } & (
  { kind: "register"; sessionToken: string; label: string } |
  { kind: "enroll"; sessionToken: string; credential: NewCredential } |
  { kind: "unlock"; credential: VaultPasskey }
);
const storeSchema = z.object({ version: z.literal(1), credentials: z.array(recordSchema).max(10) });
const file = path.join(process.cwd(), "private-data", "vault", "passkeys.json");

export function passkeyOrigin(configured = process.env.STORYWALKER_PASSKEY_ORIGIN ?? "http://localhost:3011") {
  const url = new URL(configured);
  if (url.origin !== configured || url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost"))) throw new Error("Invalid passkey origin configuration.");
  return { origin: url.origin, rpID: url.hostname };
}
export function requirePasskeyOrigin(request: Request) {
  const { origin } = passkeyOrigin();
  if (request.headers.get("origin") !== origin || new URL(request.url).origin !== origin) throw new Error("Open the Vault at its configured passkey address.");
}
export function readPasskeys(): VaultPasskey[] {
  return existsSync(file) ? storeSchema.parse(JSON.parse(readFileSync(file, "utf8"))).credentials : [];
}
/** Synchronous read/modify/rename avoids lost updates inside this local Node process. */
export function changePasskeys(change: (current: VaultPasskey[]) => VaultPasskey[]) {
  const next = storeSchema.parse({ version: 1, credentials: change(readPasskeys()) });
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomBytes(8).toString("hex")}.tmp`;
  writeFileSync(temporary, JSON.stringify(next), { mode: 0o600, flag: "wx" });
  renameSync(temporary, file); chmodSync(file, 0o600);
}
export function decodePrf(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error("This passkey did not provide encryption support.");
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== 32 || bytes.toString("base64url") !== value) throw new Error("Invalid encryption result.");
  return bytes;
}
function binding(credential: NewCredential) { return Buffer.from(JSON.stringify(["storywalker-passkey-v1", credential.vaultId, credential.id, credential.origin, credential.salt])); }
function wrappingKey(prf: Buffer, credential: NewCredential) {
  if (prf.length !== 32) throw new Error("Invalid encryption result.");
  return Buffer.from(hkdfSync("sha256", prf, Buffer.from(credential.salt, "base64url"), binding(credential), 32));
}
export function wrapVaultKey(key: Buffer, prf: Buffer, credential: NewCredential): VaultPasskey["wrapped"] {
  if (key.length !== 32) throw new Error("Invalid Vault key.");
  const wrapping = wrappingKey(prf, credential);
  try {
    const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", wrapping, iv);
    cipher.setAAD(binding(credential));
    const ciphertext = Buffer.concat([cipher.update(key), cipher.final()]);
    return { iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), ciphertext: ciphertext.toString("base64url") };
  } finally { wrapping.fill(0); }
}
export function unwrapVaultKey(prf: Buffer, credential: VaultPasskey) {
  const wrapping = wrappingKey(prf, credential);
  try {
    const cipher = createDecipheriv("aes-256-gcm", wrapping, Buffer.from(credential.wrapped.iv, "base64url"));
    cipher.setAAD(binding(credential)); cipher.setAuthTag(Buffer.from(credential.wrapped.tag, "base64url"));
    const key = Buffer.concat([cipher.update(Buffer.from(credential.wrapped.ciphertext, "base64url")), cipher.final()]);
    if (key.length !== 32) throw new Error("Invalid Vault key.");
    return key;
  } finally { wrapping.fill(0); }
}

export class PasskeyCeremonies {
  private pending = new Map<string, Ceremony>();
  put(ceremony: Ceremony extends infer C ? C extends Ceremony ? Omit<C, "expiresAt"> : never : never) {
    for (const [id, value] of this.pending) if (value.expiresAt <= Date.now()) this.pending.delete(id);
    if (this.pending.size >= 100) throw new Error("Too many pending requests. Try again shortly.");
    const id = randomBytes(32).toString("base64url");
    this.pending.set(id, { ...ceremony, expiresAt: Date.now() + 5 * 60_000 } as Ceremony);
    return id;
  }
  take(id: string, browser: string, kind: Ceremony["kind"], sessionToken?: string, now = Date.now()) {
    const ceremony = this.pending.get(id);
    this.pending.delete(id); // Every completion attempt consumes the challenge, including failures.
    if (!ceremony || ceremony.expiresAt <= now || ceremony.browser !== browser || ceremony.kind !== kind || (ceremony.kind !== "unlock" && ceremony.sessionToken !== sessionToken)) throw new Error("Passkey request expired. Start again.");
    return ceremony;
  }
}
export const passkeyCeremonies = new PasskeyCeremonies();

export async function registrationOptions(vaultId: string, credentials: VaultPasskey[]) {
  return generateRegistrationOptions({
    rpName: "Storywalker Vault", rpID: passkeyOrigin().rpID, userName: "Local Storywalker Vault",
    userID: Buffer.from(vaultId, "base64url"), attestationType: "none", timeout: 120_000,
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    excludeCredentials: credentials.map(({ id }) => ({ id })),
  });
}
export async function verifyRegistration(response: RegistrationResponseJSON, ceremony: Ceremony) {
  return verifyRegistrationResponse({ response, expectedChallenge: ceremony.challenge, expectedOrigin: ceremony.origin, expectedRPID: new URL(ceremony.origin).hostname, requireUserVerification: true });
}
export async function authenticationOptions(credential: NewCredential) {
  const options = await generateAuthenticationOptions({ rpID: new URL(credential.origin).hostname, userVerification: "required", timeout: 120_000, allowCredentials: [{ id: credential.id }] });
  return { options, salt: credential.salt };
}
export async function verifyAssertion(response: AuthenticationResponseJSON, ceremony: Ceremony, credential: NewCredential) {
  if (response.id !== credential.id) throw new Error("Unexpected passkey.");
  const result = await verifyAuthenticationResponse({ response, expectedChallenge: ceremony.challenge, expectedOrigin: ceremony.origin, expectedRPID: new URL(ceremony.origin).hostname,
    credential: { id: credential.id, publicKey: new Uint8Array(Buffer.from(credential.publicKey, "base64url")), counter: credential.counter }, requireUserVerification: true });
  if (!result.verified) throw new Error("Passkey verification failed.");
  return result.authenticationInfo.newCounter;
}
