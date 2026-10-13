import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const encoded = (bytes: number) => z.string().refine(value => /^[A-Za-z0-9_-]+$/.test(value) && Buffer.from(value, "base64url").length === bytes && Buffer.from(value, "base64url").toString("base64url") === value);
const common = { createdAt: z.string().datetime(), verifier: encoded(32) };
const legacy = z.object({ ...common, schemaVersion: z.literal(1), salt: encoded(16) }).strict();
const envelope = z.object({
  ...common, schemaVersion: z.literal(2), vaultId: encoded(32),
  recovery: z.object({ kdf: z.literal("scrypt-v1"), salt: encoded(16), iv: encoded(12), tag: encoded(16), ciphertext: encoded(32) }).strict(),
}).strict();
export const vaultMetadataSchema = z.discriminatedUnion("schemaVersion", [legacy, envelope]);
export type VaultMetadata = z.infer<typeof vaultMetadataSchema>;
export class VaultRecoveryError extends Error {}

export function recoveryKeyFrom(passphrase: string, salt: string) {
  if (passphrase.length < 12 || passphrase.length > 512) throw new VaultRecoveryError("Use a recovery passphrase between 12 and 512 characters.");
  // Preserve the existing scrypt parameters; pin them for persisted envelopes.
  return scryptSync(passphrase, Buffer.from(salt, "base64url"), 32, { N: 16384, r: 8, p: 1 });
}
export function dataKeyVerifier(key: Buffer) {
  return createHmac("sha256", key).update("storywalker-vault:v1:passphrase-check").digest("base64url");
}
export function verifyRecoveryDataKey(meta: VaultMetadata, key: Buffer) {
  const expected = Buffer.from(meta.verifier, "base64url");
  const actual = Buffer.from(dataKeyVerifier(key), "base64url");
  if (key.length !== 32 || expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new VaultRecoveryError("That recovery passphrase cannot unlock this Vault.");
}
export function recoveryVaultIdentity(meta: VaultMetadata) {
  return meta.schemaVersion === 2 ? meta.vaultId : createHash("sha256").update(JSON.stringify([1, meta.salt, meta.createdAt])).digest("base64url");
}
function binding(meta: { vaultId: string; createdAt: string; verifier: string }, salt: string) {
  return Buffer.from(JSON.stringify(["storywalker-recovery-v2", meta.vaultId, meta.createdAt, meta.verifier, "scrypt-v1", salt]));
}
export function unlockRecoveryKey(meta: VaultMetadata, passphrase: string) {
  let key: Buffer | undefined;
  let wrapping: Buffer | undefined;
  try {
    if (meta.schemaVersion === 1) key = recoveryKeyFrom(passphrase, meta.salt);
    else {
      wrapping = recoveryKeyFrom(passphrase, meta.recovery.salt);
      const cipher = createDecipheriv("aes-256-gcm", wrapping, Buffer.from(meta.recovery.iv, "base64url"));
      cipher.setAAD(binding(meta, meta.recovery.salt));
      cipher.setAuthTag(Buffer.from(meta.recovery.tag, "base64url"));
      key = Buffer.concat([cipher.update(Buffer.from(meta.recovery.ciphertext, "base64url")), cipher.final()]);
    }
    verifyRecoveryDataKey(meta, key);
    return key;
  } catch {
    key?.fill(0);
    throw new VaultRecoveryError("That recovery passphrase cannot unlock this Vault.");
  } finally { wrapping?.fill(0); }
}

/** Rewrap the existing data key. Record ciphertext and passkey bindings stay intact. */
export function replaceRecoveryEnvelope(meta: VaultMetadata, dataKey: Buffer, current: string, next: string): VaultMetadata {
  const verified = unlockRecoveryKey(meta, current);
  try {
    if (dataKey.length !== verified.length || !timingSafeEqual(dataKey, verified)) throw new VaultRecoveryError("Vault authority changed. Unlock and try again.");
    if (current === next) throw new VaultRecoveryError("Choose a different recovery passphrase.");
    const salt = randomBytes(16).toString("base64url");
    const wrapping = recoveryKeyFrom(next, salt);
    try {
      const identity = { vaultId: recoveryVaultIdentity(meta), createdAt: meta.createdAt, verifier: meta.verifier };
      const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", wrapping, iv);
      cipher.setAAD(binding(identity, salt));
      const ciphertext = Buffer.concat([cipher.update(dataKey), cipher.final()]);
      const result = vaultMetadataSchema.parse({ schemaVersion: 2, ...identity, recovery: {
        kdf: "scrypt-v1", salt, iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), ciphertext: ciphertext.toString("base64url"),
      } });
      const check = unlockRecoveryKey(result, next);
      try { if (!timingSafeEqual(check, dataKey)) throw new Error("Recovery verification failed."); } finally { check.fill(0); }
      return result;
    } finally { wrapping.fill(0); }
  } finally { verified.fill(0); }
}
