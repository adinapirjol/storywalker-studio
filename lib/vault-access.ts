/** Unlock coordination keeps pending work in this tab, never in browser storage. */
type Prompt=()=>Promise<boolean>;
export function createUnlockGate(){
 let prompt:Prompt|undefined,pending:Promise<boolean>|undefined;
 return {
  install(next:Prompt){prompt=next;return()=>{if(prompt===next)prompt=undefined;};},
  request(){if(pending)return pending;if(!prompt)return Promise.reject(new Error('Vault unlock is not ready. Try again.'));pending=prompt().finally(()=>{pending=undefined;});return pending;},
 };
}
const gate=createUnlockGate();
export const installVaultUnlock=gate.install;
export const requestVaultUnlock=gate.request;
/** A 401 + VAULT_LOCKED is emitted before any Vault action. Never retry other
 * failures: a network error may follow a successful write. */
export async function fetchWithVaultUnlock(input:RequestInfo|URL,init:RequestInit|undefined,unlock:Prompt,send:typeof fetch=fetch){
 const first=await send(input,init);
 if(first.status!==401)return first;
 const data=await first.clone().json().catch(()=>null);
 if(data?.code!=='VAULT_LOCKED')return first;
 if(init?.signal?.aborted)throw new DOMException('Request cancelled','AbortError');
 if(!await unlock())throw new Error('Unlock cancelled. Your unsaved work is still here; nothing was saved.');
 if(init?.signal?.aborted)throw new DOMException('Request cancelled','AbortError');
 return send(input,init); // exactly one retry, including saves rejected before execution
}
export function vaultFetch(input:RequestInfo|URL,init?:RequestInit){return fetchWithVaultUnlock(input,init,requestVaultUnlock);}
const returnPaths=new Set(['/','/atlas','/director','/field-trace','/voice','/scenario-studio','/private-review','/research','/research/xr','/research/refusal','/research/echo-lab','/research/linz']);
export function safeVaultReturn(value:unknown){return typeof value==='string'&&returnPaths.has(value)?value:undefined;}
