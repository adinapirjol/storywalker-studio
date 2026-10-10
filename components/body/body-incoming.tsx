'use client';
import {useEffect,useRef,useState} from 'react';
import {BodyComposition} from './body-composition';
import {liveBodyWindows,liveSampleStatus,type BodyLiveSample} from '@/lib/body/body-live';
import {receiverRecovery} from '@/lib/native/receiver-errors';
import {vaultFetch} from '@/lib/vault/vault-access';
import type {ContextState} from '@/lib/context/context-contract';
import fixture from '@/lib/body/body-preview.fictional.json';
import css from './body-composition.module.css';
import {followReceiver} from '@/lib/native/receiver-client';
import type {BodyWindow} from '@/lib/body/body-composition';

export function BodyIncoming({historicalWindows}:{historicalWindows?:BodyWindow[]}){
 const [enabled,setEnabled]=useState(false),[sample,setSample]=useState<BodyLiveSample|null>(null),[now,setNow]=useState(Date.now());
 const [connected,setConnected]=useState(false);
 const [starting,setStarting]=useState(false);const startAbort=useRef<AbortController|null>(null);
 useEffect(()=>()=>startAbort.current?.abort(),[]);
 const [message,setMessage]=useState('Go live resumes your saved HealthKit pairing and opens the companion. Unlock locally if prompted.');
 useEffect(()=>{
  if(!enabled)return;
  let stopped=false;const controller=new AbortController();
  const hide=()=>{if(document.hidden){stopped=true;controller.abort();setSample(null);setConnected(false);setEnabled(false);setMessage('Incoming view stopped while hidden. Enable it again to resume.');}};
  void followReceiver({signal:controller.signal,onEvent:event=>{
   if(stopped)return;
   if(event.type==='sample')setSample(event.sample);
   if(event.type==='contact')setSample(previous=>previous?.observation.id===event.id?{...previous,lastContactAt:event.at}:previous);
   setNow(Date.now());
  },onState:state=>{
   if(stopped)return;setConnected(state.phase==='connected');setMessage(state.message);
   if(state.phase!=='connected')setSample(null);
   if(state.phase==='stopped')setEnabled(false);
  }});
  const clock=setInterval(()=>setNow(Date.now()),1000);
  document.addEventListener('visibilitychange',hide);
  return()=>{stopped=true;controller.abort();clearInterval(clock);document.removeEventListener('visibilitychange',hide);};
 },[enabled]);
 async function start(){
  if(starting)return;
  const controller=new AbortController();startAbort.current=controller;
  setStarting(true);setMessage('Connecting… unlock your Vault locally if prompted. Resuming the saved receiver.');
  try{const response=await vaultFetch('/api/context-receiver',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'follow'}),cache:'no-store',signal:controller.signal});
   const result=await response.json().catch(()=>null);
   if(!response.ok)throw Error(receiverRecovery(result?.code));
   if(controller.signal.aborted||document.hidden)return;setSample(null);setConnected(false);setEnabled(true);
  }catch(error){if(!controller.signal.aborted)setMessage(error instanceof Error?error.message:'Connection unavailable. Click Go live to retry.');}
  finally{if(!controller.signal.aborted)setStarting(false);}
 }

 return <section className={css.panel} aria-label="Incoming Watch companion">
  <h3>Your Watch → your companion</h3>
  <p>On your iPhone, enable collection and automatic delivery, then Start companion feed. Keep both devices on the same private network and the Mac awake with its Vault unlocked.</p>
  <button className={css.liveButton} aria-pressed={enabled} disabled={starting} onClick={()=>{if(enabled){setEnabled(false);setConnected(false);setSample(null);setMessage('Incoming view stopped.');}else void start();}}>{starting?'Connecting live…':enabled?(connected?'● LIVE · Stop':'Reconnecting… · Stop'):'DANGER ZONE · Go live'}</button>
  <p className={css.liveCaption}>Experimental live input · this switches the pet from recorded playback to arriving Watch measurements. “Danger Zone” names the control, not a health assessment.</p>
  <p role="status">{enabled&&connected?liveSampleStatus(sample,now):message}</p>
  <p>New readings are pushed directly to this temporary view while it is visible. Older readings retain a last-known pose with their measurement age. After two minutes, or 15 seconds without phone delivery, it is explicitly marked not current. Hiding this view, locking the Vault or stopping Follow clears it. These are display freshness limits, not medical thresholds. Watch sampling and iPhone sync are not continuous. Incoming previews are not accepted evidence and do not create notifications or memories.</p>
  {enabled&&<><details><summary>Inspect connection timing</summary>{sample?<>
    <p>Watch measured: {sample.observation.event_start}<br/>iPhone app received: {sample.observation.received_at}<br/>First Mac preview arrival: {sample.arrivedAt}<br/>Latest phone contact: {sample.lastContactAt??sample.arrivedAt}</p>
    <p>Watch measurement → iPhone app: {Math.round((Date.parse(sample.observation.received_at)-Date.parse(sample.observation.event_start))/1000)} seconds. iPhone app → first Mac preview: {Math.round((Date.parse(sample.arrivedAt)-Date.parse(sample.observation.received_at))/1000)} seconds. These are timestamp differences across device clocks, not measured network ping times. They include syncing, scheduling and any time the feed was off; individual causes cannot be separated here.</p>
   </>:<p>No reading received in this session.</p>}</details>

  </>}
  {(enabled||historicalWindows)&&<BodyComposition state={fixture as ContextState} privateWindows={enabled?liveBodyWindows(sample,now):historicalWindows} incoming={enabled} onGoLive={()=>void start()} liveConnecting={starting}/>}
 </section>;
}
