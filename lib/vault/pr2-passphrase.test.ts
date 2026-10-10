/** Fictional session key and mocked Vault: no real credentials or database access. */
import {afterEach,expect,it,vi} from 'vitest';
const io=vi.hoisted(()=>({token:'',open:vi.fn(),put:vi.fn(),guard:vi.fn(),cookies:vi.fn()}));
vi.mock('next/headers',()=>({cookies:io.cookies}));
vi.mock('./private-vault',async original=>({...await original<typeof import('./private-vault')>(),openVault:io.open,putVaultRecords:io.put,setVaultAccessGuard:io.guard,closeVault:vi.fn(),vaultSummary:()=>({}),refreshVaultDerivedViews:()=>({})}));
import {POST} from '@/app/api/vault/route';
import {createVaultSession,deleteVaultSession,vaultSessionActive} from './vault-session';
afterEach(()=>{const sessions=(globalThis as typeof globalThis&{__storywalkerVaultSessions:Map<string,unknown>}).__storywalkerVaultSessions;for(const token of sessions.keys())deleteVaultSession(token);vi.clearAllMocks();});
it.each(['capture','lock-session','probe'])('L1: %s rejects passphrases without session or mutation side effects',async action=>{
 io.token=createVaultSession(Buffer.alloc(32,7)).token;
 io.cookies.mockResolvedValue({get:()=>({value:io.token})});io.open.mockResolvedValue({key:Buffer.alloc(32,7)});
 const sessions=(globalThis as typeof globalThis&{__storywalkerVaultSessions:Map<string,unknown>}).__storywalkerVaultSessions;
 const before=[...sessions.keys()];
 const response=await POST(new Request('http://localhost:3000/api/vault',{method:'POST',headers:{host:'localhost:3000',origin:'http://localhost:3000'},body:JSON.stringify({action,passphrase:'fictional-recovery-passphrase',capture:{title:'Fictional',kind:'idea',status:'planned',when:'',evidence:'invented',threads:[]}})}));
 expect({status:response.status,active:vaultSessionActive(io.token),sessions:[...sessions.keys()],opens:io.open.mock.calls.length,mutations:io.put.mock.calls.length}).toEqual({status:400,active:true,sessions:before,opens:0,mutations:0});
 expect(response.headers.get('set-cookie')).toBeNull();
});
