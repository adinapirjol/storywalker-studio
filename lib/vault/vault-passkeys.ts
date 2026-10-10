import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { isIP } from "node:net";
import path from "node:path";
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse, type AuthenticationResponseJSON, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { z } from "zod";
import { withVaultFileLock } from "./vault-file-lock";
import { isLocalSameOrigin } from "@/lib/http/local-origin";

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

export function passkeyOrigin(configured = process.env.STORYWALKER_PASSKEY_ORIGIN ?? "http://localhost:3000") {
  const url = new URL(configured);
  if (url.origin !== configured || url.username || url.password || isIP(url.hostname.replace(/^\[|\]$/g, "")) || (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost"))) throw new Error("Invalid passkey origin configuration.");
  return { origin: url.origin, rpID: url.hostname };
}
export function requirePasskeyOrigin(request: Request) {
  const { origin } = passkeyOrigin();
  const target = new URL(request.url);
  const actualOrigin = `${target.protocol}//${request.headers.get("host") ?? target.host}`;
  if (request.headers.get("sec-fetch-site") === "cross-site" || request.headers.get("origin") !== origin || actualOrigin !== origin) throw new Error("Open the Vault at its configured passkey address.");
}
/** Only non-secret address guidance is available from an alternate local address. */
export function passkeyAddressStatus(request: Request) {
  const { origin } = passkeyOrigin();
  if (request.headers.get("origin") === origin) {
    requirePasskeyOrigin(request);
    return { origin, supportedOrigin: true };
  }
  if (!isLocalSameOrigin(request)) throw new Error("Local origin required.");
  return { origin, supportedOrigin: false };
}
export function readPasskeys(): VaultPasskey[] {
  for (const entry of [path.dirname(path.dirname(file)), path.dirname(file), file]) {
    if (lstatSync(entry, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error("Passkey storage must not be a symbolic link.");
  }
  return existsSync(file) ? storeSchema.parse(JSON.parse(readFileSync(file, "utf8"))).credentials : [];
}
/** Atomic compare-and-replace, excluding other route bundles and CLI writers. */
export function changePasskeys(change: (current: VaultPasskey[]) => VaultPasskey[]) {
  readPasskeys(); // Reject redirected storage before creating directories or locks.
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  return withVaultFileLock(file, () => {
    const next = storeSchema.parse({ version: 1, credentials: change(readPasskeys()) });
    const temporary = `${file}.${randomBytes(8).toString("hex")}.tmp`;
    try {
      writeFileSync(temporary, JSON.stringify(next), { mode: 0o600, flag: "wx" });
      renameSync(temporary, file);
      chmodSync(file, 0o600);
    } finally { if (existsSync(temporary)) unlinkSync(temporary); }
  });
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
const ceremonyStore = globalThis as typeof globalThis & { __storywalkerPasskeyCeremonies?: PasskeyCeremonies };
export const passkeyCeremonies = ceremonyStore.__storywalkerPasskeyCeremonies ??= new PasskeyCeremonies();

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
  // Preference only: the browser still offers compatible phone/security-key paths.
  options.hints = ["client-device", "hybrid", "security-key"];
  return { options, salt: credential.salt };
}
export async function verifyAssertion(response: AuthenticationResponseJSON, ceremony: Ceremony, credential: NewCredential) {
  if (response.id !== credential.id) throw new Error("Unexpected passkey.");
  const result = await verifyAuthenticationResponse({ response, expectedChallenge: ceremony.challenge, expectedOrigin: ceremony.origin, expectedRPID: new URL(ceremony.origin).hostname,
    credential: { id: credential.id, publicKey: new Uint8Array(Buffer.from(credential.publicKey, "base64url")), counter: credential.counter }, requireUserVerification: true });
  if (!result.verified) throw new Error("Passkey verification failed.");
  return result.authenticationInfo.newCounter;
}
