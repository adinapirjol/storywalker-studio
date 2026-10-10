import {isLocalSameOrigin,isLocalRead} from '@/lib/local-origin';
import { NextRequest, NextResponse } from 'next/server';
import {boundedText} from '@/lib/context-request';
import { vaultRecordHeaders, readVaultRecord, putVaultRecords, removeVaultRecords } from '@/lib/private-vault';
import { vaultSessionActive, VAULT_SESSION_COOKIE, vaultSessionFailure } from '@/lib/vault-session';
import {withBrowserVault} from '@/lib/vault-route-access';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:NextRequest) {
 if(!isLocalRead(request))return json({code:'LOCAL_ORIGIN_REQUIRED'},403);
 const token=request.cookies.get(VAULT_SESSION_COOKIE)?.value;
 if(!vaultSessionActive(token))return json({code:'VAULT_LOCKED'},401);
 try{return await withBrowserVault(token,vault=>json(vaultRecordHeaders(vault).filter(h=>/^health:stage:[a-f0-9-]+$/.test(h.id)).map(h=>({id:h.id,...readVaultRecord(vault,h.id)?.payload as object}))));}
 catch(error){return vaultSessionFailure(error)??json({code:'SOURCE_UNAVAILABLE'},422);}
}
export async function POST(request:NextRequest) {
 if(!isLocalSameOrigin(request))return json({code:'LOCAL_ORIGIN_REQUIRED'},403);
 const token=request.cookies.get(VAULT_SESSION_COOKIE)?.value;
 if(!vaultSessionActive(token))return json({code:'VAULT_LOCKED'},401);
 let raw:string;try{raw=await boundedText(request,2048);}catch{return json({error:'Request limit or malformed input'},413);}
 let body:{id:string;action:string};try{body=JSON.parse(raw);if(!body||typeof body.id!=='string'||typeof body.action!=='string')throw Error();}catch{return json({error:'Invalid action'},422);}
 if(!/^health:stage:[a-f0-9-]+$/.test(body.id)||!['preview','accept','delete'].includes(body.action))return json({error:'Invalid selection'},422);
 try{return await withBrowserVault(token,vault=>{
  const record=readVaultRecord(vault,body.id);if(!record)return json({error:'Source unavailable'},404);
  const manifest=record.payload as {chunkIds:string[];status:string;count:number};
  if(body.action==='preview')return json({manifest,firstChunk:manifest.chunkIds.length?readVaultRecord(vault,manifest.chunkIds[0])?.payload:null});
  if(body.action==='delete'){removeVaultRecords(vault,[body.id,...manifest.chunkIds]);return json({status:'deleted'});}
  if(manifest.status!=='pending-review')return json({status:manifest.status});
  // Accepted observations remain source evidence, never Journeys, Episodes or public drafts.
  const chunks=manifest.chunkIds.map(id=>readVaultRecord(vault,id));
  if(chunks.some(chunk=>!chunk))return json({code:'SOURCE_UNAVAILABLE'},409);
  putVaultRecords(vault,[...chunks.map(chunk=>({...chunk!,payload:{...chunk!.payload as object,status:'accepted-evidence',source:'apple-health'}})),{...record,payload:{...manifest,status:'accepted-evidence',source:'apple-health',privacy:'private',canonical:false}}]);
  return json({status:'accepted-evidence'});
 });}catch(error){return vaultSessionFailure(error)??json({code:'TRANSFER_NOT_COMPLETED'},422);}
}
