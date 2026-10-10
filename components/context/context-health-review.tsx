'use client';
import {useState} from 'react';
import {ContextNativeTransfer} from '@/components/body/connections/context-native-transfer';
import {vaultFetch} from '@/lib/vault/vault-access';
export function ContextHealthReview(){
 const [stages,setStages]=useState<Array<{id:string;count:number;status:string}>>([]);
 const [message,setMessage]=useState('Historical import remains separate from the fictional scenario.');
 const [preview,setPreview]=useState<string>();
 async function refresh(){try{const r=await vaultFetch('/api/context-health');if(!r.ok)throw Error('Private review unavailable.');setStages(await r.json());}catch(e){setMessage(e instanceof Error?e.message:'Review unavailable.');}}
 async function action(id:string,action:string){try{const r=await vaultFetch('/api/context-health',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action})});if(!r.ok)throw Error('Action unavailable.');const data=await r.json();if(action==='preview')setPreview(JSON.stringify(data.firstChunk,null,2));else{setPreview(undefined);setMessage(data.status);await refresh();}}catch{setMessage('Private action failed; nothing inferred.');}}
 return <><ContextNativeTransfer/><details><summary>Private Apple Health import review</summary><p>Stage a selected export with the local import tool, then review here. Imports remain historical evidence. They do not produce alerts, life facts or public drafts.</p><button onClick={()=>void refresh()}>Open staged imports</button><p role="status">{message}</p>{stages.map(s=><div key={s.id}><p>{s.count} heart-rate observations · {s.status}</p><button onClick={()=>void action(s.id,'preview')}>Preview first 100 observations</button><button onClick={()=>void action(s.id,'accept')}>Accept source evidence</button><button onClick={()=>void action(s.id,'delete')}>Delete this staged source</button></div>)}{preview&&<details open><summary>Selected private evidence — no external processing</summary><pre style={{maxHeight:'20rem',overflow:'auto'}}>{preview}</pre></details>}</details></>;
}
