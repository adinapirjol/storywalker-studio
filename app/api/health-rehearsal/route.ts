import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { isLocalRead, isLocalSameOrigin } from "@/lib/http/local-origin";
import { boundedText } from "@/lib/http/context-request";
import { VAULT_SESSION_COOKIE, vaultSessionActive, vaultSessionFailure } from "@/lib/vault/vault-session";
import { VaultWriteBusyError, VaultWriteConflictError } from "@/lib/vault/vault-file-lock";
import { rehearsalCommand, recoveryCommand } from "@/lib/health/synthetic-archive";
import { withSyntheticArchive } from "@/lib/health/server/archive-session";
import { ArchiveCommitUncertainError } from "@/lib/health/server/encrypted-archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
function failure(error: unknown) {
  const session = vaultSessionFailure(error);
  if (session) return session;
  if (error instanceof VaultWriteBusyError || error instanceof VaultWriteConflictError) return json({ code: "ARCHIVE_CONFLICT_RELOAD" }, 409);
  if (error instanceof ArchiveCommitUncertainError) return json({ code: "ARCHIVE_COMMIT_UNCERTAIN_RELOAD" }, 503);
  // No source values, filesystem paths, parser exceptions or key information in responses/logs.
  return json({ code: "ARCHIVE_UNAVAILABLE_RELOAD" }, 422);
}
export async function GET(request: NextRequest) {
  if (!isLocalRead(request)) return json({ code: "LOCAL_ORIGIN_REQUIRED" }, 403);
  const token = request.cookies.get(VAULT_SESSION_COOKIE)?.value;
  if (!vaultSessionActive(token)) return json({ code: "VAULT_LOCKED" }, 401);
  try { return withSyntheticArchive(token, request.signal, store => json(request.nextUrl.searchParams.get("recovery") === "1" ? { recovery: store.status() } : { archive: store.read() })); }
  catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  if (!isLocalSameOrigin(request)) return json({ code: "LOCAL_ORIGIN_REQUIRED" }, 403);
  const token = request.cookies.get(VAULT_SESSION_COOKIE)?.value;
  if (!vaultSessionActive(token)) return json({ code: "VAULT_LOCKED" }, 401);
  let raw: string;
  try { raw = await boundedText(request, 1024); }
  catch { return json({ code: "INVALID_REHEARSAL_COMMAND" }, 413); }
  let command;
  try { command = z.union([rehearsalCommand, recoveryCommand]).parse(JSON.parse(raw)); }
  catch { return json({ code: "INVALID_REHEARSAL_COMMAND" }, 422); }
  try { return withSyntheticArchive(token, request.signal, store => {
    if ("expectedCurrentToken" in command) {
      const preview = store.recover(command);
      return json({ recovery: store.status(), preview });
    }
    store.mutate(command);
    return json({ archive: store.read() });
  }); }
  catch (error) { return failure(error); }
}
