import { expect, it } from "vitest";
import { issueModelPreviewPermit, MODEL_PREVIEW_TTL_MS, verifyModelPreviewPermit } from "./model-permit";

const key = Buffer.from("fictional Nova Vault key fixture");
const requestId = "00000000-0000-4000-8000-000000000001";
const snapshotHash = "a".repeat(64);
const now = Date.parse("2026-10-20T12:00:00.000Z");

it("binds one preview permit to its request id, snapshot and expiry", () => {
  const permit = issueModelPreviewPermit(key, requestId, snapshotHash, now);
  expect(Date.parse(permit.expiresAt)).toBe(now + MODEL_PREVIEW_TTL_MS);
  expect(verifyModelPreviewPermit(key, { requestId, snapshotHash, ...permit }, now)).toBe(true);
  expect(verifyModelPreviewPermit(Buffer.from("another fictional Vault key"), { requestId, snapshotHash, ...permit }, now)).toBe(false);
  expect(verifyModelPreviewPermit(key, { requestId: "00000000-0000-4000-8000-000000000002", snapshotHash, ...permit }, now)).toBe(false);
  expect(verifyModelPreviewPermit(key, { requestId, snapshotHash: "b".repeat(64), ...permit }, now)).toBe(false);
  expect(verifyModelPreviewPermit(key, { requestId, snapshotHash, ...permit, expiresAt: new Date(now + MODEL_PREVIEW_TTL_MS + 1).toISOString() }, now)).toBe(false);
  expect(verifyModelPreviewPermit(key, { requestId, snapshotHash, ...permit }, now + MODEL_PREVIEW_TTL_MS)).toBe(false);
});
