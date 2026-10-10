'use client';
import {useState} from 'react';
import styles from './context-native-transfer.module.css';
import {vaultFetch} from '@/lib/vault-access';
import {isNativeTransferKey,nativeTransferErrorMessage} from '@/lib/native-transfer-errors';
import type {NativeSummary} from '@/lib/native-transfer';
import type {Observation} from '@/lib/native-transfer-contract';
import {NativeBatchTiming,NativeBatchTimestamp} from './native-batch-timing';
export function ContextNativeTransfer(){
 const [file,setFile]=useState<File|null>(null),[key,setKey]=useState(''),[busy,setBusy]=useState(false);
 const [items,setItems]=useState<NativeSummary[]>([]),[preview,setPreview]=useState<(NativeSummary&{observations:Observation[]})|null>(null);
 const [message,setMessage]=useState('Ready. Import an encrypted file from the iPhone.');
 async function request(body:object){const r=await vaultFetch('/api/context-native',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok){const error=await r.json().catch(()=>null);throw Error(nativeTransferErrorMessage(error?.code));}return r.json();}
 async function run(work:()=>Promise<void>){setBusy(true);setMessage('Working…');try{await work();}catch(e){setMessage(e instanceof Error?e.message:'Transfer failed.');}finally{setBusy(false);}}
 async function refresh(){setItems(await request({action:'list'}));}
 async function load(){await run(async()=>{
  if(!file||file.size>1_048_604)throw Error('Choose an encrypted batch up to 1 MiB.');
  if(!isNativeTransferKey(key))throw Error('The transfer key must be the 44-character key shown for this batch on your iPhone. Copy only that key, not the surrounding text or your Vault passphrase. Already imported? Open saved transfers instead.');
  const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
  const saved:NativeSummary=await request({action:'stage',envelope:btoa(binary),key:key.trim()});setKey('');setPreview(null);await refresh();setMessage(saved.status==='accepted-evidence'?`Batch ${saved.id.slice(-8)} is already accepted. Download its acknowledgement receipt below.`:`Done. Batch ${saved.id.slice(-8)} saved encrypted. Review that batch below before accepting.`);
 });}
 async function action(item:NativeSummary,action:'preview'|'accept'|'delete'|'receipt'){await run(async()=>{
  const result=await request({action,id:item.id,revision:item.revision});
  if(action==='preview'){setPreview(result);setMessage('Review event time, receipt time and provenance below. Acceptance saves evidence only.');return;}
  if(action==='receipt'){
   const url=URL.createObjectURL(new Blob([JSON.stringify(result)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='storywalker-receipt.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   setMessage('Receipt downloaded. Import it on the iPhone to acknowledge this batch.');return;
  }
  setPreview(null);await refresh();setMessage(action==='accept'?'Done. Evidence saved encrypted; download the receipt for your iPhone. No capture or interpretation was created.':'Deleted. Local source copies removed; old deliveries cannot restore them.');
 });}
 return <details className={styles.panel}><summary>iPhone → private Vault transfer</summary>
  <p>Export a batch from Storywalker on your iPhone. Transfer the encrypted file locally and enter its separate transfer key here. Keep both out of chat, source control and cloud storage. This key is not your Vault passphrase.</p>
  <label>Encrypted iPhone batch <input type="file" accept=".swtransfer,application/octet-stream" disabled={busy} onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
  <label>Separate transfer key <input type="password" autoComplete="off" value={key} disabled={busy} onChange={e=>setKey(e.target.value)}/></label>
  <button disabled={busy||!file||!key} onClick={()=>void load()}>Validate and stage encrypted batch</button>
  <button disabled={busy} onClick={()=>void run(async()=>{await refresh();setPreview(null);setMessage('Saved transfers loaded. Match the batch label when reviewing or downloading a receipt.');})}>Open saved transfers</button>
  <p>Already imported in Safari or another browser? Choose Open saved transfers. Browsers share this Mac’s Vault; each browser needs its own unlock session. You do not need to upload the batch again.</p>
  <p role="status">{message}</p>
  <p>Raw observations are processed on this Mac and stay out of external AI, public XR and fictional capture rules. The separate optional Logfire summary feed can export aggregate health values. File imports never issue notifications.</p>
  {items.map(item=><div key={item.id}>
   <p>Batch {item.id.slice(-8)} · {item.mode==='simulated'?'Fictional device rehearsal':'Private HealthKit evidence'} · {item.count} observations{item.deletionCount>0&&` · ${item.deletionCount} deletions`} · {item.status} · revision {item.revision}<br/><NativeBatchTimestamp item={item}/></p>
   <NativeBatchTiming item={item}/>
   <button disabled={busy||item.status==='deleted'} onClick={()=>void action(item,'preview')}>Review batch</button>
   {item.status==='pending-review'&&<button disabled={busy||preview?.id!==item.id||preview.revision!==item.revision} onClick={()=>void action(item,'accept')}>Accept reviewed source evidence</button>}
   {item.status==='accepted-evidence'&&<button disabled={busy} onClick={()=>void action(item,'receipt')}>Download acknowledgement receipt</button>}
   {item.status!=='deleted'&&<button disabled={busy} onClick={()=>void action(item,'delete')}>Delete batch evidence</button>}
  </div>)}
  {preview&&<section aria-label="Private native evidence review"><h3>Selected evidence · {preview.mode} · batch {preview.id.slice(-8)}</h3><p>{preview.deletionCount} source deletion requests. Missing activity and location remain unknown.</p>
   <NativeBatchTiming item={preview}/>
   <details><summary>Inspect measurements & provenance</summary><div style={{maxHeight:'24rem',overflow:'auto'}} tabIndex={0}><table><caption>Measurement and arrival times, retained exactly as validated</caption><thead><tr><th>Measured</th><th>Received</th><th>Reading</th><th>Mode / quality</th></tr></thead><tbody>{preview.observations.map(o=><tr key={o.id}><td>{o.event_start}</td><td>{o.received_at}</td><td>{o.payload.kind==='heart_rate'?`${o.payload.value} bpm`:''}</td><td>{o.acquisition} · {o.original_offset} · {o.quality.join(', ')}</td></tr>)}</tbody></table></div></details>
  </section>}
 </details>;
}
