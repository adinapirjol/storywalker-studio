/** Local pinned HTTPS only. No request/error logging or automatic Author decisions. External aggregate summaries have a separate explicit opt-in. */
import {createServer,type Server} from 'node:https';
import {randomBytes,randomUUID,timingSafeEqual,X509Certificate,createHash} from 'node:crypto';
import {networkInterfaces,tmpdir} from 'node:os';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {readVaultSession} from '@/lib/vault/vault-session';
import {openVaultWithKey,closeVault,readVaultRecord,putVaultRecords,setVaultAccessGuard,type OpenVault} from '@/lib/vault/private-vault';
import {decodeTransfer,validateNativePacket,stageNativeTransfer,nativeTransferSummary,nativeReceipt} from './native-transfer';
import {clearLiveSummary} from '@/lib/body/health-summary';
import {observeThresholdBatch,clearThresholdSession} from '@/lib/body/health-threshold';
import {nativeTransaction} from './native-transaction';
import type {BodyLiveSample} from '@/lib/body/body-live';
import {liveSampleValid} from '@/lib/body/body-live';
const recordID='native:pairing:receiver';
const PORT=8766;
export type ReceiverConfig={version:1;id:string;host:string;port:number;mode:'simulated'|'healthkit';token:string;certificate:string;privateKey:string;revoked:boolean};
export type ReceiverEvent={type:'sample';sample:BodyLiveSample|null}|{type:'contact';at:string;id:string}|{type:'closed';code:string};
type Viewer={id:string;owner:string;push:(event:ReceiverEvent)=>boolean;close:(code?:string)=>void};
type Active={previewBusy?:boolean;viewer?:Viewer;streamOwner?:{id:string;sessionID:string};deletedPreviewIDs?:Set<string>;server:Server;sessionID:string;config:ReceiverConfig;busy:boolean;preview?:BodyLiveSample;previewUntil?:number;previewOwner?:string;latestMeasured?:number;timer:ReturnType<typeof setInterval>};
export type ReceiverConnection={id:string;reconnect:boolean};
const shared=globalThis as typeof globalThis&{__nativeReceiver?:Active};
export function privateIPv4(host:string){
 const p=host.split('.').map(Number);return /^\d+\.\d+\.\d+\.\d+$/.test(host)&&p.every(n=>Number.isInteger(n)&&n>=0&&n<=255)&&(p[0]===10||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168));
}
export function receiverAddresses(){return Object.entries(networkInterfaces()).flatMap(([name,items])=>(items??[]).filter(i=>!i.internal&&i.family==='IPv4'&&privateIPv4(i.address)).map(i=>({name,address:i.address})));}
export function receiverSessionActive(id:string|undefined){const session=readVaultSession(id);if(!session)return false;session.key.fill(0);return true;}
export function receiverStatus(){const a=shared.__nativeReceiver;return {running:!!a&&receiverSessionActive(a.sessionID),mode:a?.config.mode??null,port:PORT,addresses:receiverAddresses()};}
/** A short browser lease: no persisted subscription, acceptance, or telemetry. */
export function receiverPreview(sessionID:string,enabled:boolean){
 const a=shared.__nativeReceiver;
 if(!receiverSessionActive(sessionID)||!a||!receiverSessionActive(a.sessionID)||a.config.mode!=='healthkit')throw Error('HEALTHKIT_RECEIVER_REQUIRED');
 if(enabled){a.previewOwner=sessionID;a.previewUntil=Date.now()+10_000;}
 else if(a.previewOwner===sessionID){a.previewUntil=0;clearPreview(a);a.viewer?.close();}
 if(!liveSampleValid(a.preview??null))a.preview=undefined;
 return {sample:enabled?a.preview??null:null};
}
/** One bounded viewer. Each active stream renews only its display lease, never Vault expiry. */
export function assertReceiverConnection(sessionID:string,connection?:ReceiverConnection){
 const current=shared.__nativeReceiver;
 if(!current||!receiverSessionActive(sessionID)||!receiverSessionActive(current.sessionID)||current.config.mode!=='healthkit')throw Error('HEALTHKIT_RECEIVER_REQUIRED');
 if(connection?.reconnect&&(current.streamOwner?(current.streamOwner.id!==connection.id||current.streamOwner.sessionID!==sessionID):!!current.viewer))throw Error('VIEWER_REPLACED');
}
export function subscribeReceiver(sessionID:string,push:(event:ReceiverEvent)=>boolean,close:(code?:string)=>void,connection?:ReceiverConnection){
 assertReceiverConnection(sessionID,connection);
 const current=shared.__nativeReceiver!;
 current.viewer?.close('VIEWER_REPLACED');
 current.streamOwner=connection?{id:connection.id,sessionID}:undefined;
 const id=randomUUID();
 current.viewer={id,owner:sessionID,push,close};current.previewOwner=sessionID;current.previewUntil=Date.now()+10_000;
 if(!liveSampleValid(current.preview??null))current.preview=undefined;
 if(!push({type:'sample',sample:current.preview??null})){close();}
 return {
  renew(){
   if(shared.__nativeReceiver!==current||current.viewer?.id!==id||!receiverSessionActive(sessionID)||!receiverSessionActive(current.sessionID))return false;
   current.previewUntil=Date.now()+10_000;return true;
  },
  stop(){if(current.viewer?.id===id){current.viewer=undefined;current.preview=undefined;current.previewOwner=undefined;current.previewUntil=0;}},
 };
}
function publish(current:Active,event:ReceiverEvent){if(current.viewer&&!current.viewer.push(event))current.viewer.close();}
function clearPreview(current:Active){current.preview=undefined;publish(current,{type:'sample',sample:null});}
async function receivePreview(current:Active,body:Record<string,unknown>,check:()=>void){
 check();
 if(current.config.mode!=='healthkit')throw Error('MODE_MISMATCH');
 if(!current.previewOwner||!receiverSessionActive(current.previewOwner)||(current.previewUntil??0)<Date.now()){
  clearPreview(current);return {status:'preview-off'};
 }
 if(body.action==='preview-clear'){clearPreview(current);return {status:'previewed'};}
 if(body.action==='heartbeat'){
  if(!current.preview)return {status:'preview-needed'};
  const at=new Date().toISOString();current.preview={...current.preview,lastContactAt:at};
  publish(current,{type:'contact',at,id:current.preview.observation.id});return {status:'previewed'};
 }
 if(typeof body.envelope!=='string'||typeof body.key!=='string')throw Error('INVALID_REQUEST');
 const decoded=decodeTransfer(Buffer.from(body.envelope,'base64'),body.key);
 try{
  const batch=await validateNativePacket(decoded.plaintext);check();
  if(batch.mode!=='healthkit')throw Error('INVALID_PREVIEW');
  if(batch.deletions.length&&batch.observations.length===0){
   const deleted=current.deletedPreviewIDs??=new Set<string>();
   clearLiveSummary();
   clearThresholdSession();
   for(const id of batch.deletions){if(deleted.size>=10_000&&!deleted.has(id))throw Error('PREVIEW_LIMIT');deleted.add(id);}
   if(current.preview&&deleted.has(current.preview.observation.id))clearPreview(current);
   return {status:'previewed'};
  }
  if(batch.observations.length!==1||batch.deletions.length)throw Error('INVALID_PREVIEW');
  const observation=batch.observations[0];
  if(observation.source_type!=='healthkit'||observation.payload.kind!=='heart_rate'||!observation.quality.includes('recorded_on_apple_watch'))throw Error('WATCH_REQUIRED');
  const value={observation,arrivedAt:new Date().toISOString()},measured=Date.parse(observation.event_start);
  if(!current.deletedPreviewIDs?.has(observation.id)&&liveSampleValid(value)&&measured>=(current.latestMeasured??0)&&current.previewOwner&&receiverSessionActive(current.previewOwner)&&(current.previewUntil??0)>=Date.now()){
   current.preview=current.preview?.observation.id===observation.id?{...current.preview,lastContactAt:value.arrivedAt}:value;current.latestMeasured=measured;publish(current,{type:'sample',sample:current.preview});
   const previewOwner=current.previewOwner;
   void observeThresholdBatch(batch,'fresh-live',()=>shared.__nativeReceiver===current&&receiverSessionActive(current.sessionID)&&current.previewOwner===previewOwner&&receiverSessionActive(previewOwner)&&(current.previewUntil??0)>=Date.now());
  }else if(!liveSampleValid(current.preview??null))current.preview=undefined;
  return {status:'previewed'};
 }finally{decoded.key.fill(0);decoded.plaintext.fill(0);body.key=undefined;body.envelope=undefined;}
}
export function pairingDocument(c:ReceiverConfig){return {version:1,endpoint:`https://${c.host}:${c.port}/transfer`,mode:c.mode,token:c.token,certificate_sha256:createHash('sha256').update(new X509Certificate(c.certificate).raw).digest('hex')};}
export async function makeReceiverConfig(host:string,mode:'simulated'|'healthkit',port=PORT):Promise<ReceiverConfig>{
 if(!(privateIPv4(host)||host==='127.0.0.1')||!Number.isSafeInteger(port)||port<0||port>65535)throw Error('INVALID_BIND');
 const directory=await mkdtemp(join(tmpdir(),'storywalker-tls-'));
 try{
  await writeFile(join(directory,'openssl.cnf'),`[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=ext\n[dn]\nCN=Storywalker local receiver\n[ext]\nsubjectAltName=IP:${host}\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n`,{mode:0o600});
  await promisify(execFile)('/usr/bin/openssl',['req','-x509','-sha256','-newkey','rsa:2048','-nodes','-days','365','-config',join(directory,'openssl.cnf'),'-keyout',join(directory,'key.pem'),'-out',join(directory,'cert.pem')],{timeout:15000,maxBuffer:65536});
  return {version:1,id:randomUUID(),host,port,mode,token:randomBytes(32).toString('base64'),certificate:await readFile(join(directory,'cert.pem'),'utf8'),privateKey:await readFile(join(directory,'key.pem'),'utf8'),revoked:false};
 }finally{await rm(directory,{recursive:true,force:true});}
}
function saved(vault:OpenVault){return readVaultRecord(vault,recordID)?.payload as ReceiverConfig|undefined;}
function save(vault:OpenVault,config:ReceiverConfig|{revoked:true}){putVaultRecords(vault,[{id:recordID,kind:'reference',capturedAt:new Date().toISOString(),payload:config}]);}
export async function stopReceiver(){
 clearLiveSummary();
 clearThresholdSession();
 const active=shared.__nativeReceiver;shared.__nativeReceiver=undefined;
 if(active){active.viewer?.push({type:'closed',code:'HEALTHKIT_RECEIVER_REQUIRED'});active.viewer?.close();clearInterval(active.timer);active.server.closeAllConnections();await new Promise<void>(resolve=>active.server.close(()=>resolve()));}
}
export async function configureReceiver(vault:OpenVault,sessionID:string,action:'create'|'resume'|'stop'|'revoke'|'pairing'|'follow',host?:string,mode?:'simulated'|'healthkit'){
 if(action==='stop'||action==='revoke'){await stopReceiver();if(action==='revoke')save(vault,{revoked:true});return receiverStatus();}
 let config=saved(vault);
 if(action==='create'){
  if(!host||!receiverAddresses().some(a=>a.address===host)||!mode)throw Error('INVALID_BIND');
  await stopReceiver();config=await makeReceiverConfig(host,mode);save(vault,config);
 }
 if(!config||config.revoked)throw Error('PAIRING_REQUIRED');
 if(action==='pairing')return pairingDocument(config);
 if(action==='follow'&&config.mode!=='healthkit')throw Error('HEALTHKIT_PAIRING_REQUIRED');
 if(!receiverAddresses().some(a=>a.address===config.host))throw Error('ADDRESS_CHANGED');
 await stopReceiver();
 await startReceiver(config,sessionID);
 return action==='follow'?receiverPreview(sessionID,true):receiverStatus();
}
function authenticated(request:IncomingMessage,config:ReceiverConfig){
 const supplied=Buffer.from(request.headers.authorization??''),expected=Buffer.from(`Bearer ${config.token}`);
 return supplied.length===expected.length&&timingSafeEqual(supplied,expected);
}
function response(res:ServerResponse,status:number,data:unknown){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function boundedBody(req:IncomingMessage){
 let size=0;const parts:Buffer[]=[];
 try{for await(const chunk of req){size+=chunk.length;if(size>1_500_000)throw Error('limit');parts.push(chunk);}return JSON.parse(Buffer.concat(parts).toString()) as Record<string,unknown>;}
 finally{for(const part of parts)part.fill(0);}
}
export async function receiveTransfer(vault:OpenVault,config:ReceiverConfig,body:Record<string,unknown>,check=()=>{}){
 check();
 if(body.action==='receipt'&&typeof body.id==='string'){
  const batch=nativeTransferSummary(vault,body.id);
  check();
  if(batch.mode!==config.mode)throw Error('MODE_MISMATCH');
  return batch.status==='accepted-evidence'?{status:'accepted-evidence',receipt:nativeReceipt(vault,body.id)}:{status:batch.status};
 }
 if(body.action!=='deliver'||typeof body.envelope!=='string'||typeof body.key!=='string')throw Error('INVALID_REQUEST');
 const decoded=decodeTransfer(Buffer.from(body.envelope,'base64'),body.key);
 try{
  const batch=await validateNativePacket(decoded.plaintext);
  check();
  if(batch.mode!==config.mode)throw Error('MODE_MISMATCH');
  const item=stageNativeTransfer(vault,batch,decoded.digest,decoded.key);
  if(batch.deletions.length)clearThresholdSession();
  return item.status==='accepted-evidence'?{status:item.status,receipt:nativeReceipt(vault,item.id)}:{status:item.status};
 }finally{decoded.key.fill(0);decoded.plaintext.fill(0);body.key=undefined;body.envelope=undefined;}
}
/** Test injection opens only a fictional sandbox; production always resolves the active Vault session. */
export async function startReceiver(config:ReceiverConfig,sessionID:string,open=async()=>{
 const session=readVaultSession(sessionID);if(!session)throw Error('VAULT_LOCKED');
 try{return await openVaultWithKey(session.key);}finally{session.key.fill(0);}
},sessionActive=()=>receiverSessionActive(sessionID)){
 const server=createServer({key:config.privateKey,cert:config.certificate,minVersion:'TLSv1.2',handshakeTimeout:5000},async(req,res)=>{
  const current=shared.__nativeReceiver;
  if(current?.server!==server||req.method!=='POST'||req.url!=='/transfer'||req.headers.origin||!authenticated(req,config)){response(res,403,{code:'NOT_AUTHORIZED'});return;}
  if(!sessionActive()){response(res,423,{code:'VAULT_LOCKED'});return;}
  let previewRequest=false,acquired=false;
  try{
   const body=await boundedBody(req);
   previewRequest=['preview','preview-clear','heartbeat'].includes(String(body.action));
   if(previewRequest?current.previewBusy:current.busy){response(res,429,{code:'RETRY_LATER'});return;}
   if(previewRequest)current.previewBusy=true;else current.busy=true;
   acquired=true;
   const check=()=>{if(shared.__nativeReceiver!==current||!sessionActive())throw Error('RECEIVER_PAUSED');};
   if(previewRequest){
    // Memory-only preview has its own bounded lane; archive review cannot hold it up.
    response(res,200,await receivePreview(current,body,check));
   }else{
    await nativeTransaction(async()=>{
     check();const vault=await open();
     try{check();setVaultAccessGuard(vault,check);response(res,200,await receiveTransfer(vault,config,body,check));}
     finally{closeVault(vault);}
    });
   }
  }catch(error){if(!res.headersSent)response(res,error instanceof Error&&error.message==='SOURCE_UNAVAILABLE'?404:422,{code:'TRANSFER_NOT_COMPLETED'});}
  finally{if(acquired){if(previewRequest)current.previewBusy=false;else current.busy=false;}}
 });
 server.keepAliveTimeout=30_000;server.requestTimeout=12000;server.headersTimeout=5000;server.maxConnections=8;
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(config.port,config.host,()=>{server.removeListener('error',reject);resolve();});});
 const timer=setInterval(()=>{if(!sessionActive())void stopReceiver();else {const a=shared.__nativeReceiver;if(a&&((a.previewUntil??0)<Date.now()||!a.previewOwner||!receiverSessionActive(a.previewOwner)||!liveSampleValid(a.preview??null)))a.preview=undefined;}},1000);timer.unref();server.unref();
 shared.__nativeReceiver={server,sessionID,config,busy:false,timer};
 return server;
}
