import {expect,it,vi} from 'vitest';
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>undefined})}));
vi.mock('./private-vault',()=>({openVaultWithKey:vi.fn(),putVaultRecords:vi.fn()}));
it('returns a machine-readable lock before opening or mutating the Vault',async()=>{
 const {POST}=await import('../app/api/vault/route');
 const response=await POST(new Request('http://localhost:3011/api/vault',{method:'POST',body:JSON.stringify({action:'save-research-session',researchSession:{study:'refusal',title:'Fixture',note:'Unsaved',entries:[]}})}));
 expect(response.status).toBe(401);expect(response.headers.get('cache-control')).toBe('no-store');expect(await response.json()).toMatchObject({code:'VAULT_LOCKED'});
 const vault=await import('./private-vault');expect(vault.openVaultWithKey).not.toHaveBeenCalled();expect(vault.putVaultRecords).not.toHaveBeenCalled();
});
