/** Authentication requests intentionally bypass automatic unlock/replay. */
export type BrowserVaultSession = { active: boolean; expiresAt?: string };

export async function vaultAuthRequest<T>(
  endpoint: "/api/vault" | "/api/vault/passkeys" | "/api/vault/recovery-passphrase",
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    credentials: "same-origin",
    body: JSON.stringify(body),
    signal,
  });
  const result = await response.json();
  signal?.throwIfAborted();
  if (!response.ok) throw new Error(result.error ?? "The Vault request could not complete.");
  return result as T;
}

export async function browserVaultSession(signal?: AbortSignal) {
  const result = await vaultAuthRequest<{ session: BrowserVaultSession }>(
    "/api/vault", { action: "session-status" }, signal,
  );
  return result.session;
}
