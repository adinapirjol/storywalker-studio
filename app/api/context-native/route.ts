import {NextRequest,NextResponse} from 'next/server';
import {isLocalSameOrigin} from '@/lib/local-origin';
import {boundedText} from '@/lib/context-request';
import {readVaultSession,VAULT_SESSION_COOKIE,vaultSessionFailure} from '@/lib/vault-session';
import {withBrowserVault} from '@/lib/vault-route-access';
import {decodeTransfer,validateNativePacket,privateBodyEvidence,evaluatePrivateBody,stageNativeTransfer,listNativeTransfers,previewNativeTransfer,decideNativeTransfer,nativeReceipt} from '@/lib/native-transfer';
import {exportReceivedSummary} from '@/lib/health-summary';
import {nativeTransaction} from '@/lib/native-transaction';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:NextRequest){
 if(!isLocalSameOrigin(request))return json({code:'LOCAL_ORIGIN_REQUIRED'},403);
 const sessionID=request.cookies.get(VAULT_SESSION_COOKIE)?.value;
 const active=readVaultSession(sessionID);active?.key.fill(0);if(!active)return json({code:'VAULT_LOCKED'},401);
 let body:Record<string,unknown>;
 try{body=JSON.parse(await boundedText(request,1_500_000));if(!body||Array.isArray(body))throw Error();}catch{return json({code:'INVALID_REQUEST'},422);}
 return nativeTransaction(async()=>{
  try{
   let decoded:ReturnType<typeof decodeTransfer>|undefined;
   let batch:Awaited<ReturnType<typeof validateNativePacket>>|undefined;
   try{
    if(body.action==='stage'){
     if(typeof body.envelope!=='string'||typeof body.key!=='string'||! /^[A-Za-z0-9+/]+={0,2}$/.test(body.envelope))return json({code:'TRANSFER_INVALID'},422);
     try{decoded=decodeTransfer(Buffer.from(body.envelope,'base64'),body.key);}catch{return json({code:'TRANSFER_INVALID'},422);}
     try{batch=await validateNativePacket(decoded.plaintext);}catch{return json({code:'TRANSFER_SCHEMA_INVALID'},422);}
    }
    // Re-check after validation/unlock expiry, before opening the encrypted store.
    return await withBrowserVault(sessionID,async vault=>{
     if(body.action==='stage'&&batch&&decoded){const result=stageNativeTransfer(vault,batch,decoded.digest,decoded.key);void exportReceivedSummary(batch,'received-batch',()=>{const active=readVaultSession(sessionID);active?.key.fill(0);return !!active;});return json(result);}
     if(body.action==='list')return json(listNativeTransfers(vault));
     if(typeof body.id!=='string')return json({code:'INVALID_SELECTION'},422);
     if(body.action==='body-review'&&Number.isSafeInteger(body.revision)){
      const selected=privateBodyEvidence(vault,body.id,body.revision as number);
      const review=await evaluatePrivateBody(selected.observations,body.rule);
      const active=readVaultSession(sessionID);active?.key.fill(0);if(!active)return json({code:'VAULT_LOCKED'},401);
      return json({id:selected.id,revision:selected.revision,review});
     }
     if(body.action==='preview')return json(previewNativeTransfer(vault,body.id));
     if(body.action==='receipt')return json(nativeReceipt(vault,body.id));
     if((body.action==='accept'||body.action==='delete')&&Number.isSafeInteger(body.revision))return json(decideNativeTransfer(vault,body.id,body.revision as number,body.action));
     return json({code:'INVALID_ACTION'},422);
    });
   }finally{decoded?.key.fill(0);decoded?.plaintext.fill(0);body.key=undefined;}
  }catch(error){
   const allowed=['STALE_REVIEW','BATCH_CONFLICT','REVIEW_LIMIT','SOURCE_UNAVAILABLE','SOURCE_DELETED','REVIEW_REQUIRED'];
   const code=error instanceof Error&&allowed.includes(error.message)?error.message:'TRANSFER_NOT_COMPLETED';
   return vaultSessionFailure(error)??json({code},422);
  }
 });

}
