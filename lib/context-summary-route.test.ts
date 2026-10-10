import {afterEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {createVaultSession,deleteVaultSession} from './vault-session';
vi.mock('./health-summary',()=>({summaryStatus:vi.fn(async()=>({enabled:false,last:null})),configureSummary:vi.fn(async(enabled:boolean)=>({enabled,last:null}))}));
vi.mock('./health-threshold',()=>({thresholdStatus:vi.fn(async()=>({enabled:false})),configureThreshold:vi.fn(async()=>({enabled:true})),setThresholdRest:vi.fn(async()=>({contextUntil:null})),testThresholdConnection:vi.fn(async()=>({status:'fictional test accepted'}))}));
import {configureSummary} from './health-summary';
import {configureThreshold,thresholdStatus,testThresholdConnection} from './health-threshold';
import {POST} from '../app/api/context-summary/route';
let token:string|undefined;
afterEach(()=>{deleteVaultSession(token);token=undefined;vi.clearAllMocks();});
function request(body:unknown,origin='http://127.0.0.1:3000'){
 return new NextRequest('http://127.0.0.1:3000/api/context-summary',{method:'POST',headers:{Origin:origin,Host:'127.0.0.1:3000','Content-Type':'application/json',...(token?{Cookie:`storywalker_vault_session=${token}`}:{})},body:JSON.stringify(body)});
}
describe('private external-summary controls',()=>{
 it('requires an unlocked local Vault',async()=>{expect((await POST(request({action:'status'}))).status).toBe(401);expect(configureSummary).not.toHaveBeenCalled();});
 it('rejects foreign origins even with an unlocked Vault',async()=>{token=createVaultSession(Buffer.alloc(32,1)).token;expect((await POST(request({action:'configure',enabled:true},'https://example.com'))).status).toBe(403);expect(configureSummary).not.toHaveBeenCalled();});
 it('allows explicit enable or stop without accepting health payloads',async()=>{
  token=createVaultSession(Buffer.alloc(32,1)).token;
  const response=await POST(request({action:'configure',enabled:true}));expect(response.status).toBe(200);expect(configureSummary).toHaveBeenCalledWith(true,expect.any(Function));
  expect((await POST(request({action:'emit',observations:[{bpm:120}]}))).status).toBe(422);
 });
 it('authorizes only local configuration/context/test actions and rejects invented observation submission',async()=>{
  token=createVaultSession(Buffer.alloc(32,1)).token;
  expect((await POST(request({action:'configure-threshold',enabled:true,rule:{upper_bpm:120}}))).status).toBe(200);
  expect(configureThreshold).toHaveBeenCalledWith(true,{upper_bpm:120},expect.any(Function));
  expect((await POST(request({action:'threshold-rest',rest:true}))).status).toBe(200);
  expect((await POST(request({action:'threshold-test'}))).status).toBe(200);expect(testThresholdConnection).toHaveBeenCalledOnce();
  expect((await POST(request({action:'threshold-emit',observations:[{bpm:120}]}))).status).toBe(422);
 });
 it('does not disclose threshold state after expiry during an asynchronous read',async()=>{
  token=createVaultSession(Buffer.alloc(32,1)).token;
  let release!:(value:Awaited<ReturnType<typeof thresholdStatus>>)=>void;
  vi.mocked(thresholdStatus).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
  const result=POST(request({action:'threshold-status'}));
  await vi.waitFor(()=>expect(release).toBeTypeOf('function'));deleteVaultSession(token);release({enabled:false} as Awaited<ReturnType<typeof thresholdStatus>>);
  expect((await result).status).toBe(401);
 });
});
