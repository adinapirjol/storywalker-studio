import {describe,it,expect} from 'vitest';
import {createCipheriv,createHmac,randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {openContextSandbox,closeVault,readVaultRecords,readVaultRecord,putVaultRecords,vaultRecordHeaders} from './private-vault';
import {decodeTransfer,validateNativePacket,privateBodyEvidence,evaluatePrivateBody,stageNativeTransfer,previewNativeTransfer,decideNativeTransfer,nativeReceipt,listNativeTransfers} from './native-transfer';
import {eligibleArchiveRecord} from './xr-enrichment';
import {isAtlasSource} from './private-atlas';
const observation={schema_version:1,id:'mock-native-1',source_id:'fictional-native',source_type:'fictional',source_revision:'1',event_start:'2030-05-01T12:00:00+03:00',event_end:'2030-05-01T12:00:00+03:00',received_at:'2030-05-01T09:12:00Z',original_offset:'+03:00',semantics:'measurement',acquisition:'simulated',provenance:'source_recorded',quality:[],payload:{kind:'heart_rate',value:131.5,unit:'bpm'}};
function encrypted(deletion=false){
 const key=randomBytes(32),iv=randomBytes(12),batch_id=randomUUID();
 const plain=Buffer.from(JSON.stringify({version:1,batch_id,mode:'simulated',deliveries:[{id:deletion?'delete:'+observation.id:observation.id,deletion,packet:Buffer.from(deletion?observation.id:JSON.stringify(observation)).toString('base64')}]}));
 const c=createCipheriv('aes-256-gcm',key,iv);c.setAAD(Buffer.from('storywalker-transfer-v1'));
 return {key,envelope:Buffer.concat([iv,c.update(plain),c.final(),c.getAuthTag()])};
}
describe('native transfer trust boundary',()=>{
 it('rejects wrong keys, altered ciphertext and unbounded input',()=>{
  const f=encrypted();expect(()=>decodeTransfer(f.envelope,randomBytes(32).toString('base64'))).toThrow('TRANSFER_INVALID');
  f.envelope[20]^=1;expect(()=>decodeTransfer(f.envelope,f.key.toString('base64'))).toThrow();
  expect(()=>decodeTransfer(Buffer.alloc(1_048_605),f.key.toString('base64'))).toThrow();
 });
 it('validates via Python, reviews, persists encrypted, acknowledges, retries and propagates deletion',async()=>{
  const namespace='context-sandbox-native-test-'+randomUUID(),directory=path.join(process.cwd(),'private-data',namespace);
  let vault=await openContextSandbox(namespace);
  try{
   const f=encrypted(),decoded=decodeTransfer(f.envelope,f.key.toString('base64'));
   const batch=await validateNativePacket(decoded.plaintext);
   let item=stageNativeTransfer(vault,batch,decoded.digest,decoded.key);
   expect(item.validatedAt).toMatch(/^\d{4}-/);
   expect(item.acceptedAt).toBeUndefined();
   expect(item.timing).toEqual({measuredStart:'2030-05-01T09:00:00.000Z',measuredEnd:'2030-05-01T09:00:00.000Z',receivedStart:'2030-05-01T09:12:00.000Z',receivedEnd:'2030-05-01T09:12:00.000Z'});
   const timing=item.timing;
   const validatedAt=item.validatedAt;
   expect(()=>nativeReceipt(vault,item.id)).toThrow('REVIEW_REQUIRED');
   expect(previewNativeTransfer(vault,item.id).observations[0].event_start).toContain('12:00:00');
   expect(()=>decideNativeTransfer(vault,item.id,0,'accept')).toThrow('STALE_REVIEW');
   item=decideNativeTransfer(vault,item.id,item.revision,'accept');
   expect(item.acceptedAt).toMatch(/^\d{4}-/);
   expect(item.validatedAt).toBe(validatedAt);
   expect(item.timing).toEqual(timing);
   const acceptedAt=item.acceptedAt;
   const receipt=nativeReceipt(vault,item.id);
   expect(receipt.mac).toBe(createHmac('sha256',f.key).update(`storywalker-receipt-v1\n${batch.batch_id}\n${decoded.digest}\naccepted-evidence`).digest('base64'));
   expect(readVaultRecords(vault)).toEqual([]);
   expect(vaultRecordHeaders(vault).every(h=>!isAtlasSource(h)&&!eligibleArchiveRecord(h))).toBe(true);
   closeVault(vault);vault=await openContextSandbox(namespace);
   expect(readFileSync(path.join(directory,'scenario.sqlite')).includes(Buffer.from('fictional-native'))).toBe(false);
   expect(stageNativeTransfer(vault,batch,decoded.digest,decoded.key)).toMatchObject({status:'accepted-evidence',validatedAt,acceptedAt});
   expect(decideNativeTransfer(vault,item.id,item.revision,'accept').acceptedAt).toBe(acceptedAt);
   const pending=encrypted(),p=decodeTransfer(pending.envelope,pending.key.toString('base64'));
   const pendingItem=stageNativeTransfer(vault,await validateNativePacket(p.plaintext),p.digest,p.key);
   const deletion=encrypted(true),d=decodeTransfer(deletion.envelope,deletion.key.toString('base64'));
   const delItem=stageNativeTransfer(vault,await validateNativePacket(d.plaintext),d.digest,d.key);
   decideNativeTransfer(vault,delItem.id,delItem.revision,'accept');
   expect(previewNativeTransfer(vault,item.id).observations).toEqual([]);
   expect(previewNativeTransfer(vault,pendingItem.id).observations).toEqual([]);
   expect(listNativeTransfers(vault).filter(i=>[item.id,pendingItem.id].includes(i.id)).every(i=>i.timing===undefined)).toBe(true);
   expect(()=>decideNativeTransfer(vault,pendingItem.id,pendingItem.revision,'accept')).toThrow('STALE_REVIEW');
   const fresh=encrypted(),r=decodeTransfer(fresh.envelope,fresh.key.toString('base64'));
   const repeated=stageNativeTransfer(vault,await validateNativePacket(r.plaintext),r.digest,r.key);
   expect(repeated.count).toBe(0);
   decideNativeTransfer(vault,item.id,previewNativeTransfer(vault,item.id).revision,'delete');
   expect(()=>nativeReceipt(vault,item.id)).toThrow('REVIEW_REQUIRED');
  }finally{closeVault(vault);rmSync(directory,{recursive:true,force:true});}
 },20000);
 it('never returns sensitive validation inputs to the caller',async()=>{
  await expect(validateNativePacket(Buffer.from('{"private":"canary-secret"}'))).rejects.toThrow('TRANSFER_INVALID');
 });
});

// All health-shaped records below are invented test fixtures in an isolated encrypted sandbox.
it('private BODY rejects unaccepted or simulated batches and re-reads source deletion',async()=>{
 const namespace='context-sandbox-private-body-'+randomUUID(),directory=path.join(process.cwd(),'private-data',namespace);
 const vault=await openContextSandbox(namespace);
 try{
  const key=randomBytes(32);
  const rows=[0,1,2].map(i=>({...observation,id:'invented-'+i,source_type:'healthkit',acquisition:'historical',event_start:new Date(Date.UTC(2030,4,1,12,0,i*30)).toISOString(),event_end:new Date(Date.UTC(2030,4,1,12,0,i*30)).toISOString(),payload:{kind:'heart_rate',value:140,unit:'bpm'}}));
  const validated=await validateNativePacket(Buffer.from(JSON.stringify({version:1,batch_id:randomUUID(),mode:'healthkit',deliveries:rows.map(o=>({id:o.id,deletion:false,packet:Buffer.from(JSON.stringify(o)).toString('base64')}))})));
  let item=stageNativeTransfer(vault,validated,'test-digest',key);
  expect(()=>privateBodyEvidence(vault,item.id,item.revision)).toThrow('REVIEW_REQUIRED');
  item=decideNativeTransfer(vault,item.id,item.revision,'accept');
  // Older batches did not persist Mac timestamps. Read measurement/receipt
  // bounds from surviving accepted records rather than inventing an import date.
  const stored=readVaultRecord(vault,item.id)!;
  const legacy={...(stored.payload as Record<string,unknown>)};delete legacy.validatedAt;delete legacy.acceptedAt;
  putVaultRecords(vault,[{...stored,payload:legacy}]);
  const legacySummary=listNativeTransfers(vault).find(i=>i.id===item.id)!;
  expect(legacySummary.validatedAt).toBeUndefined();expect(legacySummary.acceptedAt).toBeUndefined();
  expect(legacySummary.timing).toEqual({measuredStart:'2030-05-01T12:00:00.000Z',measuredEnd:'2030-05-01T12:01:00.000Z',receivedStart:'2030-05-01T09:12:00.000Z',receivedEnd:'2030-05-01T09:12:00.000Z'});
  expect(()=>privateBodyEvidence(vault,item.id,1)).toThrow('STALE_REVIEW');
  const current=privateBodyEvidence(vault,item.id,item.revision);
  const result=await evaluatePrivateBody(current.observations,{enabled:true});
  expect(result.markers).toHaveLength(1);expect(result.notifications).toBe(0);expect(result.canonical).toBe(false);
  decideNativeTransfer(vault,item.id,item.revision,'delete');
  expect(()=>privateBodyEvidence(vault,item.id,item.revision)).toThrow('REVIEW_REQUIRED');
  const f=encrypted(),d=decodeTransfer(f.envelope,f.key.toString('base64'));
  const simulated=stageNativeTransfer(vault,await validateNativePacket(d.plaintext),d.digest,d.key);
  const accepted=decideNativeTransfer(vault,simulated.id,simulated.revision,'accept');
  expect(()=>privateBodyEvidence(vault,accepted.id,accepted.revision)).toThrow('REVIEW_REQUIRED');
 }finally{closeVault(vault);rmSync(directory,{recursive:true,force:true});}
},20000);
