import { cycleContextSchema } from "@/lib/health/cycle-context";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isLocalRead, isLocalSameOrigin } from "@/lib/http/local-origin";
import { boundedText } from "@/lib/http/context-request";
import { VAULT_SESSION_COOKIE, vaultSessionActive, vaultSessionFailure } from "@/lib/vault/vault-session";
import { withBrowserVault } from "@/lib/vault/vault-route-access";
import { nativeTransaction } from "@/lib/native/native-transaction";
import { configureResearch, researchView } from "@/lib/health/server/research-journal";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
const command = z.union([
  z.object({ action: z.enum(["connect", "disconnect", "refresh", "example", "delete-notes"]), source: z.string().max(220).optional() }).strict(),
  z.object({ action: z.literal("set-hypothesis"), hypothesis: z.string().max(1200) }).strict(),
  z.object({ action: z.literal("set-cycle-context"), cycleContext: cycleContextSchema.nullable() }).strict(),
]);
export async function GET(request: NextRequest) {
  if (!isLocalRead(request)) return json({ code: "LOCAL_ORIGIN_REQUIRED" }, 403);
  const token = request.cookies.get(VAULT_SESSION_COOKIE)?.value;
  if (!vaultSessionActive(token)) return json({ code: "VAULT_LOCKED" }, 401);
  try { return await withBrowserVault(token, vault => { request.signal.throwIfAborted(); return json(researchView(vault)); }); }
  catch (error) { return vaultSessionFailure(error) ?? json({ code: "RESEARCH_UNAVAILABLE" }, 422); }
}
export async function POST(request: NextRequest) {
  if (!isLocalSameOrigin(request)) return json({ code: "LOCAL_ORIGIN_REQUIRED" }, 403);
  const token = request.cookies.get(VAULT_SESSION_COOKIE)?.value;
  if (!vaultSessionActive(token)) return json({ code: "VAULT_LOCKED" }, 401);
  let body;
  try { body = command.parse(JSON.parse(await boundedText(request, 8192))); }
  catch { return json({ code: "INVALID_RESEARCH_COMMAND" }, 422); }
  const selected = body;
  return nativeTransaction(async () => {
    try { return await withBrowserVault(token, vault => { request.signal.throwIfAborted(); return json(selected.action === "set-cycle-context" ? configureResearch(vault, selected.action, undefined, undefined, selected.cycleContext) : selected.action === "set-hypothesis" ? configureResearch(vault, selected.action, undefined, selected.hypothesis) : configureResearch(vault, selected.action, selected.source)); }); }
    catch (error) { return vaultSessionFailure(error) ?? json({ code: "RESEARCH_ACTION_UNCERTAIN_RELOAD" }, 422); }
  });
}
