import { randomBytes } from "node:crypto";

/**
 * A Vault session is deliberately process-local: the browser only receives an
 * opaque HttpOnly reference, while the encryption key remains in this local
 * Node process. Sessions are absolute (not sliding) and disappear on restart.
 */
export const VAULT_SESSION_COOKIE = "storywalker_vault_session";
export const VAULT_SESSION_MAX_AGE_SECONDS = 15 * 60;

type VaultSession = { key: Buffer; expiresAt: number };
// Route bundles and development reloads must share the same process-local store.
// Absolute expiry still applies, and restarting the process discards every key.
const sessionStore = globalThis as typeof globalThis & {
  __storywalkerVaultSessions?: Map<string, VaultSession>;
};
const sessions = sessionStore.__storywalkerVaultSessions ??= new Map<string, VaultSession>();

function prune(now = Date.now()) {
  for (const [token, session] of sessions) if (session.expiresAt <= now) { session.key.fill(0); sessions.delete(token); }
}

export function createVaultSession(key: Buffer) {
  prune();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + VAULT_SESSION_MAX_AGE_SECONDS * 1_000;
  sessions.set(token, { key: Buffer.from(key), expiresAt });
  return { token, expiresAt: new Date(expiresAt).toISOString() };
}

export function readVaultSession(token: string | undefined) {
  prune();
  if (!token) return undefined;
  const session = sessions.get(token);
  return session ? { key: Buffer.from(session.key), expiresAt: new Date(session.expiresAt).toISOString() } : undefined;
}

export function vaultSessionActive(token: string | undefined) { prune(); return !!token && sessions.has(token); }
export class VaultSessionExpiredError extends Error {
  constructor() { super("Your Vault session ended during this action. Unlock and retry explicitly."); }
}
export function assertVaultSessionActive(token: string | undefined) {
  if (!vaultSessionActive(token)) throw new VaultSessionExpiredError();
}
/** Distinct from VAULT_LOCKED: clients must not automatically replay an action
 * whose provider request may already have run before the session ended. */
export function vaultSessionFailure(error: unknown) {
  return error instanceof VaultSessionExpiredError
    ? Response.json({ code: "VAULT_SESSION_EXPIRED", error: error.message }, { status: 401, headers: { "Cache-Control": "no-store" } })
    : undefined;
}
export function deleteVaultSession(token: string | undefined) { if (token) { sessions.get(token)?.key.fill(0); sessions.delete(token); } }

/** Both access methods replace the caller's old authority after verification. */
export function rotateVaultSession(key: Buffer, previousToken: string | undefined) {
  const next = createVaultSession(key);
  deleteVaultSession(previousToken);
  return next;
}

export function vaultSessionCookie(token: string, expiresAt: string) {
  return {
    name: VAULT_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VAULT_SESSION_MAX_AGE_SECONDS,
    expires: new Date(expiresAt),
  };
}
