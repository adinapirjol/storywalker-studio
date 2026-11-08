import { NextRequest, NextResponse } from "next/server";
import { isLocalRead, isLocalSameOrigin } from "@/lib/http/local-origin";
import { boundedText } from "@/lib/http/context-request";
import { VAULT_SESSION_COOKIE, vaultSessionActive, vaultSessionFailure } from "@/lib/vault/vault-session";
import { withBrowserVault } from "@/lib/vault/vault-route-access";
import { VaultWriteBusyError, VaultWriteConflictError } from "@/lib/vault/vault-file-lock";
import { commandSchema } from "@/lib/nova/contracts";
import { LoopConflict, LoopInputError } from "@/lib/nova/engine";
import { executeLoop, loopView } from "@/lib/nova/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
function failure(error: unknown) {
  return vaultSessionFailure(error) ?? (error instanceof LoopConflict || error instanceof VaultWriteConflictError || error instanceof VaultWriteBusyError
    ? json({ error: "Review changed or Vault busy. Reload before explicitly trying again." }, 409)
    : error instanceof LoopInputError ? json({ error: error.message }, 422)
    : json({ error: "Nova request could not be confirmed. Reload to inspect saved state; no automatic retry was made." }, 422));
}
export async function GET(request: NextRequest) {
  if (!isLocalRead(request)) return json({ error: "Local origin required." }, 403);
  const token = request.cookies.get(VAULT_SESSION_COOKIE)?.value;
  if (!vaultSessionActive(token)) return json({ code: "VAULT_LOCKED" }, 401);
  try { return await withBrowserVault(token, vault => { request.signal.throwIfAborted(); return json(loopView(vault)); }); }
  catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  if (!isLocalSameOrigin(request)) return json({ error: "Local same-origin action required." }, 403);
  const token = request.cookies.get(VAULT_SESSION_COOKIE)?.value;
  if (!vaultSessionActive(token)) return json({ code: "VAULT_LOCKED" }, 401);
  let command;
  try { command = commandSchema.parse(JSON.parse(await boundedText(request, 16384))); }
  catch { return json({ error: "Invalid or oversized Nova command." }, 422); }
  try { return await withBrowserVault(token, vault => { request.signal.throwIfAborted(); return json(executeLoop(vault, command)); }); }
  catch (error) { return failure(error); }
}
