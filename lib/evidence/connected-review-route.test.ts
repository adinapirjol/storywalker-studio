import { afterEach, expect, it, vi } from 'vitest';
import { createVaultSession, deleteVaultSession, readVaultSession } from '@/lib/vault/vault-session';
const state=vi.hoisted(()=>({token:undefined as string|undefined,catalog:vi.fn(),page:vi.fn(),save:vi.fn()}));
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>state.token?{value:state.token}:undefined})}));
vi.mock('@/lib/evidence/connected-review-store',()=>({connectedReviewCatalog:state.catalog,connectedReviewPage:state.page,saveConnectedProposal:state.save,ReviewConflict:class extends Error{}}));
import { GET, POST } from '@/app/api/private-review/route';
const request=(method='GET',host='localhost:3000',origin='http://localhost:3000')=>new Request('http://localhost:3000/api/private-review?view=evidence',{method,headers:{host,...(method==='POST'?{origin}:{})},...(method==='POST'?{body:JSON.stringify({action:'review-bundle-proposal'})}:{})});
afterEach(()=>{deleteVaultSession(state.token);state.token=undefined;vi.clearAllMocks();});
it('denies new connected reads and writes before any source access while locked or from a foreign origin',async()=>{
 expect((await GET(request())).status).toBe(401);expect((await POST(request('POST'))).status).toBe(401);
 state.token=createVaultSession(Buffer.alloc(32,1)).token;
 expect((await GET(request('GET','foreign.example'))).status).toBe(403);expect((await POST(request('POST','localhost:3000','https://foreign.example'))).status).toBe(403);
 expect(state.catalog).not.toHaveBeenCalled();expect(state.save).not.toHaveBeenCalled();
});
it('rechecks access before releasing a source read that completed after lock',async()=>{
 state.token=createVaultSession(Buffer.alloc(32,1)).token;let release!:(v:unknown)=>void;
 state.catalog.mockImplementationOnce(()=>new Promise(r=>{release=r;}));
 const pending=GET(request());await vi.waitFor(()=>expect(state.catalog).toHaveBeenCalledOnce());deleteVaultSession(state.token);release({fictional:'private canary'});
 const result=await pending;expect(result.status).toBe(401);expect(await result.json()).toMatchObject({code:'VAULT_SESSION_EXPIRED'});
});
it('releases only no-store data and expiry, leaving the live encryption key intact',async()=>{
 const key=Buffer.alloc(32,7);state.token=createVaultSession(key).token;state.catalog.mockResolvedValueOnce({packages:[],selected:null,scopes:[],total:0,fragments:0,excluded:0});
 const result=await GET(request());expect(result.status).toBe(200);expect(result.headers.get('cache-control')).toBe('no-store');expect((await result.json()).expiresAt).toBeDefined();
 const session=readVaultSession(state.token)!;expect(session.key).toEqual(key);session.key.fill(0);
});
it('rejects malformed pagination before source access',async()=>{
 state.token=createVaultSession(Buffer.alloc(32,1)).token;
 const result=await GET(new Request('http://localhost:3000/api/private-review?view=evidence&offset=-1'));expect(result.status).toBe(400);expect(state.catalog).not.toHaveBeenCalled();
});
