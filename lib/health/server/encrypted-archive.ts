import { randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { withVaultFileLock, VaultWriteConflictError } from "@/lib/vault/vault-file-lock";
import { decryptArchive, encryptArchive } from "./archive-crypto";
import { syntheticObservations } from "./synthetic-observations";
import { rehearsalCommand, recoveryCommand, type RecoveryCommand, type RehearsalCommand, type SyntheticArchive } from "../synthetic-archive";

import { ArchiveCommitUncertainError, ciphertextToken, readArchiveFile, replaceArchiveFile, syncArchiveDirectory } from "./archive-files";
export { ArchiveCommitUncertainError } from "./archive-files";

/** Parent must be a trusted local directory. Reject links and group/world writers. */
export function ensureArchiveDirectory(directory: string, privateMode = true) {
  try { mkdirSync(directory, { mode: 0o700 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid?.() ||
    (stat.mode & (privateMode ? 0o077 : 0o022))) throw new Error("ARCHIVE_DIRECTORY_UNSAFE");
}

/** One bounded encrypted snapshot; no generic Vault record or derived index writes. */
export class EncryptedSyntheticArchive {
  readonly file: string;
  constructor(private directory: string, private key: Buffer, private authorize: () => void) {
    this.file = join(directory, "archive.enc");
  }
  private readCurrent(): SyntheticArchive | null {
    this.authorize();
    const bytes = readArchiveFile(this.file);
    const result = bytes === null ? null : decryptArchive(bytes, this.key);
    this.authorize();
    return result;
  }
  read(): SyntheticArchive | null {
    this.authorize();
    ensureArchiveDirectory(this.directory);
    return this.readCurrent();
  }
  mutate(input: RehearsalCommand): SyntheticArchive {
    this.authorize();
    const command = rehearsalCommand.parse(input);
    ensureArchiveDirectory(this.directory);
    return withVaultFileLock(this.file, () => {
      const current = this.readCurrent();
      if ((current?.revision ?? null) !== command.expectedRevision) throw new VaultWriteConflictError();
      const next = this.apply(current, command);
      const encrypted = encryptArchive(next, this.key);
      this.authorize();
      replaceArchiveFile(this.file, encrypted, this.authorize);
      this.authorize();
      return next;
    });
  }
  private apply(current: SyntheticArchive | null, command: RehearsalCommand): SyntheticArchive {
    const now = new Date().toISOString();
    let observations = current?.observations ?? [];
    if (command.action === "seed") {
      if (observations.length) throw new Error("ARCHIVE_NOT_EMPTY");
      observations = syntheticObservations(now);
    } else if (command.action === "delete-all") observations = [];
    else if (command.action === "delete-sleep-batch") observations = observations.filter(o => o.kind !== "sleep");
    else {
      if (!observations.some(o => o.id === command.id)) throw new Error("OBSERVATION_NOT_FOUND");
      observations = observations.filter(o => o.id !== command.id);
    }
    return {
      format: 1, mode: "synthetic", revision: randomUUID(),
      importedAt: command.action === "seed" ? now : current?.importedAt ?? now,
      observations,
    };
  }
  /** One explicit recovery snapshot. This is not automatic backup of later edits. */
  get backupFile() { return join(this.directory, "recovery.enc"); }
  status() {
    this.authorize(); ensureArchiveDirectory(this.directory);
    const result = {
      currentToken: ciphertextToken(readArchiveFile(this.file)),
      backupToken: ciphertextToken(readArchiveFile(this.backupFile)),
    };
    this.authorize();
    return result;
  }
  recover(input: RecoveryCommand) {
    this.authorize();
    const command = recoveryCommand.parse(input);
    ensureArchiveDirectory(this.directory);
    return withVaultFileLock(this.file, () => {
      const status = this.status();
      if (command.expectedCurrentToken !== status.currentToken || command.expectedBackupToken !== status.backupToken) {
        throw new VaultWriteConflictError();
      }
      if (command.action === "delete-backup") {
        if (status.backupToken === null) throw new Error("BACKUP_MISSING");
        this.authorize(); unlinkSync(this.backupFile);
        try { syncArchiveDirectory(this.directory); }
        catch { throw new ArchiveCommitUncertainError(); }
        this.authorize();
        return null;
      }
      const recoveryKey = Buffer.from(command.recoveryCode, "hex");
      try {
        if (command.action === "create-backup") {
          // Replacing an existing backup is deliberately a separate delete + create.
          if (status.backupToken !== null) throw new Error("BACKUP_EXISTS");
          const current = this.readCurrent();
          if (!current) throw new Error("ARCHIVE_MISSING");
          replaceArchiveFile(this.backupFile, encryptArchive(current, recoveryKey, "recovery"), this.authorize);
          this.authorize();
          // Verify the committed recovery copy using its independent key.
          const verified = decryptArchive(readArchiveFile(this.backupFile)!, recoveryKey, "recovery");
          return { observations: verified.observations.length, revision: verified.revision };
        }
        const bytes = readArchiveFile(this.backupFile);
        if (!bytes) throw new Error("BACKUP_MISSING");
        const recovered = decryptArchive(bytes, recoveryKey, "recovery");
        this.authorize();
        if (command.action === "preview-restore") {
          return { observations: recovered.observations.length, revision: recovered.revision };
        }
        // Re-encrypt under the active Vault key. A new revision prevents stale
        // pre-restoration mutations, including restoration of an identical snapshot.
        const next = { ...recovered, revision: randomUUID() };
        replaceArchiveFile(this.file, encryptArchive(next, this.key), this.authorize);
        this.authorize();
        return { observations: this.readCurrent()!.observations.length, revision: next.revision };
      } finally { recoveryKey.fill(0); }
    });
  }
  /** Offline synthetic migration primitive; never accepts raw Vault keys via HTTP. */
  migrateKey(previousKey: Buffer, expectedCurrentToken: string): SyntheticArchive {
    this.authorize(); ensureArchiveDirectory(this.directory);
    return withVaultFileLock(this.file, () => {
      const bytes = readArchiveFile(this.file);
      if (ciphertextToken(bytes) !== expectedCurrentToken || !bytes) throw new VaultWriteConflictError();
      const current = decryptArchive(bytes, previousKey);
      const next = { ...current, revision: randomUUID() };
      replaceArchiveFile(this.file, encryptArchive(next, this.key), this.authorize);
      this.authorize();
      return this.readCurrent()!;
    });
  }
}
