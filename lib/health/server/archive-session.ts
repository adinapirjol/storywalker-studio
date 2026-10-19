import { join, resolve } from "node:path";
import { assertVaultSessionActive, readVaultSession } from "@/lib/vault/vault-session";
import { EncryptedSyntheticArchive, ensureArchiveDirectory } from "./encrypted-archive";

/** Uses the shared session authority, without opening or mutating the personal Vault DB. */
export function withSyntheticArchive<T>(token: string | undefined, signal: AbortSignal, work: (store: EncryptedSyntheticArchive) => T): T {
  let closed = false;
  const check = () => {
    if (closed) throw new Error("ARCHIVE_SESSION_CLOSED");
    signal.throwIfAborted(); assertVaultSessionActive(token);
  };
  check();
  const session = readVaultSession(token);
  if (!session) { check(); throw new Error("VAULT_LOCKED"); }
  try {
    check();
    const parent = resolve(process.cwd(), "private-data");
    ensureArchiveDirectory(parent, false);
    const directory = join(parent, "health-study04-synthetic");
    const result = work(new EncryptedSyntheticArchive(directory, session.key, check));
    if (result && typeof result === "object" && "then" in result) throw new Error("SYNCHRONOUS_ARCHIVE_WORK_REQUIRED");
    check();
    return result;
  } finally { closed = true; session.key.fill(0); }
}
