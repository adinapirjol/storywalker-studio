import { closeSync, fstatSync, lstatSync, openSync, unlinkSync } from "node:fs";

export class VaultWriteBusyError extends Error {
  constructor() { super("Vault write is busy. Retry after the other writer finishes; nothing was overwritten."); }
}
export class VaultWriteConflictError extends Error {
  constructor() { super("Vault changed during this action. Reload before retrying; nothing was overwritten."); }
}

/** Local filesystem exclusion shared by route bundles and CLI processes.
 * Never steal an existing lock: even a crashed writer requires explicit recovery.
 * The caller must keep the entire compare-and-replace operation synchronous.
 */
export function withVaultFileLock<T>(storagePath: string, operation: () => T): T {
  const lockPath = `${storagePath}.lock`;
  let handle: number;
  try { handle = openSync(lockPath, "wx", 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new VaultWriteBusyError();
    throw error;
  }
  const owned = fstatSync(handle);
  try { return operation(); }
  finally {
    closeSync(handle);
    // Do not remove a replacement lock belonging to another writer.
    const current = lstatSync(lockPath, { throwIfNoEntry: false });
    if (current?.dev === owned.dev && current.ino === owned.ino) unlinkSync(lockPath);
  }
}
