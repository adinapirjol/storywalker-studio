import { randomBytes } from "node:crypto";

/**
 * A Vault session is deliberately process-local: the browser only receives an
 * opaque HttpOnly reference, while the encryption key remains in this local
 * Node process. Sessions are absolute (not sliding) and disappear on restart.
 */
export const VAULT_SESSION_COOKIE = "storywalker_vault_session";
export const VAULT_SESSION_MAX_AGE_SECONDS = 15 * 60;

type VaultSession = { key: Buffer; expiresAt: number };
const sessions = new Map<string, VaultSession>();

function prune(now = Date.now()) {
  for (const [token, session] of sessions) if (session.expiresAt <= now) sessions.delete(token);
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

export function deleteVaultSession(token: string | undefined) { if (token) sessions.delete(token); }

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
