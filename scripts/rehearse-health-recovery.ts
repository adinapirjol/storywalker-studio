/** Disposable synthetic rehearsal. Never reads the personal Vault, sessions or health exports. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EncryptedSyntheticArchive } from "../lib/health/server/encrypted-archive";

const directory = mkdtempSync(join(tmpdir(), "storywalker-synthetic-recovery-"));
const originalKey = randomBytes(32), nextKey = randomBytes(32), recoveryKey = randomBytes(32);
try {
  const original = new EncryptedSyntheticArchive(directory, originalKey, () => {});
  const future = new EncryptedSyntheticArchive(directory, nextKey, () => {});
  const seeded = original.mutate({ action: "seed", expectedRevision: null });
  const expected = () => {
    const status = original.status();
    return { expectedCurrentToken: status.currentToken, expectedBackupToken: status.backupToken };
  };
  original.recover({ action: "create-backup", ...expected(), recoveryCode: recoveryKey.toString("hex") });
  console.log("PASS: fixed invented observations saved; independent encrypted recovery snapshot authenticated.");
  original.mutate({ action: "delete-all", expectedRevision: seeded.revision });
  assert.equal(original.read()?.observations.length, 0);
  assert.throws(() => future.read());
  assert.throws(() => future.recover({ action: "preview-restore", ...expected(), recoveryCode: "00".repeat(32) }));
  console.log("PASS: current observations deleted; wrong Vault key and wrong recovery code rejected.");
  future.recover({ action: "restore-backup", ...expected(), recoveryCode: recoveryKey.toString("hex"), confirmReplace: true });
  assert.deepEqual(future.read()?.observations, seeded.observations);
  assert.notEqual(future.read()?.revision, seeded.revision);
  assert.throws(() => original.read());
  console.log("PASS: selected backup restored under a new synthetic Vault key; deleted observations return, with a new revision.");
  const migrated = original.migrateKey(nextKey, future.status().currentToken!);
  assert.deepEqual(migrated.observations, seeded.observations);
  assert.throws(() => future.read());
  original.recover({ action: "delete-backup", ...expected(), confirmDelete: true });
  assert.equal(original.status().backupToken, null);
  assert.deepEqual(original.read()?.observations, seeded.observations);
  console.log("PASS: explicit key migration verified; deleting recovery copy leaves current archive intact.");
} finally {
  originalKey.fill(0); nextKey.fill(0); recoveryKey.fill(0);
  rmSync(directory, { recursive: true, force: true });
  console.log("Disposable rehearsal directory removed. No personal Vault or workspace archive was accessed.");
}
