'use client';
import {useEffect,useState} from 'react';
import {vaultFetch} from '@/lib/vault/vault-access';
type Status={enabled:boolean;project:string;status:string;last:{source:string;received_count:number;preferred_count:number;maximum_bpm:number;received_start:string;received_end:string;kind:string}|null};
export function HealthSummaryFeed(){
 const [value,setValue]=useState<Status|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function request(action:'status'|'configure',enabled?:boolean,unlock=true){
  const response=await (unlock?vaultFetch:fetch)('/api/context-summary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,enabled,policy:'reviewed-batch-v2'}),cache:'no-store'});
  if(!response.ok){
   const failure=await response.json().catch(()=>null);
   if(failure?.code==='VAULT_SESSION_EXPIRED')throw Error(action==='configure'&&enabled===true
    ? 'Session expired. This enable request was cancelled. Unlock and check the summary feed before retrying.'
    : 'Session expired. Unlock and check the summary feed before retrying.');
   throw Error('Unlock the Vault to check or change the summary feed.');
  }
  return await response.json() as Status;
 }
 async function refresh(){setBusy(true);try{{const next=await request('status');if(!document.hidden)setValue(next);}setMessage('');}catch(e){setValue(null);setMessage((e as Error).message);}finally{setBusy(false);}}
 async function configure(enabled:boolean){setBusy(true);try{{const next=await request('configure',enabled);if(!document.hidden)setValue(next);}setMessage('');}catch(e){setValue(null);setMessage((e as Error).message);}finally{setBusy(false);}}
 useEffect(()=>{
  let disposed=false;const timer=setInterval(async()=>{if(document.hidden)return;try{const next=await request('status',undefined,false);if(!disposed)setValue(next);}catch{if(!disposed)setValue(null);}},15000);
  const hide=()=>{if(document.hidden)setValue(null);};document.addEventListener('visibilitychange',hide);
  return()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',hide);};
 },[]);
 return <details><summary>Storywalker · private Logfire summaries</summary>
  <p>This separate external feed exports maximum BPM, sample counts and the app-receipt window. Only accepted, reviewed batches are eligible. Enabling allows the separate “Export this reviewed summary” action for this Vault session; staging and Accept never export. Live-window summaries are disabled. Raw observations, notes, location and listening history stay local.</p>
  {value?.project&&<p><a href={value.project} target="_blank" rel="noreferrer">Open configured export project</a></p>}
  <button type="button" onClick={refresh} disabled={busy}>Check summary feed</button>{' '}
  <button type="button" onClick={()=>configure(true)} disabled={busy||value?.enabled===true}>Allow reviewed exports for this session</button>{' '}
  <button type="button" onClick={()=>configure(false)} disabled={busy||value?.enabled===false}>Stop external summaries</button>
  <p role="status">{message||value?.status||'Check the separate summary feed to see its state.'}</p>
  {value&&<p>{value.enabled?'External summaries enabled':'External summaries off'} · original readings remain local.</p>}
  {value?.last&&<p>Latest exported {value.last.kind} · {value.last.source} · maximum {Math.round(value.last.maximum_bpm)} bpm · {value.last.preferred_count} preferred of {value.last.received_count} received · app receipt {new Date(value.last.received_start).toLocaleString()} → {new Date(value.last.received_end).toLocaleString()}</p>}
  <p>Stopping prevents new exports; in-flight or previously sent summaries can remain in Logfire. Old saved settings require explicit reconfirmation; restart or session expiry requires enabling again. Each export needs its own consent. Already delivered external events cannot be recalled. There is no persistent outbox; repeated explicit exports after restart may duplicate a summary.</p>
 </details>;
}
