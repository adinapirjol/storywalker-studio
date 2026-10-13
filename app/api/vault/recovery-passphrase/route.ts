import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { boundedText } from "@/lib/http/context-request";
import { isLocalSameOrigin } from "@/lib/http/local-origin";
import { changeVaultRecoveryPassphrase, setVaultAccessGuard } from "@/lib/vault/private-vault";
import { VaultRecoveryError } from "@/lib/vault/vault-recovery";
import { withBrowserVault } from "@/lib/vault/vault-route-access";
import { assertVaultSessionActive, deleteAllVaultSessions, vaultSessionActive, vaultSessionFailure, VAULT_SESSION_COOKIE } from "@/lib/vault/vault-session";
import { VaultWriteBusyError, VaultWriteConflictError } from "@/lib/vault/vault-file-lock";

export const runtime = "nodejs";
const passphrase = z.string().min(12).max(512);
const inputSchema = z.object({ currentPassphrase: passphrase, newPassphrase: passphrase, confirmation: passphrase }).strict()
  .refine(value => value.newPassphrase === value.confirmation)
  .refine(value => value.newPassphrase !== value.currentPassphrase);
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (!isLocalSameOrigin(request)) return reply({ error: "Use the local Storywalker origin." }, 403);
  const token = (await cookies()).get(VAULT_SESSION_COOKIE)?.value;
  if (!vaultSessionActive(token)) return reply({ error: "Unlock the Vault before changing its recovery passphrase." }, 401);
  try {
    const parsed = inputSchema.safeParse(JSON.parse(await boundedText(request, 16_384)));
    if (!parsed.success) return reply({ error: "Enter the current passphrase and a different new passphrase (12–512 characters), with matching confirmation." }, 400);
    const { currentPassphrase, newPassphrase } = parsed.data;
    let committed = false;
    try {
      await withBrowserVault(token, vault => {
        const guard = () => { request.signal.throwIfAborted(); assertVaultSessionActive(token); };
        guard();
        setVaultAccessGuard(vault, guard);
        changeVaultRecoveryPassphrase(vault, currentPassphrase, newPassphrase, () => { committed = true; });
      });
    } catch (error) {
      // Once replacement succeeded, cleanup or expiry cannot undo the change.
      if (!committed) throw error;
    } finally {
      // Even an expiry detected after replacement must revoke the other sessions.
      if (committed) deleteAllVaultSessions();
    }
    const response = reply({ changed: true, session: { active: false } });
    response.cookies.set(VAULT_SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    const expiry = vaultSessionFailure(error);
    if (expiry) return expiry;
    if (error instanceof VaultWriteBusyError || error instanceof VaultWriteConflictError) return reply({ error: error.message }, 409);
    if (error instanceof VaultRecoveryError) return reply({ error: error.message }, 400);
    return reply({ error: "The recovery passphrase could not be changed. Your previous passphrase still applies." }, 400);
  }
}
