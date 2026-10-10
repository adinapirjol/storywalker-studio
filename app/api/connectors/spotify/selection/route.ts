import {cookies} from 'next/headers';
import {isLocalRead} from '@/lib/http/local-origin';
import {assertVaultSessionActive,vaultSessionActive,vaultSessionFailure,VAULT_SESSION_COOKIE} from '@/lib/vault/vault-session';
import { spotifyEnvironmentSchema, readSpotifySelection } from "@/lib/music/spotify-server";

export const runtime = "nodejs";

export async function GET(request:Request) {
  if(!isLocalRead(request))return Response.json({code:"LOCAL_ORIGIN_REQUIRED"},{status:403});
  const token = (await cookies()).get(VAULT_SESSION_COOKIE)?.value;
  if(!vaultSessionActive(token))return Response.json({code:"VAULT_LOCKED"},{status:401,headers:{"Cache-Control":"no-store"}});
  try {
    const environment = spotifyEnvironmentSchema.parse(process.env);
    const selection = await readSpotifySelection(environment);
    assertVaultSessionActive(token);
    return Response.json({ selection }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return vaultSessionFailure(error) ?? Response.json({ error: "Spotify selection could not be read." }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
}
