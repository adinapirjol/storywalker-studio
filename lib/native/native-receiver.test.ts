import {it,expect} from 'vitest';
import {request as httpsRequest,Agent} from 'node:https';
import {createCipheriv,randomBytes,randomUUID} from 'node:crypto';
import {rmSync} from 'node:fs';
import path from 'node:path';
import {makeReceiverConfig,startReceiver,stopReceiver,privateIPv4,pairingDocument,receiverPreview,subscribeReceiver,assertReceiverConnection,type ReceiverConfig,type ReceiverEvent} from './native-receiver';
import {openContextSandbox,closeVault} from '@/lib/vault/private-vault';
import {listNativeTransfers,decideNativeTransfer} from './native-transfer';
import {createVaultSession,deleteVaultSession} from '@/lib/vault/vault-session';
import {nativeTransaction} from './native-transaction';
function packet(mode='simulated',at='2030-05-01T12:00:00Z',watch=false,deletion=false,id='mock-network-heart'){
 const key=randomBytes(32),iv=randomBytes(12);
 const o={id,source_id:'fictional-network',source_type:mode==='simulated'?'fictional':'healthkit',acquisition:mode==='simulated'?'simulated':'historical',event_start:at,event_end:at,received_at:at,quality:watch?['recorded_on_apple_watch']:[],original_offset:'+00:00',semantics:'measurement',provenance:'source_recorded',payload:{kind:'heart_rate',value:131}};
 const bytes=Buffer.from(JSON.stringify({version:1,batch_id:randomUUID(),mode,deliveries:[{id:deletion?'delete:'+o.id:o.id,deletion,packet:Buffer.from(deletion?o.id:JSON.stringify(o)).toString('base64')}]}));
 const c=createCipheriv('aes-256-gcm',key,iv);c.setAAD(Buffer.from('storywalker-transfer-v1'));
 return {action:'deliver',envelope:Buffer.concat([iv,c.update(bytes),c.final(),c.getAuthTag()]).toString('base64'),key:key.toString('base64')};
}
function send(c:ReceiverConfig,body:object,token=c.token,origin?:string){return new Promise<{status:number;body:Record<string,unknown>}>((resolve,reject)=>{
 const r=httpsRequest({hostname:c.host,port:c.port,path:'/transfer',method:'POST',ca:c.certificate,headers:{authorization:`Bearer ${token}`,'Content-Type':'application/json',...(origin?{origin}:{})}},res=>{
  let text='';res.on('data',d=>text+=d);res.on('end',()=>resolve({status:res.statusCode!,body:JSON.parse(text)}));
 });r.on('error',reject);r.end(JSON.stringify(body));
});}
it('only binds private IPv4 choices and pairing documents exclude the TLS private key',async()=>{
 expect(privateIPv4('192.168.1.4')).toBe(true);expect(privateIPv4('8.8.8.8')).toBe(false);expect(privateIPv4('10.999.0.1')).toBe(false);
 const c=await makeReceiverConfig('127.0.0.1','simulated',0);
 expect(JSON.stringify(pairingDocument(c))).not.toContain('PRIVATE KEY');
},20000);
it('pinned TLS transport stages, retries, waits for review, returns receipt, rejects wrong mode/auth/origin and closes',async()=>{
 const namespace='context-sandbox-receiver-'+randomUUID(),directory=path.join(process.cwd(),'private-data',namespace);
 let unlocked=true;
 const c=await makeReceiverConfig('127.0.0.1','simulated',0);
 const server=await startReceiver(c,'test',()=>openContextSandbox(namespace),()=>unlocked);
 c.port=(server.address() as {port:number}).port;
 try{
  const body=packet();
  expect((await send(c,body,'wrong')).status).toBe(403);
  expect((await send(c,body,c.token,'https://untrusted.example')).status).toBe(403);
  expect((await send(c,packet('healthkit'))).status).toBe(422);
  expect((await send(c,{action:'deliver',key:'SECRET-CANARY',envelope:'invalid'})).body).toEqual({code:'TRANSFER_NOT_COMPLETED'});
  expect((await send(c,body)).body.status).toBe('pending-review');
  expect((await send(c,body)).body.status).toBe('pending-review');
  await nativeTransaction(async()=>{const vault=await openContextSandbox(namespace);try{const list=listNativeTransfers(vault);expect(list).toHaveLength(1);expect(list[0].status).toBe('pending-review');decideNativeTransfer(vault,list[0].id,list[0].revision,'accept');}finally{closeVault(vault);}});
  const accepted=await send(c,body);expect(accepted.body.status).toBe('accepted-evidence');expect(accepted.body.receipt).toBeTruthy();
  unlocked=false;expect((await send(c,body)).status).toBe(423);
 }finally{await stopReceiver();rmSync(directory,{recursive:true,force:true});}
},30000);

it('temporary Watch preview requires a viewer lease, never opens the Vault, ignores older readings and clears on stop',async()=>{
 const c=await makeReceiverConfig('127.0.0.1','healthkit',0),session=createVaultSession(randomBytes(32));
 let opens=0;
 const server=await startReceiver(c,session.token,async()=>{opens++;throw Error('Preview must not open storage');});
 c.port=(server.address() as {port:number}).port;
 const preview=(at:string,watch=true)=>({...packet('healthkit',at,watch),action:'preview'});
 try{
  const at=new Date(Date.now()-300_000).toISOString();
  expect((await send(c,preview(at))).body.status).toBe('preview-off');
  expect(receiverPreview(session.token,true).sample).toBeNull();
  expect((await send(c,preview(at,false))).status).toBe(422);
  expect((await send(c,preview(at))).body.status).toBe('previewed');
  expect(Date.parse(receiverPreview(session.token,true).sample!.observation.event_start)).toBe(Date.parse(at));
  await send(c,preview(new Date(Date.now()-600_000).toISOString()));
  expect(Date.parse(receiverPreview(session.token,true).sample!.observation.event_start)).toBe(Date.parse(at));
  const arrival=receiverPreview(session.token,true).sample!.arrivedAt;
  await send(c,preview(at));
  const again=receiverPreview(session.token,true).sample!;
  expect(again.arrivedAt).toBe(arrival);expect(again.lastContactAt).toBeTruthy();
  expect((await send(c,{...packet('healthkit',at,true,true),action:'preview'})).body.status).toBe('previewed');
  expect(receiverPreview(session.token,true).sample).toBeNull();
  await send(c,preview(new Date(Date.now()-600_000).toISOString()));
  expect(receiverPreview(session.token,true).sample).toBeNull();
  await send(c,{...packet('healthkit',new Date().toISOString(),true,false,'new-watch-reading'),action:'preview'});
  expect(receiverPreview(session.token,true).sample).not.toBeNull();
  expect(opens).toBe(0);
  expect((await send(c,{action:'preview-clear'})).body.status).toBe('previewed');
  expect(receiverPreview(session.token,true).sample).toBeNull();
  expect(receiverPreview(session.token,false).sample).toBeNull();
  expect(receiverPreview(session.token,true).sample).toBeNull();
  deleteVaultSession(session.token);
  expect((await send(c,preview(at))).status).toBe(423);
 }finally{deleteVaultSession(session.token);await stopReceiver();}
},30000);

it('pushes temporary updates independently of archive transactions and heartbeats carry no reading',async()=>{
 const c=await makeReceiverConfig('127.0.0.1','healthkit',0),session=createVaultSession(randomBytes(32));
 const server=await startReceiver(c,session.token,async()=>{throw Error('Preview must not open storage');});
 c.port=(server.address() as {port:number}).port;
 const events:ReceiverEvent[]=[];
 const subscription=subscribeReceiver(session.token,event=>{events.push(event);return true;},()=>{});
 let release!:()=>void;const held=nativeTransaction(()=>new Promise<void>(resolve=>{release=resolve;}));
 try{
  await Promise.resolve();
  const at=new Date().toISOString();
  expect((await send(c,{...packet('healthkit',at,true),action:'preview'})).body.status).toBe('previewed');
  expect(events.at(-1)?.type).toBe('sample');
  const arrival=receiverPreview(session.token,true).sample!.arrivedAt;
  expect((await send(c,{action:'heartbeat'})).body.status).toBe('previewed');
  expect(events.at(-1)?.type).toBe('contact');expect(JSON.stringify(events.at(-1))).not.toContain('payload');
  expect(receiverPreview(session.token,true).sample!.arrivedAt).toBe(arrival);
  await send(c,{...packet('healthkit',at,true,true),action:'preview'});
  expect(events.at(-1)).toEqual({type:'sample',sample:null});
  await send(c,{...packet('healthkit',new Date().toISOString(),true),action:'preview'});
  expect(receiverPreview(session.token,true).sample).toBeNull();
  expect(subscription.renew()).toBe(true);
  subscription.stop();expect((await send(c,{action:'heartbeat'})).body.status).toBe('preview-off');
 }finally{release?.();await held;subscription.stop();deleteVaultSession(session.token);await stopReceiver();}
},30000);

it('reuses an authenticated TLS connection for small receipt checks and never approves a missing batch',async()=>{
 const namespace='context-sandbox-receiver-'+randomUUID(),directory=path.join(process.cwd(),'private-data',namespace);
 const c=await makeReceiverConfig('127.0.0.1','simulated',0),server=await startReceiver(c,'test',()=>openContextSandbox(namespace),()=>true);
 c.port=(server.address() as {port:number}).port;
 const agent=new Agent({keepAlive:true,maxSockets:1});let connections=0;
 server.on('secureConnection',()=>connections++);
 const check=(id:string)=>new Promise<number>((resolve,reject)=>{
  const r=httpsRequest({hostname:c.host,port:c.port,path:'/transfer',method:'POST',ca:c.certificate,agent,headers:{authorization:`Bearer ${c.token}`,'Content-Type':'application/json'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode!));});r.on('error',reject);r.end(JSON.stringify({action:'receipt',id}));
 });
 try{const id='native:batch:'+randomUUID();expect(await check(id)).toBe(404);expect(await check(id)).toBe(404);expect(connections).toBe(1);}
 finally{agent.destroy();await stopReceiver();rmSync(directory,{recursive:true,force:true});}
},30000);

it('a dropped viewer can reconnect without restart, but cannot take back a later viewer automatically',async()=>{
 const c=await makeReceiverConfig('127.0.0.1','healthkit',0),session=createVaultSession(randomBytes(32));
 await startReceiver(c,session.token,async()=>{throw Error('No private storage needed');});
 const first={id:randomUUID(),reconnect:false},second={id:randomUUID(),reconnect:false};
 try{
  expect(()=>assertReceiverConnection(session.token,{...first,reconnect:true})).not.toThrow();
  const a=subscribeReceiver(session.token,()=>true,()=>{},first);a.stop();
  expect(()=>assertReceiverConnection(session.token,{...first,reconnect:true})).not.toThrow();
  const b=subscribeReceiver(session.token,()=>true,()=>{},{...first,reconnect:true});
  const other=subscribeReceiver(session.token,()=>true,()=>{},second);
  expect(()=>assertReceiverConnection(session.token,{...first,reconnect:true})).toThrow('VIEWER_REPLACED');
  expect(other.renew()).toBe(true);b.stop();expect(other.renew()).toBe(true);other.stop();
  deleteVaultSession(session.token);
  expect(()=>assertReceiverConnection(session.token,{...second,reconnect:true})).toThrow('HEALTHKIT_RECEIVER_REQUIRED');
 }finally{deleteVaultSession(session.token);await stopReceiver();}
},30000);
