import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { EncryptedSyntheticArchive, ArchiveCommitUncertainError } from "./server/encrypted-archive";
import { archiveBytes, decryptArchive, encryptArchive } from "./server/archive-crypto";
import { validateSyntheticArchive } from "./server/synthetic-observations";
import { rehearsalCommand } from "./synthetic-archive";
vi.mock("node:fs", { spy: true });

let directory: string;
const key = Buffer.alloc(32, 19); // Fictional test key; never a user key.
const store = (authorize = () => {}) => new EncryptedSyntheticArchive(directory, key, authorize);
const seed = () => store().mutate({ action: "seed", expectedRevision: null });
beforeEach(() => { vi.mocked(fs.fsyncSync).mockReset(); directory = fs.mkdtempSync(join(tmpdir(), "study04-synthetic-")); });
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(directory, { recursive: true, force: true }); });

describe("isolated synthetic encrypted archive", () => {
  it("persists provenance and unknown/skipped ratings across a new process", () => {
    const saved = seed();
    expect(store().read()).toEqual(saved);
    const output = execFileSync(process.execPath, ["--import", "tsx", "--eval", `
      const { EncryptedSyntheticArchive } = require('./lib/health/server/encrypted-archive.ts');
      const x = new EncryptedSyntheticArchive(process.env.TEST_ARCHIVE_DIR, Buffer.alloc(32,19), () => {}).read();
      process.stdout.write(JSON.stringify({ revision: x.revision, count: x.observations.length }));
    `], { env: { ...process.env, TEST_ARCHIVE_DIR: directory }, encoding: "utf8" });
    expect(JSON.parse(output)).toEqual({ revision: saved.revision, count: saved.observations.length });
    const diary = saved.observations.find(o => o.kind === "diary");
    expect(diary?.value).toMatchObject({ ratings: { elevated: "unknown", irritable: "skipped" } });
    expect(saved.observations[0].value).toHaveProperty("startRaw");
  });
  it("encrypts values, identifiers and timestamps; uses fixed size and fresh ciphertext", () => {
    const saved = seed(), first = fs.readFileSync(store().file);
    expect(first.length).toBe(archiveBytes);
    for (const marker of [saved.revision, saved.importedAt, "Synthetic Watch", "fixture-diary", "2026-02", "Invented context"]) {
      expect(first.includes(Buffer.from(marker))).toBe(false);
    }
    expect(encryptArchive(saved, key)).not.toEqual(first);
    expect(fs.statSync(store().file).mode & 0o777).toBe(0o600);
    const cleared = store().mutate({ action: "delete-all", expectedRevision: saved.revision });
    expect(store().read()?.observations).toEqual([]);
    expect(fs.statSync(store().file).size).toBe(first.length);
    expect(cleared.revision).not.toBe(saved.revision);
    expect(fs.readdirSync(directory)).toEqual(["archive.enc"]);
  });
  it("rejects wrong key, tampering, truncated/oversized data without overwriting it", () => {
    seed(); const bytes = fs.readFileSync(store().file);
    expect(() => decryptArchive(bytes, randomBytes(32))).toThrow("ARCHIVE_UNREADABLE");
    for (const position of [0, 12, 43, 56, 90]) {
      const tampered = Buffer.from(bytes); tampered[position] ^= 1;
      expect(() => decryptArchive(tampered, key)).toThrow("ARCHIVE_UNREADABLE");
    }
    fs.writeFileSync(store().file, Buffer.concat([bytes, Buffer.alloc(1)]));
    const bad = fs.readFileSync(store().file);
    expect(() => store().mutate({ action: "seed", expectedRevision: null })).toThrow();
    expect(fs.readFileSync(store().file)).toEqual(bad);
  });
  it("rejects personal values even if tagged synthetic and rejects arbitrary command fields", () => {
    const saved = seed(); saved.observations[0].value = { ...saved.observations[0].value, source: "PERSONAL_CANARY" } as typeof saved.observations[0]["value"];
    expect(() => validateSyntheticArchive(saved)).toThrow();
    expect(() => rehearsalCommand.parse({ action: "seed", expectedRevision: null, diary: "PERSONAL_CANARY" })).toThrow();
  });
  it("deletes selected observations/batches durably without retaining report derivatives", () => {
    const saved = seed();
    const one = store().mutate({ action: "delete-observation", id: "fixture-diary-1", expectedRevision: saved.revision });
    expect(store().read()?.observations.some(o => o.id === "fixture-diary-1")).toBe(false);
    expect(one.observations.some(o => o.id === "fixture-diary-2")).toBe(true);
    store().mutate({ action: "delete-sleep-batch", expectedRevision: one.revision });
    expect(store().read()?.observations.map(o => o.id)).toEqual(["fixture-diary-2"]);
    expect(Object.keys(store().read()!)).not.toContain("report");
  });
  it("rejects stale retries, concurrent locks and accidental replacement of a populated archive", () => {
    const saved = seed();
    expect(() => store().mutate({ action: "seed", expectedRevision: saved.revision })).toThrow("ARCHIVE_NOT_EMPTY");
    expect(() => store().mutate({ action: "delete-all", expectedRevision: null })).toThrow("changed");
    fs.writeFileSync(`${store().file}.lock`, "", { mode: 0o600 });
    expect(() => store().mutate({ action: "delete-all", expectedRevision: saved.revision })).toThrow("busy");
    expect(store().read()?.revision).toBe(saved.revision);
    expect(fs.existsSync(`${store().file}.lock`)).toBe(true);
  });
  it("denies access before reads and rechecks authority before commit", () => {
    const saved = seed(), original = fs.readFileSync(store().file);
    expect(() => store(() => { throw new Error("expired"); }).read()).toThrow("expired");
    let checks = 0;
    expect(() => store(() => { if (++checks === 5) throw new Error("expired"); }).mutate({ action: "delete-all", expectedRevision: saved.revision })).toThrow("expired");
    expect(fs.readFileSync(store().file)).toEqual(original);
    expect(fs.readdirSync(directory)).toEqual(["archive.enc"]);
  });
  it("cleans interrupted precommit writes and reports post-rename uncertainty honestly", () => {
    const saved = seed(), original = fs.readFileSync(store().file);
    const sync = vi.mocked(fs.fsyncSync).mockImplementationOnce(() => { throw new Error("disk fault"); });
    expect(() => store().mutate({ action: "delete-all", expectedRevision: saved.revision })).toThrow("disk fault");
    expect(fs.readFileSync(store().file)).toEqual(original);
    expect(fs.readdirSync(directory)).toEqual(["archive.enc"]);
    sync.mockReset();
    sync.mockImplementationOnce(() => {}).mockImplementationOnce(() => { throw new Error("directory sync fault"); });
    expect(() => store().mutate({ action: "delete-all", expectedRevision: saved.revision })).toThrow(ArchiveCommitUncertainError);
    expect(store().read()?.observations).toEqual([]);
  });
  it("rejects symlink/hardlink files and unsafe archive directories", () => {
    seed(); const outside = join(directory, "other");
    fs.renameSync(store().file, outside); fs.symlinkSync(outside, store().file);
    expect(() => store().read()).toThrow(); fs.unlinkSync(store().file);
    fs.linkSync(outside, store().file); expect(() => store().read()).toThrow();
    fs.chmodSync(directory, 0o755); expect(() => store().read()).toThrow("ARCHIVE_DIRECTORY_UNSAFE");
  });
});
