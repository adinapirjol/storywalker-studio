import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

export const MODEL_PREVIEW_TTL_MS = 5 * 60 * 1000;

const VAULT_KEY_SALT = Buffer.from("storywalker-vault-subkey-derivation-v1");
const PERMIT_KEY_INFO = "storywalker:nova-model-permit:v1";

function signature(vaultKey: Uint8Array, requestId: string, snapshotHash: string, expiresAt: string) {
  const key = Buffer.from(hkdfSync("sha256", vaultKey, VAULT_KEY_SALT, PERMIT_KEY_INFO, 32));
  try {
    return createHmac("sha256", key)
      .update(JSON.stringify({ requestId, snapshotHash, expiresAt }))
      .digest("hex");
  } finally {
    key.fill(0);
  }
}

export function issueModelPreviewPermit(key: Uint8Array, requestId: string, snapshotHash: string, now = Date.now()) {
  const expiresAt = new Date(now + MODEL_PREVIEW_TTL_MS).toISOString();
  return { expiresAt, requestSignature: signature(key, requestId, snapshotHash, expiresAt) };
}

export function verifyModelPreviewPermit(
  key: Uint8Array,
  permit: { requestId: string; snapshotHash: string; expiresAt: string; requestSignature: string },
  now = Date.now(),
) {
  const expires = Date.parse(permit.expiresAt);
  if (!Number.isFinite(expires) || expires <= now || expires > now + MODEL_PREVIEW_TTL_MS + 30_000) return false;
  if (!/^[a-f0-9]{64}$/.test(permit.requestSignature)) return false;
  const actual = Buffer.from(permit.requestSignature, "hex");
  const expected = Buffer.from(signature(key, permit.requestId, permit.snapshotHash, permit.expiresAt), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
