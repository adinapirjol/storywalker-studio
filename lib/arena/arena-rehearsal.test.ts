import {expect,it,vi} from 'vitest';
import {validateArenaComposition,type ArenaRehearsal} from './arena-rehearsal';
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>undefined})}));
vi.mock('@/lib/vault/private-vault',()=>({openVaultWithKey:vi.fn(),putVaultRecords:vi.fn()}));
it('rejects anonymous reads and cross-origin requests before opening the Vault',async()=>{
 const {POST}=await import('@/app/api/arena-rehearsal/route');
 const locked=await POST(new Request('http://localhost:3011/api/arena-rehearsal',{method:'POST',headers:{Origin:'http://localhost:3011'},body:JSON.stringify({action:'load'})}));
 expect(locked.status).toBe(401);expect(await locked.json()).toMatchObject({code:'VAULT_LOCKED'});expect(locked.headers.get('cache-control')).toBe('no-store');
 const cross=await POST(new Request('http://localhost:3011/api/arena-rehearsal',{method:'POST',headers:{Origin:'https://example.com'},body:'{}'}));expect(cross.status).toBe(403);
 const vault=await import('@/lib/vault/private-vault');expect(vault.openVaultWithKey).not.toHaveBeenCalled();expect(vault.putVaultRecords).not.toHaveBeenCalled();
});
it('keeps pairings within the retained snapshot and excludes hidden references',()=>{
 const snapshot={channels:[{fragments:[{id:1},{id:2}]}]} as ArenaRehearsal;
 expect(validateArenaComposition({selected:[1,2],hidden:[],note:'Authored pairing'},snapshot).selected).toEqual([1,2]);
 for(const value of [{selected:[3],hidden:[],note:''},{selected:[1,1],hidden:[],note:''},{selected:[1],hidden:[1],note:''}])expect(()=>validateArenaComposition(value,snapshot)).toThrow();
});
