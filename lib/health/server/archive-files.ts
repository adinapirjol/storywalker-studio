import { createHash, randomUUID } from "node:crypto";
import { closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, readSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { archiveBytes } from "./archive-crypto";

export class ArchiveCommitUncertainError extends Error {
  constructor() { super("ARCHIVE_COMMIT_UNCERTAIN_RELOAD"); }
}

/** Bounded ciphertext read; never follows links. Authentication belongs to the caller. */
export function readArchiveFile(file: string): Buffer | null {
  let fd: number;
  try { fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error("ARCHIVE_UNREADABLE", { cause: error });
  }
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > archiveBytes ||
      stat.uid !== process.getuid?.() || (stat.mode & 0o077)) throw new Error("ARCHIVE_UNREADABLE");
    const bytes = Buffer.alloc(archiveBytes + 1);
    let length = 0;
    while (length < bytes.length) {
      const read = readSync(fd, bytes, length, bytes.length - length, length);
      if (!read) break;
      length += read;
    }
    if (length > archiveBytes) throw new Error("ARCHIVE_UNREADABLE");
    return bytes.subarray(0, length);
  } finally { closeSync(fd); }
}

/** A version of ciphertext, not a fingerprint of private plaintext. */
export const ciphertextToken = (bytes: Buffer | null) => bytes === null ? null : createHash("sha256").update(bytes).digest("hex");

export function syncArchiveDirectory(directory: string) {
  const fd = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

export function replaceArchiveFile(file: string, encrypted: Buffer, authorize: () => void) {
  const directory = dirname(file), temporary = join(directory, `.pending-${randomUUID()}`);
  let renamed = false, created = false;
  try {
    const fd = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    created = true;
    try { writeFileSync(fd, encrypted); fsyncSync(fd); } finally { closeSync(fd); }
    authorize();
    const target = lstatSync(file, { throwIfNoEntry: false });
    if (target && (!target.isFile() || target.isSymbolicLink() || target.nlink !== 1)) throw new Error("ARCHIVE_UNREADABLE");
    renameSync(temporary, file); renamed = true;
    syncArchiveDirectory(directory);
  } catch (error) {
    if (renamed) throw new ArchiveCommitUncertainError();
    throw error;
  } finally {
    if (created && !renamed) rmSync(temporary, { force: true });
  }
}
