/** One prompt per tab. Pending work stays in memory and belongs to its caller. */
type UnlockPrompt = () => Promise<boolean>;

export function createUnlockGate() {
  let prompt: UnlockPrompt | undefined;
  let pending: Promise<boolean> | undefined;
  return {
    install(next: UnlockPrompt) {
      prompt = next;
      return () => { if (prompt === next) prompt = undefined; };
    },
    request() {
      if (pending) return pending;
      if (!prompt) return Promise.reject(new Error("Vault unlock is not ready. Try again."));
      pending = prompt().finally(() => { pending = undefined; });
      return pending;
    },
  };
}

const gate = createUnlockGate();
export const installVaultUnlock = gate.install;
export const requestVaultUnlock = gate.request;

const protectedRoutes = new Set([
  "/api/vault", "/api/private-review", "/api/vault-demo", "/api/arena-rehearsal",
  "/api/context-health", "/api/context-native", "/api/context-receiver", "/api/context-summary",
  "/api/connectors/spotify/selection", "/api/connectors/spotify/playlists", "/api/connectors/spotify/import",
]);
function canReplay(input: RequestInfo | URL, init?: RequestInit) {
  // Request/stream bodies may have been consumed by the first attempt. Never tee
  // an unbounded stream or try to replay it implicitly after an unlock.
  if (input instanceof Request || init?.body instanceof ReadableStream) return false;
  const raw = input.toString();
  if (raw.startsWith("/") && !raw.startsWith("//")) return protectedRoutes.has(new URL(raw, "http://vault.local").pathname);
  if (typeof window === "undefined") return false;
  const target = new URL(raw, window.location.origin);
  return target.origin === window.location.origin && protectedRoutes.has(target.pathname);
}
function checkCancellation(signal?: AbortSignal | null) {
  if (signal?.aborted) throw new DOMException("Request cancelled", "AbortError");
}

/** Retry once only when the server denied execution before work began. */
export async function fetchWithVaultUnlock(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  unlock: UnlockPrompt,
  send: typeof fetch = fetch,
) {
  const first = await send(input, init);
  if (first.status !== 401 || !canReplay(input, init)) return first;
  const data = await first.clone().json().catch(() => null);
  if (data?.code !== "VAULT_LOCKED") return first;
  checkCancellation(init?.signal);
  if (!await unlock()) throw new Error("Unlock cancelled. Your unsaved work is still here; nothing was saved.");
  checkCancellation(init?.signal);
  return send(input, init);
}

export function vaultFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetchWithVaultUnlock(input, init, requestVaultUnlock);
}

const returnPaths = new Set([
  "/", "/atlas", "/director", "/field-trace", "/voice", "/scenario-studio", "/private-review", "/research",
  "/research/xr", "/research/xr/body", "/research/xr/aurora-coast", "/research/arena-field", "/research/refusal",
  "/research/echo-lab", "/research/linz",
]);
export function safeVaultReturn(value: unknown) {
  return typeof value === "string" && returnPaths.has(value) ? value : undefined;
}
