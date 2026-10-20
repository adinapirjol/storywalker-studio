import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { EncryptedSyntheticArchive, ArchiveCommitUncertainError } from "./server/encrypted-archive";
import { decryptArchive } from "./server/archive-crypto";
import type { RecoveryCommand } from "./synthetic-archive";
vi.mock("node:fs", { spy: true });

let directory: string;
const oldKey = Buffer.alloc(32, 19), nextKey = Buffer.alloc(32, 20);
const code = randomBytes(32).toString("hex"); // Disposable synthetic test only.
const store = (key = oldKey, check = () => {}) => new EncryptedSyntheticArchive(directory, key, check);
function expected() {
  const status = store().status();
  return { expectedCurrentToken: status.currentToken, expectedBackupToken: status.backupToken };
}
const backup = () => store().recover({ action: "create-backup", ...expected(), recoveryCode: code });
const restore = (key = oldKey) => store(key).recover({ action: "restore-backup", ...expected(), recoveryCode: code, confirmReplace: true });
beforeEach(() => { vi.mocked(fs.fsyncSync).mockReset(); directory = fs.mkdtempSync(join(tmpdir(), "study04-recovery-")); });
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(directory, { recursive: true, force: true }); });

function seeded() { return store().mutate({ action: "seed", expectedRevision: null }); }

describe("synthetic archive key migration and recovery", () => {
  it("migrates with the old key, preserves all observations, rejects the old key afterwards", () => {
    const before = seeded();
    const next = store(nextKey).migrateKey(oldKey, expected().expectedCurrentToken!);
    expect(next.observations).toEqual(before.observations);
    expect(next.importedAt).toBe(before.importedAt);
    expect(next.revision).not.toBe(before.revision);
    expect(store(nextKey).read()).toEqual(next);
    expect(() => store().read()).toThrow("ARCHIVE_UNREADABLE");
  });
  it("does not replace a legacy archive when the old key or version is wrong", () => {
    seeded(); const original = fs.readFileSync(store().file);
    expect(() => store(nextKey).migrateKey(randomBytes(32), expected().expectedCurrentToken!)).toThrow("ARCHIVE_UNREADABLE");
    expect(() => store(nextKey).migrateKey(oldKey, "0".repeat(64))).toThrow("changed");
    expect(fs.readFileSync(store().file)).toEqual(original);
  });
  it("authenticates a backup independently; domain separation rejects swapped archive/backup files", () => {
    const before = seeded(); backup();
    const bytes = fs.readFileSync(store().backupFile);
    const recoveryKey = Buffer.from(code, "hex");
    expect(decryptArchive(bytes, recoveryKey, "recovery")).toEqual(before);
    expect(() => decryptArchive(bytes, oldKey, "recovery")).toThrow();
    expect(() => decryptArchive(bytes, recoveryKey)).toThrow();
    expect(() => decryptArchive(fs.readFileSync(store().file), oldKey, "recovery")).toThrow();
    for (const value of [before.importedAt, before.revision, code, "fixture-diary", "Synthetic Watch"]) {
      expect(bytes.includes(Buffer.from(value))).toBe(false);
    }
    expect(fs.statSync(store().backupFile).mode & 0o777).toBe(0o600);
    expect(() => backup()).toThrow("BACKUP_EXISTS");
  });
  it("previews without changing files; restores after key loss and prevents stale edits", () => {
    const before = seeded(); backup();
    const bytes = fs.readFileSync(store().file), copy = fs.readFileSync(store().backupFile);
    const preview = store(nextKey).recover({ action: "preview-restore", ...expected(), recoveryCode: code });
    expect(preview?.observations).toBe(before.observations.length);
    expect(fs.readFileSync(store().file)).toEqual(bytes);
    restore(nextKey);
    expect(store(nextKey).read()?.observations).toEqual(before.observations);
    expect(store(nextKey).read()?.revision).not.toBe(before.revision);
    expect(fs.readFileSync(store().backupFile)).toEqual(copy);
    expect(() => store(nextKey).mutate({ action: "delete-all", expectedRevision: before.revision })).toThrow("changed");
  });
  it("restores an independently copied backup into a new store without the original archive or key", () => {
    const before = seeded(); backup();
    const destination = join(directory, "restored"); fs.mkdirSync(destination, { mode: 0o700 });
    const recovered = new EncryptedSyntheticArchive(destination, nextKey, () => {});
    fs.copyFileSync(store().backupFile, recovered.backupFile);
    const status = recovered.status();
    recovered.recover({ action: "restore-backup", recoveryCode: code, expectedCurrentToken: null, expectedBackupToken: status.backupToken, confirmReplace: true });
    expect(recovered.read()?.observations).toEqual(before.observations);
    expect(fs.readFileSync(recovered.file)).not.toEqual(fs.readFileSync(store().file));
  });
  it("can replace a bounded corrupt current snapshot after an authenticated preview", () => {
    const before = seeded(); backup(); fs.writeFileSync(store().file, Buffer.from("broken synthetic ciphertext"));
    expect(() => store().read()).toThrow();
    restore(nextKey);
    expect(store(nextKey).read()?.observations).toEqual(before.observations);
  });
  it("rejects wrong recovery codes and tampered/truncated backups without changing current data", () => {
    seeded(); backup(); const original = fs.readFileSync(store().file), copy = fs.readFileSync(store().backupFile);
    expect(() => store().recover({ action: "restore-backup", ...expected(), recoveryCode: randomBytes(32).toString("hex"), confirmReplace: true })).toThrow("ARCHIVE_UNREADABLE");
    for (const position of [0, 12, 44, 55, 500]) {
      const corrupt = Buffer.from(copy); corrupt[position] ^= 1; fs.writeFileSync(store().backupFile, corrupt);
      expect(() => restore()).toThrow("ARCHIVE_UNREADABLE");
    }
    fs.writeFileSync(store().backupFile, copy.subarray(0, 50));
    expect(() => restore()).toThrow("ARCHIVE_UNREADABLE");
    expect(fs.readFileSync(store().file)).toEqual(original);
  });
  it("rejects changed current or backup tokens between preview and restore", () => {
    const before = seeded(); backup(); const stale = expected();
    store().mutate({ action: "delete-all", expectedRevision: before.revision });
    expect(() => store().recover({ action: "restore-backup", ...stale, recoveryCode: code, confirmReplace: true })).toThrow("changed");
    expect(() => store().recover({ action: "restore-backup", ...expected(), expectedBackupToken: "0".repeat(64), recoveryCode: code, confirmReplace: true })).toThrow("changed");
    expect(store().read()?.observations).toEqual([]);
  });
  it("keeps deleted records in an older backup until that backup is explicitly deleted", () => {
    const before = seeded(); backup();
    const cleared = store().mutate({ action: "delete-all", expectedRevision: before.revision });
    expect(store().read()?.observations).toEqual([]);
    expect(store().recover({ action: "preview-restore", ...expected(), recoveryCode: code })?.observations).toBe(before.observations.length);
    restore(); expect(store().read()?.observations).toEqual(before.observations);
    expect(store().read()?.revision).not.toBe(cleared.revision);
    const current = fs.readFileSync(store().file);
    store().recover({ action: "delete-backup", ...expected(), confirmDelete: true });
    expect(fs.existsSync(store().backupFile)).toBe(false);
    expect(fs.readFileSync(store().file)).toEqual(current);
    expect(() => restore()).toThrow("BACKUP_MISSING");
  });
  it.each(["create", "restore", "migrate"])("preserves old data when %s is interrupted before rename", operation => {
    seeded(); if (operation !== "create") backup();
    const original = fs.readFileSync(store().file), status = store().status();
    vi.mocked(fs.fsyncSync).mockImplementationOnce(() => { throw new Error("simulated file sync failure"); });
    expect(() => operation === "create" ? backup() : operation === "restore" ? restore(nextKey) : store(nextKey).migrateKey(oldKey, status.currentToken!)).toThrow("simulated file sync failure");
    expect(fs.readFileSync(store().file)).toEqual(original);
    expect(store().status()).toEqual(status);
    expect(fs.readdirSync(directory).some(name => name.startsWith(".pending-") || name.endsWith(".lock"))).toBe(false);
  });
  it.each(["create", "restore", "migrate"])("reports %s commit uncertainty after rename and permits authenticated inspection", operation => {
    const before = seeded(); if (operation !== "create") backup();
    const token = store().status().currentToken!;
    vi.mocked(fs.fsyncSync).mockImplementationOnce(() => {}).mockImplementationOnce(() => { throw new Error("simulated directory sync failure"); });
    expect(() => operation === "create" ? backup() : operation === "restore" ? restore(nextKey) : store(nextKey).migrateKey(oldKey, token)).toThrow(ArchiveCommitUncertainError);
    if (operation === "create") {
      expect(store().recover({ action: "preview-restore", ...expected(), recoveryCode: code })?.observations).toBe(before.observations.length);
    } else expect(store(nextKey).read()?.observations).toEqual(before.observations);
  });
  it("reports backup deletion uncertainty after unlink without claiming the copy survives", () => {
    seeded(); backup();
    vi.mocked(fs.fsyncSync).mockImplementationOnce(() => { throw new Error("directory sync failure"); });
    expect(() => store().recover({ action: "delete-backup", ...expected(), confirmDelete: true })).toThrow(ArchiveCommitUncertainError);
    expect(store().status().backupToken).toBeNull();
    expect(store().read()?.observations.length).toBeGreaterThan(0);
  });
  it("checks revocation immediately before restore commit and preserves the old file", () => {
    seeded(); backup(); const original = fs.readFileSync(store().file);
    let revoked = false;
    vi.mocked(fs.fsyncSync).mockImplementationOnce(() => { revoked = true; });
    expect(() => store(nextKey, () => { if (revoked) throw new Error("revoked"); }).recover({ action: "restore-backup", ...expected(), recoveryCode: code, confirmReplace: true })).toThrow("revoked");
    expect(fs.readFileSync(store().file)).toEqual(original);
  });
  it("fails closed on crash locks and link attacks against recovery files", () => {
    seeded(); backup();
    fs.writeFileSync(`${store().file}.lock`, "", { mode: 0o600 });
    expect(() => restore()).toThrow("busy");
    fs.unlinkSync(`${store().file}.lock`);
    const target = join(directory, "other.enc"); fs.renameSync(store().backupFile, target);
    fs.symlinkSync(target, store().backupFile); expect(() => restore()).toThrow();
    fs.unlinkSync(store().backupFile); fs.linkSync(target, store().backupFile); expect(() => restore()).toThrow();
  });
  it.each([false, true])("survives process death around migration rename (after rename=%s), requiring stopped-writer cleanup", afterRename => {
    const before = seeded(); backup();
    const child = spawnSync(process.execPath, ["--import", "tsx", "--eval", `
      const fs = require('node:fs');
      const rename = fs.renameSync;
      fs.renameSync = (...args) => {
        if (process.env.AFTER_RENAME === 'true') rename(...args);
        process.kill(process.pid, 'SIGKILL');
      };
      const { EncryptedSyntheticArchive } = require('./lib/health/server/encrypted-archive.ts');
      const archive = new EncryptedSyntheticArchive(process.env.TEST_ARCHIVE_DIR, Buffer.alloc(32,20), () => {});
      archive.migrateKey(Buffer.alloc(32,19), archive.status().currentToken);
    `], { env: { ...process.env, TEST_ARCHIVE_DIR: directory, AFTER_RENAME: String(afterRename) }, encoding: "utf8", timeout: 15000 });
    expect(child.signal).toBe("SIGKILL");
    expect(store(afterRename ? nextKey : oldKey).read()?.observations).toEqual(before.observations);
    expect(() => restore()).toThrow("busy");
    // Only after the child is confirmed dead: explicit cleanup in this disposable fixture.
    fs.unlinkSync(`${store().file}.lock`);
    for (const name of fs.readdirSync(directory)) if (name.startsWith(".pending-")) fs.unlinkSync(join(directory, name));
    restore(nextKey);
    expect(store(nextKey).read()?.observations).toEqual(before.observations);
  });
  it("does not accept weak passphrases, arbitrary payloads or unconfirmed replacements", () => {
    seeded(); backup();
    for (const extra of [{ recoveryCode: "short" }, { notes: "ARBITRARY_PRIVATE_CANARY" }, { confirmReplace: false }]) {
      const command = { action: "restore-backup", ...expected(), recoveryCode: code, confirmReplace: true, ...extra };
      expect(() => store().recover(command as RecoveryCommand)).toThrow();
    }
  });
});
