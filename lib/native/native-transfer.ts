/** Server-only native file boundary. Never instrument payloads or error inputs. */
import {researchJournalWrite} from '@/lib/health/server/research-journal';
import {createDecipheriv, createHash, createHmac} from 'node:crypto';
import {privatePython} from '@/lib/validation/private-validator';
import type {BodyReview} from '@/lib/body/body-review-contract';
import type {ThresholdResult,ThresholdState,RestContext} from '@/lib/body/health-event-contract';
import type {ValidatedTransfer, Observation} from './native-transfer-contract';
import {replaceVaultRecords, putVaultRecords, readVaultRecord, vaultRecordHeaders, type OpenVault, type VaultRecord} from '@/lib/vault/private-vault';
export const TRANSFER_LIMIT = 1_048_604;
const prefix='native:batch:';
type Receipt={version:1;batch_id:string;envelope_sha256:string;status:'accepted-evidence';mac:string};
type Stage={receiverID?:string;validatedAt?:string;acceptedAt?:string;version:1;digest:string;mode:'simulated'|'healthkit';status:'pending-review'|'accepted-evidence'|'deleted';revision:number;count:number;deletionCount:number;observations:Observation[];deletionKeys:string[];observationKeys:string[];receipt:Receipt|null;privacy:'private';canonical:false};
export type NativeTiming={measuredStart:string;measuredEnd:string;receivedStart:string;receivedEnd:string};
export type NativeSummary={validatedAt?:string;acceptedAt?:string;timing?:NativeTiming;id:string;mode:Stage['mode'];status:Stage['status'];revision:number;count:number;deletionCount:number};
export function decodeTransfer(envelope:Buffer,keyText:string){
 if(envelope.length<29||envelope.length>TRANSFER_LIMIT||! /^[A-Za-z0-9+/]{43}=$/.test(keyText))throw Error('TRANSFER_INVALID');
 const key=Buffer.from(keyText,'base64');
 try{
  const decipher=createDecipheriv('aes-256-gcm',key,envelope.subarray(0,12));
  decipher.setAAD(Buffer.from('storywalker-transfer-v1'));decipher.setAuthTag(envelope.subarray(-16));
  return {plaintext:Buffer.concat([decipher.update(envelope.subarray(12,-16)),decipher.final()]),key,digest:createHash('sha256').update(envelope).digest('hex')};
 }catch{key.fill(0);throw Error('TRANSFER_INVALID');}
}
export function validateNativePacket(plaintext:Buffer,clock:()=>number=Date.now):Promise<ValidatedTransfer>{return privatePython<ValidatedTransfer>(plaintext,'dramaturg.native_transfer',new Date(clock()).toISOString());}
export function evaluatePrivateBody(observations:Observation[],rule:unknown):Promise<BodyReview>{
 const bytes=Buffer.from(JSON.stringify({observations,rule}));
 return privatePython<BodyReview>(bytes,'dramaturg.body_review').finally(()=>bytes.fill(0));
}
export type ReceivedHealthSummary={version:1;summary_id:string;source:'watch'|'phone-health';received_count:number;preferred_count:number;maximum_bpm:number;received_start:string;received_end:string};
export function summarizeReceivedHealth(batch:ValidatedTransfer):Promise<ReceivedHealthSummary|null>{
 const bytes=Buffer.from(JSON.stringify(batch));
 return privatePython<ReceivedHealthSummary|null>(bytes,'dramaturg.health_summary').finally(()=>bytes.fill(0));
}
export function evaluateHealthThresholds(rule:unknown,state:ThresholdState|undefined,batch:ValidatedTransfer|null=null,now=new Date().toISOString(),context:RestContext|null=null){
 const bytes=Buffer.from(JSON.stringify({rule,...(state?{state}:{}),batch,now,context}));
 return privatePython<ThresholdResult>(bytes,'dramaturg.health_events').finally(()=>bytes.fill(0));
}
function record(id:string,payload:unknown):VaultRecord{return {id,kind:'reference',capturedAt:new Date().toISOString(),payload};}
function evidenceKey(mode:string,id:string){return 'native:evidence:'+createHash('sha256').update(mode+'\n'+id).digest('hex');}
function stage(vault:OpenVault,id:string):Stage{
 if(!/^native:batch:[a-f0-9-]{36}$/.test(id))throw Error('INVALID_SELECTION');
 const value=readVaultRecord(vault,id)?.payload as Stage|undefined;if(!value)throw Error('SOURCE_UNAVAILABLE');return value;
}
function sourceObservations(vault:OpenVault,s:Stage):Observation[]{
 return s.status==='pending-review'?s.observations:s.status==='deleted'?[]:s.observationKeys.flatMap(key=>{const item=readVaultRecord(vault,key)?.payload as {observation?:Observation}|undefined;return item?.observation?[item.observation]:[];});
}
function summary(vault:OpenVault,id:string,s:Stage,observations=sourceObservations(vault,s)):NativeSummary{
 // Derive from surviving evidence, including batches saved by earlier versions.
 // Never retain a deleted measurement's timing in a cached summary.
 const measured=observations.flatMap(o=>[Date.parse(o.event_start),Date.parse(o.event_end)]).filter(Number.isFinite);
 const received=observations.map(o=>Date.parse(o.received_at)).filter(Number.isFinite);
 const timing=measured.length&&received.length?{measuredStart:new Date(Math.min(...measured)).toISOString(),measuredEnd:new Date(Math.max(...measured)).toISOString(),receivedStart:new Date(Math.min(...received)).toISOString(),receivedEnd:new Date(Math.max(...received)).toISOString()}:undefined;
 return {id,mode:s.mode,status:s.status,revision:s.revision,count:s.count,deletionCount:s.deletionCount,validatedAt:s.validatedAt,acceptedAt:s.acceptedAt,timing};
}
export function listNativeTransfers(vault:OpenVault){return vaultRecordHeaders(vault).filter(h=>h.id.startsWith(prefix)).map(h=>summary(vault,h.id,stage(vault,h.id)));}
export function stageNativeTransfer(vault:OpenVault,batch:ValidatedTransfer,digest:string,key:Buffer,receiverID?:string){
 const id=prefix+batch.batch_id,existing=readVaultRecord(vault,id)?.payload as Stage|undefined;
 if(existing){if(existing.digest!==digest)throw Error('BATCH_CONFLICT');return summary(vault,id,existing);}
 if(listNativeTransfers(vault).filter(s=>s.status==='pending-review').length>=100)throw Error('REVIEW_LIMIT');
 const observations=batch.observations.filter(o=>!(readVaultRecord(vault,evidenceKey(batch.mode,o.id))?.payload as {deleted?:boolean})?.deleted);
 const receipt:Receipt={version:1,batch_id:batch.batch_id,envelope_sha256:digest,status:'accepted-evidence',mac:createHmac('sha256',key).update(`storywalker-receipt-v1\n${batch.batch_id}\n${digest}\naccepted-evidence`).digest('base64')};
 const next:Stage={...(receiverID?{receiverID}:{}),validatedAt:new Date().toISOString(),version:1,digest,mode:batch.mode,status:'pending-review',revision:1,count:observations.length,deletionCount:batch.deletions.length,observations,deletionKeys:batch.deletions.map(d=>evidenceKey(batch.mode,d)),observationKeys:observations.map(o=>evidenceKey(batch.mode,o.id)),receipt,privacy:'private',canonical:false};
 putVaultRecords(vault,[record(id,next)]);return summary(vault,id,next);
}
/** Only the authenticated receiver calls this; unowned legacy stages require manual review.
 * Deletions must target known accepted sleep/heart evidence; unknown targets stay reviewable.
 */
export function canAutomaticallyAcceptHealthStage(vault:OpenVault,id:string,receiverID:string){
 const current=stage(vault,id);
 if(current.status!=='pending-review'||current.mode!=='healthkit'||current.receiverID!==receiverID)return false;
 const supported=(o:Observation)=>o.source_type==='healthkit'&&o.provenance==='source_recorded'&&o.acquisition==='historical'&&['sleep','heart_rate'].includes(o.payload.kind);
 if(!current.observations.every(supported))return false;
 for(const key of current.deletionKeys){
  const item=readVaultRecord(vault,key)?.payload as {deleted?:boolean;observation?:Observation}|undefined;
  if(!item?.deleted&&(!item?.observation||!supported(item.observation)))return false;
 }
 return true;
}
export function nativeTransferSummary(vault:OpenVault,id:string){return summary(vault,id,stage(vault,id));}
export function previewNativeTransfer(vault:OpenVault,id:string){
 const s=stage(vault,id);
 const observations=sourceObservations(vault,s);
 return {...summary(vault,id,s,observations),observations};
}
/** Private BODY reads accepted HealthKit evidence only, never client-supplied observations. */
export function privateBodyEvidence(vault:OpenVault,id:string,revision:number){
 const selected=previewNativeTransfer(vault,id);
 if(selected.mode!=='healthkit'||selected.status!=='accepted-evidence')throw Error('REVIEW_REQUIRED');
 if(selected.revision!==revision)throw Error('STALE_REVIEW');
 return selected;
}
/** This source never enters Atlas, public scenes, proposal providers or the fictional graph.
 * Deletion also invalidates the Study 04 derived note history in the same transaction.
 */
export function decideNativeTransfer(vault:OpenVault,id:string,revision:number,action:'accept'|'delete'){
 const current=stage(vault,id);
 if(current.revision!==revision)throw Error('STALE_REVIEW');
 if(action==='accept'&&current.status==='deleted')throw Error('SOURCE_DELETED');
 if(action==='accept'&&current.status==='accepted-evidence')return summary(vault,id,current);
 const deletedKeys=new Set(action==='delete'?current.observationKeys:current.deletionKeys);
 const writes:VaultRecord[]=[];
 if(action==='accept')for(const observation of current.observations){const key=evidenceKey(current.mode,observation.id);if(!deletedKeys.has(key)&&!readVaultRecord(vault,key))writes.push(record(key,{observation,privacy:'private',canonical:false}));}
 // Payload-free tombstones prevent old/repeated exports from restoring deleted observations.
 for(const key of deletedKeys)writes.push(record(key,{deleted:true}));
 for(const item of listNativeTransfers(vault)){
  if(item.id===id||!deletedKeys.size)continue;
  const other=stage(vault,item.id);
  if(!other.observationKeys.some(key=>deletedKeys.has(key)))continue;
  const kept=other.observations.filter(o=>!deletedKeys.has(evidenceKey(other.mode,o.id)));
  const keys=other.observationKeys.filter(key=>!deletedKeys.has(key));
  writes.push(record(item.id,{...other,observations:kept,observationKeys:keys,count:keys.length,revision:other.revision+1}));
 }
 const remaining=current.observationKeys.filter(key=>!deletedKeys.has(key));
 const next:Stage={...current,acceptedAt:action==='accept'?new Date().toISOString():current.acceptedAt,status:action==='accept'?'accepted-evidence':'deleted',revision:current.revision+1,observations:[],deletionKeys:[],observationKeys:action==='delete'?[]:remaining,count:action==='delete'?0:remaining.length,deletionCount:0,receipt:action==='delete'?null:current.receipt};
 writes.push(record(id,next));
 const journalWrite=researchJournalWrite(vault,writes);if(journalWrite)writes.push(journalWrite);
 replaceVaultRecords(vault,writes,writes.map(r=>r.id)); // Source writes + receipt status in one encrypted durable save.
 return summary(vault,id,next);
}
export function nativeReceipt(vault:OpenVault,id:string){const s=stage(vault,id);if(s.status!=='accepted-evidence'||!s.receipt)throw Error('REVIEW_REQUIRED');return s.receipt;}
