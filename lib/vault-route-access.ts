import { openVaultWithKey, closeVault, setVaultAccessGuard, type OpenVault } from "./private-vault";
import { readVaultSession, assertVaultSessionActive } from "./vault-session";

/** Recheck authority after opening, before persistence and before returning. */
export async function withBrowserVault<T>(
  token: string | undefined,
  work: (vault: OpenVault) => T | Promise<T>,
): Promise<T> {
  const check = () => assertVaultSessionActive(token);
  check();
  const session = readVaultSession(token);
  if (!session) { check(); throw new Error("VAULT_LOCKED"); }
  const vault = await openVaultWithKey(session.key).finally(() => session.key.fill(0));
  try {
    check();
    setVaultAccessGuard(vault, check);
    const result = await work(vault);
    check();
    return result;
  } finally { closeVault(vault); }
}
