'use client';
import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {installVaultUnlock,requestVaultUnlock,safeVaultReturn} from '@/lib/vault-access';
import {VaultPasskeys} from './vault-passkeys';
import css from './vault-access.module.css';
export function VaultAccess(){
 const path=usePathname(),dialog=useRef<HTMLDialogElement>(null),resolve=useRef<((ok:boolean)=>void)|null>(null),returnFocus=useRef<HTMLElement|null>(null);
 const epoch=useRef(0);
 const [requestId,setRequestId]=useState(0);
 const [open,setOpen]=useState(false),[passphrase,setPassphrase]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 function finish(ok:boolean){epoch.current++;const done=resolve.current;resolve.current=null;setPassphrase('');setOpen(false);dialog.current?.close();done?.(ok);returnFocus.current?.focus({preventScroll:true});}
 useEffect(()=>{const remove=installVaultUnlock(()=>new Promise<boolean>(done=>{returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;resolve.current=done;setMessage('');setRequestId(++epoch.current);setOpen(true);}));return()=>{remove();resolve.current?.(false);resolve.current=null;};},[]);
 // Navigating away cancels the pending operation, rather than replaying it later.
 useEffect(()=>{epoch.current++;const done=resolve.current;resolve.current=null;done?.(false);setOpen(false);setPassphrase('');dialog.current?.close();},[path]);
 useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();},[open]);
 async function confirmed(ticket:number){if(ticket!==epoch.current)return;const r=await fetch('/api/vault',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'session-status'})});const data=await r.json();if(ticket!==epoch.current)return;if(!r.ok||!data.session?.active)throw Error('Unlock could not be confirmed. Please try again.');finish(true);}
 async function unlock(){setBusy(true);setMessage('');try{const r=await fetch('/api/vault',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'unlock',passphrase})});setPassphrase('');const data=await r.json();if(!r.ok)throw Error(data.error??'Could not unlock the Vault.');await confirmed(requestId);}catch(error){if(requestId===epoch.current)setMessage(error instanceof Error?error.message:'Could not unlock the Vault.');}finally{setBusy(false);}}
 return <dialog ref={dialog} className={css.dialog} aria-labelledby="inline-vault-title" onCancel={e=>{e.preventDefault();finish(false);}}>{open&&<><header><div><p>CONTINUE WHERE YOU ARE</p><h2 id="inline-vault-title">Unlock your Vault.</h2></div><button type="button" onClick={()=>finish(false)} aria-label="Close Vault unlock">×</button></header><p>Your page and unsaved edits stay here. After unlocking, the action you started will continue automatically.</p><VaultPasskeys compact active={false} onUnlocked={()=>confirmed(requestId)} onLock={async()=>{}}/><details><summary>Use recovery passphrase</summary><form onSubmit={e=>{e.preventDefault();void unlock();}}><label>Vault passphrase<input type="password" autoComplete="current-password" minLength={12} maxLength={512} value={passphrase} onChange={e=>setPassphrase(e.target.value)} required/></label><button type="submit" disabled={busy||passphrase.length<12}>{busy?'Unlocking…':'Unlock and continue'}</button></form></details>{message&&<p role="alert">{message}</p>}<footer><button type="button" onClick={()=>finish(false)}>Keep working without unlocking</button><a href={`/vault?returnTo=${encodeURIComponent(safeVaultReturn(path)??'/research/xr')}`}>Open full Vault settings</a><small>Private access lasts 15 minutes. No passphrase or pending scene is stored in browser storage.</small></footer></>}</dialog>;
}
export function VaultUnlockButton({onUnlocked}:{onUnlocked?:()=>void}){
 const [status,setStatus]=useState('');
 return <><button type="button" onClick={()=>void fetch('/api/vault',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'session-status'})}).then(r=>r.json()).then(data=>data.session?.active?true:requestVaultUnlock()).then(ok=>{if(ok){setStatus('Vault unlocked.');onUnlocked?.();}}).catch(e=>setStatus(e.message))}>Unlock Vault</button>{status&&<span role="status"> {status}</span>}</>;
}
