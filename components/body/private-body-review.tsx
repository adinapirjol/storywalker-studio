'use client';
import {HealthSummaryFeed} from '@/components/body/connections/health-summary-feed';
import {HealthThresholdFeed} from '@/components/body/connections/health-threshold-feed';
import {useEffect,useMemo,useRef,useState} from 'react';
import {BodyIncoming} from './body-incoming';
import {BodyContextGuide} from './body-context-guide';
import {NativeReceiver} from '@/components/body/connections/native-receiver';
import {ContextNativeTransfer} from '@/components/body/connections/context-native-transfer';
import {vaultFetch} from '@/lib/vault/vault-access';
import type {NativeSummary} from '@/lib/native/native-transfer';
import {NativeBatchTiming,NativeBatchTimestamp} from '@/components/body/connections/native-batch-timing';
import type {BodyReview,ReviewRule} from '@/lib/body/body-review-contract';
import {privateBodyWindow,nextAcceptedBodyBatch} from '@/lib/body/private-body';
import css from './body-composition.module.css';

type Selection={id:string;revision:number;review:BodyReview};
const initial:ReviewRule={enabled:false,lower_bpm:null,upper_bpm:130,duration_s:60,max_gap_s:30,min_samples:3,hysteresis_bpm:5,cooldown_s:300};
export function PrivateBodyReview(){
 const [items,setItems]=useState<NativeSummary[]>([]),[selection,setSelection]=useState<Selection|null>(null),[busy,setBusy]=useState(false);
 const [rule,setRule]=useState<ReviewRule>(initial),[message,setMessage]=useState('Load accepted HealthKit batches from your encrypted Vault.');
 const [transferEpoch,setTransferEpoch]=useState(0);
 const [follow,setFollow]=useState(false),[lastChecked,setLastChecked]=useState('');
 const seen=useRef(new Set<string>());
 const windows=useMemo(()=>selection?privateBodyWindow(selection.id,selection.revision,selection.review):[],[selection]);
 const epoch=useRef(0),abort=useRef<AbortController|null>(null);
 function clear(){epoch.current++;abort.current?.abort();setSelection(null);setItems([]);setBusy(false);setFollow(false);setLastChecked('');seen.current.clear();}
 useEffect(()=>{
  const hide=()=>{if(document.hidden){clear();setTransferEpoch(v=>v+1);setMessage('Private evidence hidden. Reload accepted batches to continue.');}};
  document.addEventListener('visibilitychange',hide);
  return()=>{epoch.current++;abort.current?.abort();document.removeEventListener('visibilitychange',hide);};
 },[]);
 async function request(body:object,unlock=true,signal?:AbortSignal){
  const r=await (unlock?vaultFetch:fetch)('/api/context-native',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify(body),signal});
  if(!r.ok)throw Error(r.status===401?'Vault locked. Reload and unlock locally.':'Source changed or review could not finish. Reload accepted batches.');
  return r.json();
 }
 async function load(){
  clear();const ticket=epoch.current,controller=new AbortController();abort.current=controller;setBusy(true);
  try{const all:NativeSummary[]=await request({action:'list'},true,controller.signal);if(ticket!==epoch.current)return;
   const accepted=all.filter(s=>s.mode==='healthkit'&&s.status==='accepted-evidence'&&s.count>0);setItems(accepted);
   setMessage(accepted.length?`${accepted.length} accepted HealthKit batches available. Choose one for private playback.`:'No accepted real HealthKit batch is available. Fictional rehearsals are excluded. Use the encrypted iPhone transfer below, review and accept the evidence, then reload.');
  }catch(e){if(ticket===epoch.current)setMessage(e instanceof Error?e.message:'Private source unavailable.');}finally{if(ticket===epoch.current)setBusy(false);}
 }
 async function select(item:Pick<NativeSummary,'id'|'revision'>,nextRule=rule){
  abort.current?.abort();const ticket=++epoch.current,controller=new AbortController();abort.current=controller;setBusy(true);setSelection(null);
  try{const next:Selection=await request({action:'body-review',id:item.id,revision:item.revision,rule:nextRule},true,controller.signal);
   if(ticket!==epoch.current)return;setSelection(next);setMessage('Private evidence loaded. Historical review only; no notifications or canonical memory.');
  }catch(e){if(ticket===epoch.current)setMessage(e instanceof Error?e.message:'Private source unavailable.');}finally{if(ticket===epoch.current)setBusy(false);}
 }
 // Refresh from the same authoritative batch. Lock, deletion, expiry or failure removes the display.
 useEffect(()=>{
  if(!selection)return;
  const ticket=epoch.current,controller=new AbortController();let checking=false;
  const timer=setInterval(async()=>{
   if(checking)return;checking=true;
   try{const next:Selection=await request({action:'body-review',id:selection.id,revision:selection.revision,rule:selection.review.rule},false,controller.signal);
    if(ticket===epoch.current)setSelection(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
    if(ticket!==epoch.current)return;
    setLastChecked(new Date().toLocaleTimeString());
    if(follow){
     const all:NativeSummary[]=await request({action:'list'},false,controller.signal);
     if(ticket!==epoch.current)return;
     const accepted=all.filter(s=>s.mode==='healthkit'&&s.status==='accepted-evidence'&&s.count>0);setItems(accepted);
     const incoming=nextAcceptedBodyBatch(accepted,seen.current);
     if(incoming){
      const reviewed:Selection=await request({action:'body-review',id:incoming.id,revision:incoming.revision,rule:selection.review.rule},false,controller.signal);
      if(ticket!==epoch.current)return;seen.current.add(incoming.id);setSelection(reviewed);
      setMessage('Newly accepted batch loaded and validated by Pydantic. Playback is paused; the applied review rule is unchanged.');
     }
    }
   }catch{if(ticket===epoch.current){clear();setMessage('Private access expired or source changed. Evidence hidden; reload to review current support.');}}
   finally{checking=false;}
  },15000);
  return()=>{clearInterval(timer);controller.abort();};
 },[selection?.id,selection?.revision,selection?.review.rule,follow]);
 return <section className={css.panel} aria-label="Private HealthKit BODY review">
  <BodyIncoming historicalWindows={selection?windows:undefined}/>
  <h2>Connect your private heart-rate evidence</h2>
  <HealthSummaryFeed/>
  <HealthThresholdFeed/>
  <p>This Mac reads one accepted encrypted batch, at most 200 observations. Raw health observations stay local and never enter the public site, Spotify or external AI. The separate Logfire summary control can export aggregate health values when enabled. Switching tabs clears this view.</p>
  <button disabled={busy} onClick={()=>void load()}>Load accepted HealthKit batches</button>{selection&&<button onClick={()=>{clear();setMessage('Private evidence hidden.');}}>Hide private evidence</button>}
  <p role="status">{busy?'Opening private evidence…':message}</p>
  <label className={css.motionToggle}><input type="checkbox" disabled={!selection||busy} checked={follow} onChange={e=>{seen.current=new Set(items.map(i=>i.id));setFollow(e.target.checked);}}/> Follow newly accepted HealthKit batches</label>
  <p>Checks every 15 seconds while this page is visible and unlocked. New batches still require evidence acceptance. Evaluate a rule below first to apply it to future accepted batches. Playback pauses at each batch change; hiding or locking the page stops following. {lastChecked&&`Last successful check: ${lastChecked}.`}</p>
  {items.map(item=><div key={item.id}><button disabled={busy} onClick={()=>void select(item)}>Use HealthKit batch {item.id.slice(-8)} · {item.count} readings</button><NativeBatchTimestamp item={item}/><NativeBatchTiming item={item}/></div>)}
  <BodyContextGuide/>
  <fieldset className={css.persona}><legend>Historical review rule · editable journal settings</legend>
   <p>Editable journal preset: above 130 bpm across 60 seconds, at least three readings, gaps no longer than 30 seconds. This does not establish exercise, emotion or a medical condition. Lower bound is off by default. Nothing runs until you evaluate a selected batch.</p>
   <label>Upper bound (bpm; blank disables)<input type="number" min="1" max="400" value={rule.upper_bpm??''} onChange={e=>setRule({...rule,upper_bpm:e.target.value===''?null:Number(e.target.value)})}/></label>
   <label>Lower bound (bpm; blank disables)<input type="number" min="1" max="400" value={rule.lower_bpm??''} onChange={e=>setRule({...rule,lower_bpm:e.target.value===''?null:Number(e.target.value)})}/></label>
   <label>Sampled duration (seconds)<input type="number" min="0" max="3600" value={rule.duration_s} onChange={e=>setRule({...rule,duration_s:Number(e.target.value)})}/></label>
   <label>Maximum sampling gap (seconds)<input type="number" min="1" max="300" value={rule.max_gap_s} onChange={e=>setRule({...rule,max_gap_s:Number(e.target.value)})}/></label>
   <p>Three readings minimum; 5 bpm recovery margin; five-minute cooldown. Evidence gaps never count as continuous coverage. Rules and markers are temporary and apply only within the selected batch.</p>
   <button disabled={busy||!selection} onClick={()=>{if(selection)void select(selection,{...rule,enabled:true});}}>Evaluate selected history with Pydantic</button>
  </fieldset>
  {selection&&<><p>Workflow: {selection.review.status} · {selection.review.markers.length} review markers · notifications: 0</p>
   {selection.review.markers.map(m=><details key={m.id}><summary>{m.direction==='above'?'Sustained higher readings':'Sustained lower readings'} · awaiting your interpretation</summary><p>{m.start} → {m.end} · {m.evidence_ids.length} source readings. Context window: {m.window_start} → {m.window_end}. Activity, music and location remain unknown. The window may be truncated by batch boundaries.</p></details>)}
  </>}
  <details><summary>Connect future measurements</summary><p>On your paired iPhone, install the current companion, request heart-rate read access, then Start selected collection. The collector saves that opt-in and resumes at launch; HealthKit background scheduling and Watch sync are not guaranteed. Stop collection pauses future reads.</p><p>Pair Automatic iPhone → Mac delivery below, or use encrypted file transfer. Newly collected measurements stay queued until the Mac accepts the evidence and returns a verified receipt. This page refreshes the selected accepted batch every 15 seconds while visible.</p></details>
  <NativeReceiver/>
  <ContextNativeTransfer key={transferEpoch}/>
 </section>;
}
