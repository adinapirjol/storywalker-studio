import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { withVaultFileLock, VaultWriteBusyError } from "./vault-file-lock";

it("excludes a second OS process for the entire compare-and-replace operation", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "fictional-vault-lock-"));
  const file = path.join(directory, "snapshot");
  try {
    writeFileSync(file, "first");
    withVaultFileLock(file, () => {
      expect(statSync(`${file}.lock`).mode & 0o777).toBe(0o600);
      const script = `import { withVaultFileLock, VaultWriteBusyError } from ${JSON.stringify(pathToFileURL(path.resolve("lib/vault/vault-file-lock.ts")).href)};
        import { writeFileSync } from 'node:fs';
        try { withVaultFileLock(${JSON.stringify(file)}, () => writeFileSync(${JSON.stringify(file)}, 'lost-update')); process.exit(2); }
        catch (error) { process.exit(error instanceof VaultWriteBusyError ? 0 : 3); }`;
      const second = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", script], { timeout: 10_000 });
      expect(second.error).toBeUndefined();
      expect(second.status, second.stderr.toString()).toBe(0);
      expect(readFileSync(file, "utf8")).toBe("first");
      writeFileSync(file, "latest");
    });
    expect(existsSync(`${file}.lock`)).toBe(false);
    withVaultFileLock(file, () => expect(readFileSync(file, "utf8")).toBe("latest"));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it("releases its lock on failure and refuses existing locks or symlinks", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "fictional-vault-lock-"));
  const file = path.join(directory, "snapshot");
  try {
    expect(() => withVaultFileLock(file, () => { throw new Error("fixture failure"); })).toThrow("fixture failure");
    expect(existsSync(`${file}.lock`)).toBe(false);
    const target = path.join(directory, "preserved");
    writeFileSync(target, "preserved");
    symlinkSync(target, `${file}.lock`);
    expect(() => withVaultFileLock(file, () => writeFileSync(target, "unsafe"))).toThrow(VaultWriteBusyError);
    expect(readFileSync(target, "utf8")).toBe("preserved");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
