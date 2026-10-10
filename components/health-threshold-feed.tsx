'use client';
import {useEffect,useState} from 'react';
import {vaultFetch} from '@/lib/vault-access';
import type {ThresholdRule,ThresholdEvent} from '@/lib/health-event-contract';
const initial:ThresholdRule={lower_bpm:50,upper_bpm:120,resting_baseline_bpm:null,baseline_confirmed:false,relative_delta_bpm:30,sustained_delta_bpm:20,sustained_duration_s:300,rapid_delta_bpm:30,rapid_window_s:120,rest_only:true,duration_s:0,min_samples:2,max_gap_s:60,hysteresis_bpm:5,cooldown_s:300,grouping_s:60};
type Status={enabled:boolean;rule:ThresholdRule;status:string;contextUntil:string|null;sent:number;last:ThresholdEvent|null;lastCandidate:ThresholdEvent|null};
export function HealthThresholdFeed(){
 const [rule,setRule]=useState(initial),[value,setValue]=useState<Status|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function request(body:object,unlock=true){
  const response=await (unlock?vaultFetch:fetch)('/api/context-summary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  if(!response.ok)throw Error('Could not finish. Check your Vault session, rule values and dedicated project credentials. A baseline must come from reviewed resting evidence.');
  return response.json();
 }
 async function run(body:object,loadRule=false){
  setBusy(true);setMessage('');
  try{const next=await request(body);if(!document.hidden){if(next.rule){setValue(next);if(loadRule)setRule(next.rule);}else setMessage(next.status);}}
  catch(error){setMessage((error as Error).message);}finally{setBusy(false);}
 }
 useEffect(()=>{
  let disposed=false;
  const hide=()=>{if(document.hidden)setValue(null);};document.addEventListener('visibilitychange',hide);
  const timer=setInterval(async()=>{if(document.hidden)return;try{const next=await request({action:'threshold-status'},false);if(!disposed)setValue(next);}catch{if(!disposed)setValue(null);}},15000);
  return()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',hide);};
 },[]);
 const update=<K extends keyof ThresholdRule>(key:K,value:ThresholdRule[K])=>setRule(old=>({...old,[key]:value}));
 const number=(key:keyof ThresholdRule,label:string,min:number,max:number,nullable=false)=><label>{label}{' '}<input type="number" min={min} max={max} step="any" value={rule[key]===null?'':String(rule[key])} disabled={busy} onChange={e=>update(key,(e.target.value===''&&nullable?null:Number(e.target.value)) as never)}/></label>;
 const contextActive=!!value?.contextUntil&&Date.parse(value.contextUntil)>Date.now();
 return <details><summary>Research events · thresholds & context</summary>
  <p>Illustrative review settings from your research brief, not personal danger limits or emergency alerts. Pydantic validates locally; deterministic rules create candidates. No LLM is called.</p>
  <p>High: at least the upper marker. Low: below the lower marker. With repeated evidence selected, one sample is insufficient. Missing samples never prove that a condition persisted.</p>
  <div>{number('upper_bpm','Upper review marker · bpm',1,400,true)}{' '}{number('lower_bpm','Lower review marker · bpm',1,400,true)}</div>
  <p><label>Activity context{' '}<select value={rule.rest_only?'rest':'include'} disabled={busy} onChange={e=>update('rest_only',e.target.value==='rest')}><option value="rest">Only when I confirm awake and resting</option><option value="include">Include unknown/activity context · mark confounded</option></select></label></p>
  <p><label>Evidence{' '}<select value={rule.min_samples===1?'single':'repeated'} disabled={busy} onChange={e=>update('min_samples',e.target.value==='single'?1:2)}><option value="repeated">Require multiple supporting observations</option><option value="single">Permit one observation · unconfirmed</option></select></label></p>
  <details><summary>Baseline, persistence & event volume</summary>
   <p>The baseline starts unset. Enter a measured resting baseline only after reviewing sufficient resting evidence; age, weight and BMI are not used to estimate one.</p>
   {number('resting_baseline_bpm','Measured resting baseline · bpm',1,400,true)}
   <p><label><input type="checkbox" checked={rule.baseline_confirmed} disabled={busy} onChange={e=>update('baseline_confirmed',e.target.checked)}/> This baseline comes from my reviewed resting evidence</label></p>
   <p>{number('relative_delta_bpm','Relative elevation · bpm above baseline',1,200)}{' '}{number('sustained_delta_bpm','Sustained elevation · bpm above baseline',1,200)}</p>
   <p>{number('sustained_duration_s','Sustained sampled span · seconds',1,3600)}{' '}{number('duration_s','Absolute/relative sampled span · seconds',0,3600)}</p>
   <p>{number('min_samples','Minimum distinct samples',1,200)}{' '}{number('max_gap_s','Maximum supporting gap · seconds',1,300)}</p>
   <p>{number('rapid_delta_bpm','Observed rapid increase · bpm',1,200)}{' '}{number('rapid_window_s','Maximum comparison gap · seconds',1,120)}</p>
   <p>Rapid-change comparisons require consecutive Watch-attributed samples from the same source, with valid timestamps and no reported poor-signal flag. This does not certify sensor accuracy.</p>
   <p>{number('hysteresis_bpm','Return margin before re-arming · bpm',0,100)}{' '}{number('cooldown_s','Per-marker cooldown · seconds',0,86400)}{' '}{number('grouping_s','Outbound grouping window · seconds',1,120)}</p>
  </details>
  <p>Enabling exports only candidate kind, selected limit, extreme/delta, counts, measured/app-receipt windows, source class and context/support labels to your dedicated Storywalker Logfire project. No source/device IDs, notes, location, listening history or raw observation packets are sent. Events are not accepted evidence or canonical memories.</p>
  <button type="button" disabled={busy} onClick={()=>run({action:'threshold-status'},true)}>Load saved event settings</button>{' '}
  <button type="button" disabled={busy} onClick={()=>run({action:'configure-threshold',enabled:true,rule})}>Save & enable research events</button>{' '}
  <button type="button" disabled={busy} onClick={()=>run({action:'configure-threshold',enabled:false})}>Stop research events</button>
  <p><button type="button" disabled={busy||!value?.enabled} onClick={()=>run({action:'threshold-rest',rest:!contextActive})}>{contextActive?'Clear rest confirmation':'I’m awake and resting · confirm for 10 minutes'}</button>{contextActive&&<> · expires {new Date(value!.contextUntil!).toLocaleTimeString()}</>}</p>
  <p>Rest is your report, not an inference. The confirmation applies only to measurements made after you confirm, expires after ten minutes, and clears when the receiver stops or the session changes. Clear it when you start moving; renew only if still accurate. This window allows the five-minute sampled-span rule to gather support.</p>
  <button type="button" disabled={busy} onClick={()=>run({action:'threshold-test'})}>Send fictional connection test</button>{' '}
  <button type="button" disabled={busy} onClick={async()=>{try{await navigator.clipboard.writeText(JSON.stringify({research_only:true,rule},null,2));setMessage('Research configuration copied. No observations included.');}catch{setMessage('Could not copy the configuration.');}}}>Copy configuration JSON</button>
  <p role="status">{message||value?.status||'Event export is separately controlled. Load saved settings to check its state.'}</p>
  {value&&<p>{value.enabled?'Research event export enabled':'Research event export off'} · {value.sent} accepted in this process.</p>}
  {value&&<p>Saved settings: upper {value.rule.upper_bpm===null?'off':`${value.rule.upper_bpm} bpm`} · lower {value.rule.lower_bpm===null?'off':`${value.rule.lower_bpm} bpm`} · {value.rule.rest_only?'awake/rest confirmation required':'unknown/activity context allowed · marked confounded'}. {JSON.stringify(rule)!==JSON.stringify(value.rule)&&'Your edited fields are not saved yet.'}</p>}
  {value?.lastCandidate&&<details><summary>Latest research candidate · {value.lastCandidate.kind}</summary><p>{value.lastCandidate.support} · {value.lastCandidate.source} · {value.lastCandidate.context} · {value.lastCandidate.sample_count} samples · {new Date(value.lastCandidate.measured_end).toLocaleString()}</p><p>{value.last?.event_id===value.lastCandidate.event_id?'Logfire accepted this event.':'Not confirmed exported.'}</p></details>}
  <p>Only fresh incoming data is evaluated here; no historical backfill. Historical review remains local. A 60-second group and 5-minute cooldown are volume controls, not safety guarantees. Stopping drops unsent candidates; previously sent events may remain in Logfire. No persistent outbox or guaranteed delivery.</p>
 </details>;
}
