import {NextRequest,NextResponse} from 'next/server';
import {isLocalSameOrigin} from '@/lib/http/local-origin';
import {boundedText} from '@/lib/http/context-request';
import {VAULT_SESSION_COOKIE,vaultSessionFailure} from '@/lib/vault/vault-session';
import {withBrowserVault} from '@/lib/vault/vault-route-access';
import {nativeTransaction} from '@/lib/native/native-transaction';
import {configureReceiver,receiverStatus,receiverSessionActive,receiverPreview} from '@/lib/native/native-receiver';
import {receiverErrorCode} from '@/lib/native/receiver-errors';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:NextRequest){
 if(!isLocalSameOrigin(request))return json({code:'LOCAL_ORIGIN_REQUIRED'},403);
 const id=request.cookies.get(VAULT_SESSION_COOKIE)?.value;
 if(!receiverSessionActive(id))return json({code:'VAULT_LOCKED'},401);
 try{
  const body=JSON.parse(await boundedText(request,2048));
  if(body.action==='preview')return json(receiverPreview(id!,body.enabled===true));
  if(body.action==='status')return json(receiverStatus());
  if(!['create','resume','stop','revoke','pairing','follow'].includes(body.action))return json({code:'INVALID_REQUEST'},422);
  return await nativeTransaction(async()=>{
   return withBrowserVault(id,async vault=>json(await configureReceiver(vault,id!,body.action,typeof body.host==='string'?body.host:undefined,['simulated','healthkit'].includes(body.mode)?body.mode:undefined)));
  });
 }catch(error){return vaultSessionFailure(error)??json({code:receiverErrorCode(error)},422);}
}
