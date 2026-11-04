import { createHmac, timingSafeEqual } from "node:crypto";

export const MODEL_PREVIEW_TTL_MS = 5 * 60 * 1000;

function signature(key: Uint8Array, requestId: string, snapshotHash: string, expiresAt: string) {
  return createHmac("sha256", key)
    .update(JSON.stringify({ purpose: "nova-model-preview-v1", requestId, snapshotHash, expiresAt }))
    .digest("hex");
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
