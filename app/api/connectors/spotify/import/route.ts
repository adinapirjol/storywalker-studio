import {isLocalSameOrigin} from '@/lib/local-origin';
import {boundedText} from '@/lib/context-request';
import { z } from "zod";
import { cookies } from "next/headers";
import { closeVault, openVault, openVaultWithKey, putVaultRecords, refreshVaultDerivedViews, setVaultAccessGuard, vaultSummary, type VaultRecord } from "@/lib/private-vault";
import { importSpotifyPlaylists, spotifyEnvironmentSchema } from "@/lib/spotify-server";
import { assertVaultSessionActive, readVaultSession, VAULT_SESSION_COOKIE, vaultSessionFailure } from "@/lib/vault-session";
import { VaultWriteBusyError, VaultWriteConflictError } from "@/lib/vault-file-lock";

export const runtime = "nodejs";

const requestSchema = z.object({ passphrase: z.string().min(12).max(512).optional(), playlistIds: z.array(z.string().regex(/^[A-Za-z0-9]{10,64}$/u)).min(1).max(4), consent: z.literal(true) });

export async function POST(request: Request) {
  if(!isLocalSameOrigin(request))return Response.json({code:"LOCAL_ORIGIN_REQUIRED"},{status:403});
  try {
    const body = requestSchema.parse(JSON.parse(await boundedText(request,4096)));
    const token = body.passphrase ? undefined : (await cookies()).get(VAULT_SESSION_COOKIE)?.value;
    const session = body.passphrase ? undefined : readVaultSession(token);
    if (!body.passphrase && !session) return Response.json({ code: "VAULT_LOCKED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    const vault = body.passphrase ? await openVault(body.passphrase) : session ? await openVaultWithKey(session.key).finally(()=>session.key.fill(0)) : (() => { throw new Error("Unlock the Vault from /vault first. This local browser session expires exactly 15 minutes after unlock."); })();
    try {
      const assertAccess = () => { if (!body.passphrase) assertVaultSessionActive(token); };
      assertAccess();
      setVaultAccessGuard(vault, assertAccess);
      const snapshots = await importSpotifyPlaylists(spotifyEnvironmentSchema.parse(process.env), [...new Set(body.playlistIds)]);
      assertAccess();
      const capturedAt = new Date().toISOString();
      const records: VaultRecord[] = snapshots.map((snapshot) => ({ id: `import:spotify-playlist:${snapshot.playlist.id}`, kind: "import", capturedAt, payload: { schemaVersion: 1, privacy: "private", canonical: false, consent: "spotify-oauth-read-only", source: "spotify-playlist", importedAt: capturedAt, snapshot } }));
      putVaultRecords(vault, records);
      return Response.json({ imported: records.map((record) => record.id), derived: refreshVaultDerivedViews(vault), summary: vaultSummary(vault) }, { headers: { "Cache-Control": "no-store" } });
    } finally { closeVault(vault); }
  } catch (error) { return vaultSessionFailure(error) ?? Response.json({ error: error instanceof VaultWriteBusyError || error instanceof VaultWriteConflictError ? error.message : "Spotify import could not run. Reload your Vault before retrying." }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
}
