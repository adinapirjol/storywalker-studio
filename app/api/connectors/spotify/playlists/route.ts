import {cookies} from 'next/headers';
import {isLocalSameOrigin} from '@/lib/local-origin';
import {assertVaultSessionActive,vaultSessionActive,vaultSessionFailure,VAULT_SESSION_COOKIE} from '@/lib/vault-session';
import {boundedText} from "@/lib/context-request";
import { z } from "zod";
import { readSpotifyPlaylistPresentations, spotifyEnvironmentSchema } from "@/lib/spotify-server";

export const runtime = "nodejs";

const inputSchema = z.object({
  playlistIds: z.array(z.string().regex(/^[A-Za-z0-9]{10,64}$/u)).min(1).max(4),
});

/**
 * A deliberate, read-only visual lookup for playlists the Author pasted into
 * the selector. Nothing from this response is written to the Vault.
 */
export async function POST(request: Request) {
  if(!isLocalSameOrigin(request))return Response.json({code:"LOCAL_ORIGIN_REQUIRED"},{status:403});
  const token = (await cookies()).get(VAULT_SESSION_COOKIE)?.value;
  if(!vaultSessionActive(token))return Response.json({code:"VAULT_LOCKED"},{status:401,headers:{"Cache-Control":"no-store"}});
  try {
    const input = inputSchema.parse(JSON.parse(await boundedText(request,4096)));
    assertVaultSessionActive(token);
    const environment = spotifyEnvironmentSchema.parse(process.env);
    const presentations = await readSpotifyPlaylistPresentations(environment, input.playlistIds);
    assertVaultSessionActive(token);
    return Response.json(
      presentations,
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return vaultSessionFailure(error) ?? Response.json(
      { error: "Spotify playlist previews could not be read." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
