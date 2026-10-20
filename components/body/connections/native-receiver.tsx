'use client';
import {useEffect,useState} from 'react';
import {receiverRecovery} from '@/lib/native/receiver-errors';
import {vaultFetch} from '@/lib/vault/vault-access';
import css from './context-native-transfer.module.css';
type Status={autoAcceptHealth?:boolean;running:boolean;mode:'simulated'|'healthkit'|null;port:number;addresses:{name:string;address:string}[]};
export function NativeReceiver(){
 const [status,setStatus]=useState<Status|null>(null),[host,setHost]=useState(''),[mode,setMode]=useState('healthkit'),[busy,setBusy]=useState(false),[message,setMessage]=useState('Unlock the Vault and check the receiver to begin setup.');
 const monitoring=status!==null;
 useEffect(()=>{
  if(!monitoring||busy)return;
  const controller=new AbortController();let checking=false;
  async function check(){
   if(document.hidden||checking)return;checking=true;
   try{
    // Status checks never reopen an unlock prompt or extend the Vault session.
    const r=await fetch('/api/context-receiver',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'status'}),cache:'no-store',signal:controller.signal});
    if(controller.signal.aborted)return;
    if(r.status===401){setStatus(null);setMessage('Vault session locked or expired. Check receiver to unlock, then Resume saved pairing.');return;}
    if(!r.ok)throw Error();
    const current:Status=await r.json();if(controller.signal.aborted)return;
    setStatus(current);
    // Preserve actionable operation errors when polling a stopped receiver.
   }catch{if(!controller.signal.aborted){setStatus(null);setMessage('Receiver status unavailable. Check the receiver before retrying on the phone.');}}
   finally{checking=false;}
  }
  const timer=setInterval(()=>void check(),10000);
  document.addEventListener('visibilitychange',check);
  return()=>{controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',check);};
 },[monitoring,busy]);
 async function request(action:string){const r=await vaultFetch('/api/context-receiver',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,host,mode})});const result=await r.json();if(!r.ok)throw Error(receiverRecovery(result.code));return result;}
 async function run(action:string){setBusy(true);try{
  const result=await request(action);
  if(action==='pairing'){
   const url=URL.createObjectURL(new Blob([JSON.stringify(result)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='storywalker-pairing.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   setMessage('Pairing file downloaded. Transfer it locally to your iPhone and import it in Automatic Mac delivery or Sleep observatory. It contains a secret: keep it out of chat/cloud storage; delete the transfer copy after pairing.');
  }else{setStatus(result);if(!host)setHost(result.addresses[0]?.address??'');setMessage(result.pairingUpdated?'Network address updated; queue ownership and acceptance are preserved. Download the current pairing file, import it on the iPhone, then Resume saved pairing.':result.running?(result.autoAcceptHealth?'Receiver listening. Sleep and heart-rate batches are accepted automatically. Waiting phone batches are reconsidered on their next receipt check. No external export is enabled.':'Receiver listening. The phone retrieves receipts after acceptance.'):'Receiver stopped. Phone queue is retained.');}
 }catch(e){setMessage(e instanceof Error?e.message:'Receiver unavailable.');}finally{setBusy(false);}}
 return <details className={css.panel}><summary>Automatic iPhone → Mac delivery</summary>
  <p>Use the same private network. Only the paired phone can send to this separate HTTPS receiver; the main app stays on loopback. The phone pins this Mac’s certificate. Delivery pauses when the Vault locks/expires, the Mac sleeps or either device is offline. Background timing is controlled by iOS.</p>
  <button disabled={busy} onClick={()=>void run('status')}>Check receiver and local addresses</button>
  {status&&<><label>Mac network address <select value={host} onChange={e=>setHost(e.target.value)}>{status.addresses.map(a=><option value={a.address} key={a.address}>{a.name} · {a.address}</option>)}</select></label>
  <label>Pairing source <select value={mode} onChange={e=>setMode(e.target.value)}><option value="simulated">Fictional network rehearsal</option><option value="healthkit">Selected HealthKit queue</option></select></label>
  <button disabled={busy||!host} onClick={()=>void run('create')}>Create new pairing and start receiver</button>
  <button disabled={busy||!host} onClick={()=>void run('update-address')}>Update saved pairing for this address</button>
  <button disabled={busy} onClick={()=>void run('resume')}>Resume saved pairing</button>
  <button disabled={busy} onClick={()=>void run('pairing')}>Download private pairing file</button>
  <button disabled={busy} onClick={()=>void run('stop')}>Stop receiver</button>
  <button disabled={busy} onClick={()=>void run('revoke')}>Revoke pairing</button>
  {status.mode==='healthkit'&&<>
   <p>Automatic sleep & heart-rate acceptance: <strong>{status.autoAcceptHealth?'On':'Off'}</strong></p>
   <button disabled={busy} onClick={()=>void run(status.autoAcceptHealth?'manual-review-health':'auto-accept-health')}>{status.autoAcceptHealth?'Require manual batch acceptance':'Automatically accept sleep & heart-rate batches'}</button>
   <p>Applies to validated HealthKit sleep and heart-rate records from the paired phone, including mixed sources. Already-waiting phone batches are reconsidered automatically. Unknown deletion targets still require review. This saves private evidence only; no external export, diagnosis or forecast. Research keeps its separate source selection. Changing this setting briefly restarts the receiver using the same pairing.</p>
  </>}
  <p>{status.running?'Listening':'Stopped'} · {status.mode??'no active source'} · port {status.port}</p></>}
  <p role="status">{busy?'Working…':message}</p>
  <p>After pairing, incoming batches appear under Open saved transfers below. Review and accept evidence there. HEALTH can separately accept matching Watch sleep batches after your explicit opt-in; interpretations remain descriptive research notes. At most one batch of 200 deliveries waits for review on the phone. Stop retains pairing; revoke removes its Mac credentials. Resume saved pairing after unlocking again. Changing address or source mode requires a new pairing file.</p>
 </details>;
}
