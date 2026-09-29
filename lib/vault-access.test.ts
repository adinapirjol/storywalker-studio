import {expect,it,vi} from 'vitest';
import {createUnlockGate,fetchWithVaultUnlock,safeVaultReturn} from './vault-access';
const locked=()=>Response.json({code:'VAULT_LOCKED',error:'Locked'},{status:401});
it('resumes a rejected save once with the original payload after unlock',async()=>{
 const input={method:'POST',body:JSON.stringify({action:'save-xr-review',fixture:'unsaved choices'})};
 const send=vi.fn<typeof fetch>().mockResolvedValueOnce(locked()).mockResolvedValueOnce(Response.json({saved:true})),unlock=vi.fn(async()=>true);
 const response=await fetchWithVaultUnlock('/api/vault',input,unlock,send);
 expect(await response.json()).toEqual({saved:true});expect(unlock).toHaveBeenCalledTimes(1);expect(send).toHaveBeenCalledTimes(2);expect(send.mock.calls[1]).toEqual(['/api/vault',input]);
});
it('does not replay writes after cancellation, ordinary errors, network failures or a second lock',async()=>{
 const cancel=vi.fn<typeof fetch>().mockResolvedValue(locked());await expect(fetchWithVaultUnlock('/api/vault',{},async()=>false,cancel)).rejects.toThrow('cancelled');expect(cancel).toHaveBeenCalledTimes(1);
 for(const status of [400,403,500]){const send=vi.fn<typeof fetch>().mockResolvedValue(Response.json({error:'Failure'},{status})),unlock=vi.fn(async()=>true);expect((await fetchWithVaultUnlock('/api/vault',{},unlock,send)).status).toBe(status);expect(unlock).not.toHaveBeenCalled();expect(send).toHaveBeenCalledTimes(1);}
 const network=vi.fn<typeof fetch>().mockRejectedValue(new Error('Network'));await expect(fetchWithVaultUnlock('/api/vault',{},async()=>true,network)).rejects.toThrow('Network');expect(network).toHaveBeenCalledTimes(1);
 const lockedAgain=vi.fn<typeof fetch>().mockImplementation(async()=>locked());expect((await fetchWithVaultUnlock('/api/vault',{},async()=>true,lockedAgain)).status).toBe(401);expect(lockedAgain).toHaveBeenCalledTimes(2);
});
it('shares one unlock prompt for simultaneous requests and respects cancellation',async()=>{
 const gate=createUnlockGate();let finish:(ok:boolean)=>void=()=>{};const prompt=vi.fn(()=>new Promise<boolean>(resolve=>finish=resolve));const remove=gate.install(prompt);
 const a=gate.request(),b=gate.request();expect(a).toBe(b);expect(prompt).toHaveBeenCalledTimes(1);finish(false);expect(await a).toBe(false);remove();await expect(gate.request()).rejects.toThrow('not ready');
 const controller=new AbortController(),send=vi.fn<typeof fetch>().mockImplementation(async()=>locked());
 await expect(fetchWithVaultUnlock('/api/vault',{signal:controller.signal},async()=>{controller.abort();return true;},send)).rejects.toThrow('cancelled');expect(send).toHaveBeenCalledTimes(1);
});
it('allows only known local return pages, never arbitrary URLs, APIs or injected schemes',()=>{
 expect(safeVaultReturn('/research/xr')).toBe('/research/xr');expect(safeVaultReturn('/director')).toBe('/director');
 for(const bad of ['https://example.com','//example.com','javascript:alert(1)','/\\example.com','/api/vault','/vault','/research/xr?private=query','/%2fexample.com',undefined,['/research/xr']])expect(safeVaultReturn(bad)).toBeUndefined();
});
