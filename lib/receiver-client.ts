import type {ReceiverEvent} from './native-receiver';
import {receiverRecovery} from './receiver-errors';
type FeedState={phase:'connected'|'retrying'|'stopped';message:string};
class FeedFailure extends Error {
 constructor(readonly code:string,readonly retryable=false){super(code);}
}
function delay(ms:number,signal:AbortSignal){
 return new Promise<void>(resolve=>{
  if(signal.aborted){resolve();return;}
  const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',done);resolve();};
  const timer=setTimeout(done,ms);signal.addEventListener('abort',done,{once:true});
 });
}
/** Reconnects only this viewer, using its existing cookie. Never restarts a receiver or unlocks a Vault. */
export async function followReceiver({signal,onEvent,onState,fetcher=fetch,viewerID=crypto.randomUUID()}:{signal:AbortSignal;onEvent:(event:ReceiverEvent)=>void;onState:(state:FeedState)=>void;fetcher?:typeof fetch;viewerID?:string}){
 let retries=0;
 while(!signal.aborted){
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
  let failure:FeedFailure|undefined;
  try{
   const response=await fetcher('/api/context-receiver/stream',{method:'POST',cache:'no-store',signal,headers:{'X-Storywalker-Viewer':viewerID,...(retries?{'X-Storywalker-Reconnect':'1'}:{})}});
   if(!response.ok){
    const error=await response.json().catch(()=>null);
    if(response.status===401||response.status===423)throw new FeedFailure('VAULT_LOCKED');
    if(response.status>=500)throw new FeedFailure('STREAM_INTERRUPTED',true);
    throw new FeedFailure(error?.code??'STREAM_INVALID');
   }
   if(!response.body)throw new FeedFailure('STREAM_INVALID');
   onState({phase:'connected',message:'Connected to incoming Watch readings.'});
   reader=response.body.getReader();const decoder=new TextDecoder();let buffer='';
   while(!signal.aborted){
    const chunk=await reader.read();if(signal.aborted)return;
    if(chunk.done)throw new FeedFailure('STREAM_INTERRUPTED',true);
    buffer+=decoder.decode(chunk.value,{stream:true});
    if(buffer.length>262144)throw new FeedFailure('STREAM_INVALID');
    let boundary:number;
    while((boundary=buffer.indexOf('\n\n'))>=0){
     const frame=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);
     const data=frame.split('\n').find(line=>line.startsWith('data: '));if(!data)continue;
     let event:ReceiverEvent;
     try{event=JSON.parse(data.slice(6));}catch{throw new FeedFailure('STREAM_INVALID');}
     if(!event||!['closed','sample','contact'].includes(event.type))throw new FeedFailure('STREAM_INVALID');
     if(event.type==='closed')throw new FeedFailure(event.code,event.code==='STREAM_INTERRUPTED');
     onEvent(event);
    }
   }
  }catch(error){failure=error instanceof FeedFailure?error:new FeedFailure('STREAM_INTERRUPTED',true);}
  finally{await reader?.cancel().catch(()=>{});reader?.releaseLock();}
  if(signal.aborted)return;
  if(!failure?.retryable||retries>=3){onState({phase:'stopped',message:receiverRecovery(failure?.code??'STREAM_INTERRUPTED')});return;}
  retries++;
  onState({phase:'retrying',message:`Live connection interrupted · reconnecting (${retries}/3). Saved research settings are unchanged.`});
  await delay(1000*2**(retries-1),signal);
 }
}
