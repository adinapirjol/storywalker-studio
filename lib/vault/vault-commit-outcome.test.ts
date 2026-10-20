import {afterEach,expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {rmSync} from 'node:fs';
import {join} from 'node:path';
import {createVaultSession,deleteVaultSession,VAULT_SESSION_COOKIE} from './vault-session';
const state=vi.hoisted(()=>({token:undefined as string|undefined,open:vi.fn(),close:vi.fn(),refresh:vi.fn(),sync:vi.fn()}));
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>state.token?{value:state.token}:undefined})}));
vi.mock('./private-vault',async()=>({...await vi.importActual('./private-vault'),openVault:state.open,openVaultWithKey:state.open,closeVault:state.close,refreshVaultDerivedViews:state.refresh}));
vi.mock('@/lib/automation/unlock-sync',()=>({syncAfterUnlock:state.sync}));
vi.mock('@/lib/evidence/private-candidate-import',()=>({preparePrivateCandidateImport:()=>({records:[{id:'candidate:fictional',kind:'reference',capturedAt:'2026-01-01T00:00:00Z',payload:{bundleHash:'fictional-hash',privacy:'private',canonical:false,reviewStatus:'pending'}}],bundleHash:'fictional-hash',snapshotId:'candidate:fictional',candidates:1}),missingCandidateRecords:(records:unknown[])=>records}));
vi.mock('@/lib/evidence/side-quest-import',()=>({prepareSideQuestVaultImport:()=>({records:[{id:'control-room:fictional',kind:'reference',capturedAt:'2026-01-01T00:00:00Z',payload:{text:'FICTIONAL-PRIVATE-CANARY'}}],summary:{entities:1}}),verifySideQuestVaultImport:()=>true}));
import {POST} from '@/app/api/vault/route';
import {openContextSandbox,putVaultRecords,readVaultRecord,type OpenVault} from './private-vault';
let vault:OpenVault|undefined,name:string|undefined,newToken:string|undefined;
afterEach(async()=>{deleteVaultSession(state.token);deleteVaultSession(newToken);if(vault)(await vi.importActual<typeof import('./private-vault')>('./private-vault')).closeVault(vault);if(name)rmSync(join('private-data',name),{recursive:true,force:true});vi.clearAllMocks();vault=undefined;newToken=undefined;});
async function setup(){name='context-sandbox-commit-'+randomUUID();vault=await openContextSandbox(name);putVaultRecords(vault,[{id:"fictional:setup",kind:"reference",capturedAt:"2026-01-01T00:00:00Z",payload:{fictional:true}}]);state.token=createVaultSession(vault.key).token;state.open.mockResolvedValue(vault);}
function request(body:object){return new Request('http://localhost:3000/api/vault',{method:'POST',headers:{host:'localhost:3000',origin:'http://localhost:3000'},body:JSON.stringify(body)});}
it.each([['import-candidate-bundle','candidate:fictional'],['import-side-quest','control-room:fictional']])('acknowledges %s after its write commits and access ends',async(action,id)=>{
 await setup();state.refresh.mockImplementationOnce(()=>{deleteVaultSession(state.token);return {atlas:{imports:[]}};});
 const response=await POST(request({action,consent:true,candidateBundle:{},sideQuest:{}}));
 const body=await response.json();expect(response.status).toBe(409);expect(body).toMatchObject({saved:true,code:'PRIVATE_WRITE_COMMITTED_RELOAD'});
 expect(JSON.stringify(body)).not.toContain('FICTIONAL-PRIVATE-CANARY');expect(body).not.toHaveProperty('summary');expect(readVaultRecord(vault!,id)).toBeDefined();
});
it('returns a rotated authentication cookie without invoking delivery inside unlock',async()=>{
 await setup();state.sync.mockRejectedValueOnce(Error('delivery must not be invoked'));
 const response=await POST(request({action:'unlock',passphrase:'Fictional recovery passphrase only'}));
 expect(response.status).toBe(200);expect(state.sync).not.toHaveBeenCalled();
 const cookie=response.headers.get('set-cookie')!;expect(cookie).toContain(VAULT_SESSION_COOKIE+'=');
 newToken=cookie.match(new RegExp(VAULT_SESSION_COOKIE+'=([^;]+)'))?.[1];
 expect(newToken).toBeDefined();expect(newToken).not.toBe(state.token);
});
