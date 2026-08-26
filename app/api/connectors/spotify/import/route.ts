import { z } from "zod";
import { cookies } from "next/headers";
import { closeVault, openVault, openVaultWithKey, putVaultRecords, refreshVaultDerivedViews, vaultSummary, type VaultRecord } from "@/lib/private-vault";
import { importSpotifyPlaylists, spotifyEnvironmentSchema } from "@/lib/spotify-server";
import { readVaultSession, VAULT_SESSION_COOKIE } from "@/lib/vault-session";

export const runtime = "nodejs";

const requestSchema = z.object({ passphrase: z.string().min(12).max(512).optional(), playlistIds: z.array(z.string().regex(/^[A-Za-z0-9]{10,64}$/u)).min(1).max(4), consent: z.literal(true) });

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const snapshots = await importSpotifyPlaylists(spotifyEnvironmentSchema.parse(process.env), [...new Set(body.playlistIds)]);
    const session = readVaultSession((await cookies()).get(VAULT_SESSION_COOKIE)?.value);
    const vault = body.passphrase ? await openVault(body.passphrase) : session ? await openVaultWithKey(session.key) : (() => { throw new Error("Unlock the Vault from /vault first. This local browser session expires exactly 15 minutes after unlock."); })();
    try {
      const capturedAt = new Date().toISOString();
      const records: VaultRecord[] = snapshots.map((snapshot) => ({ id: `import:spotify-playlist:${snapshot.playlist.id}`, kind: "import", capturedAt, payload: { schemaVersion: 1, privacy: "private", canonical: false, consent: "spotify-oauth-read-only", source: "spotify-playlist", importedAt: capturedAt, snapshot } }));
      putVaultRecords(vault, records);
      return Response.json({ imported: records.map((record) => record.id), derived: refreshVaultDerivedViews(vault), summary: vaultSummary(vault) }, { headers: { "Cache-Control": "no-store" } });
    } finally { closeVault(vault); }
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Spotify import could not run." }, { status: 400 }); }
}
