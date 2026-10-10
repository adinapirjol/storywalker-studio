'use client';
import {useState} from 'react';
import {vaultFetch} from '@/lib/vault/vault-access';
import type {XRScene} from '@/lib/xr/xr-scene';
import {XRJourneyRoom} from './xr-journey-room';
import {VaultUnlockButton} from '@/components/vault/vault-access';
type Window={id:string;label:string;start:string;end:string;approximate:boolean;contextCount:number};
export function VaultSubsetDemo(){
 const [windows,setWindows]=useState<Window[]>([]),[ids,setIds]=useState<string[]>([]),[revision,setRevision]=useState('');
 const [scene,setScene]=useState<XRScene>(),[busy,setBusy]=useState(false),[message,setMessage]=useState('Choose up to three existing windows. Only the selection is saved encrypted; source records stay in place.');
 async function load(save=false){setBusy(true);try{
  const response=await vaultFetch('/api/vault-demo',save?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids,revision})}:undefined);
  const data=await response.json();if(!response.ok)throw Error(data.error??'Private demo unavailable.');
  setWindows(data.windows);setRevision(data.revision);setIds(data.selected);setScene(data.scene);
  setMessage(data.saved?'Private demo selection saved in Vault. Source evidence is unchanged. Rehearsal edits below last only in this tab; reloading restores the saved source view.':'Select a coherent window or up to three adjacent windows, then prepare the demo.');
 }catch(e){setMessage(e instanceof Error?e.message:'Private demo unavailable.');}finally{setBusy(false);}}
 return <section className="notebook-card" aria-label="Private Vault subset demo">
  <p>Private rehearsal · existing Vault evidence</p><h2>One window, several possible readings</h2>
  <p>WORLD keeps the source geography. TIME keeps its dates and uncertainty. MEMORY lets you rehearse deliberate placement. BODY and listening are absent from this subset; no health measurements or soundtrack are invented.</p>
  <button disabled={busy} onClick={()=>void load()}>Open private demo sources</button>{' '}<VaultUnlockButton/>
  <p role="status">{busy?'Reading selected local records…':message}</p>
  {!!windows.length&&<details open={!scene}><summary>Selected source windows · {ids.length} of 3</summary><fieldset><legend>Select one to three source windows</legend>{windows.map(w=><label key={w.id} style={{display:'block',marginBlock:8}}><input type="checkbox" checked={ids.includes(w.id)} disabled={busy||(!ids.includes(w.id)&&ids.length>=3)} onChange={()=>{setScene(undefined);setIds(current=>current.includes(w.id)?current.filter(id=>id!==w.id):[...current,w.id]);}}/>{w.label} · {w.start.slice(0,10)} → {w.end.slice(0,10)} · {w.approximate?'approximate bounds':'source interval'} · {w.contextCount} context entries</label>)}</fieldset><button disabled={busy||!ids.length} onClick={()=>void load(true)}>Prepare selected private demo</button></details>}
  {scene&&<><h3>Five-minute walkthrough</h3><ol><li>WORLD: open a window and inspect its actual geographic source.</li><li>TIME: compare its bounds with the attached context; keep approximate dates visible.</li><li>BODY: point out that no measurements are loaded.</li><li>MEMORY: try moving a window. This is composition, not a change to the source geography.</li><li>Close with an unresolved question of your own. Reload to discard rehearsal edits.</li></ol><XRJourneyRoom key={revision+ids.join('|')} scene={scene} decisions={{}} activated={false} saveNotice="Rehearsal edits are not saved. Reopen the private demo to restore its source view." onChange={setScene}/></>}
 </section>;
}
