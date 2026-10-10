import {subscribeReceiver,type ReceiverEvent,type ReceiverConnection} from './native-receiver';
/** A bounded latest-value stream, without replay or sliding Vault expiry. */
export function receiverStream(sessionID:string,signal:AbortSignal,connection?:ReceiverConnection){
 let cleanup=()=>{},drain=()=>{};
 return new ReadableStream<Uint8Array>({
  start(controller){
   const encoder=new TextEncoder();let stopped=false,ticks=0;
   let sample:Extract<ReceiverEvent,{type:'sample'}>|undefined,contact:Extract<ReceiverEvent,{type:'contact'}>|undefined;
   const resources:{subscription?:ReturnType<typeof subscribeReceiver>;timer?:ReturnType<typeof setInterval>}={};
   const dispose=()=>{if(resources.timer)clearInterval(resources.timer);signal.removeEventListener('abort',close);resources.subscription?.stop();sample=undefined;contact=undefined;};
   const close=()=>{if(stopped)return;stopped=true;dispose();try{controller.close();}catch{/* Reader may have cancelled first. */}};
   const finish=(code='STREAM_INTERRUPTED')=>{
    if(stopped)return;stopped=true;dispose();
    // Do not release a buffered private reading after expiry or viewer revocation.
    if((controller.desiredSize??0)<=0){controller.error(Error('STREAM_CLOSED'));return;}
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({type:'closed',code})}\n\n`));controller.close();
   };
   cleanup=close;
   const write=(event:ReceiverEvent)=>controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
   drain=()=>{
    if(stopped||(controller.desiredSize??0)<=0)return;
    if(sample){const next=sample;sample=undefined;write(next);}
    else if(contact){const next=contact;contact=undefined;write(next);}
   };
   const push=(event:ReceiverEvent)=>{
    if(stopped)return false;
    if(event.type==='closed'){finish(event.code);return false;}
    if(event.type==='sample'){sample=event;contact=undefined;}
    else if(sample){
     if(sample.sample?.observation.id===event.id)sample={type:'sample',sample:{...sample.sample,lastContactAt:event.at}};
    }else contact=event;
    drain();return true;
   };
   resources.subscription=subscribeReceiver(sessionID,push,finish,connection);
   if(stopped){resources.subscription.stop();return;}
   signal.addEventListener('abort',close,{once:true});
   if(signal.aborted){close();return;}
   resources.timer=setInterval(()=>{
    if(!resources.subscription?.renew()){finish('VAULT_LOCKED');return;}
    // Keep-alives must not crowd out measurements when the consumer is busy.
    if(++ticks%5===0&&!sample&&!contact&&(controller.desiredSize??0)>0)controller.enqueue(encoder.encode(': connected\n\n'));
   },1000);resources.timer.unref();
  },
  pull(){drain();},
  cancel(){cleanup();},
 });
}
