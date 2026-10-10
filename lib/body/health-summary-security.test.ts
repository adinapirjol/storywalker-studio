vi.hoisted(()=>{process.env.STORYWALKER_HEALTH_PROJECT_URL='https://logfire-eu.pydantic.dev/fictional/research';});
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({enabled:true,staged:new Map<string,boolean>(),symlink:false,credentialGate:undefined as Promise<void>|undefined,read:vi.fn(),write:vi.fn(),rename:vi.fn(),remove:vi.fn()}));
vi.mock('node:fs/promises',()=>({
 lstat:async(path:string)=>({isSymbolicLink:()=>mock.symlink&&path.endsWith('summary-config.json')}),
 readFile:mock.read,writeFile:mock.write,rename:mock.rename,
 mkdir:async()=>undefined,chmod:async()=>undefined,unlink:mock.remove,
}));
vi.mock('@/lib/native/native-transfer',()=>({summarizeReceivedHealth:async()=>({version:1,summary_id:'a'.repeat(64),source:'watch',received_count:1,preferred_count:1,maximum_bpm:80,received_start:'2030-01-01T00:00:00Z',received_end:'2030-01-01T00:00:00Z'})}));
import {configureSummary,exportReceivedSummary,summaryStatus,STORYWALKER_PROJECT} from './health-summary';
const batch={version:1 as const,batch_id:'fictional-summary-security-test',mode:'healthkit' as const,observations:[],deletions:[]};
beforeEach(async()=>{
 Reflect.deleteProperty(globalThis,'__storywalkerSummary');vi.stubEnv('NODE_ENV','development');
 mock.enabled=true;mock.staged.clear();mock.symlink=false;mock.credentialGate=undefined;vi.clearAllMocks();
 mock.read.mockImplementation(async(path:string)=>{
  if(path.endsWith('summary-config.json'))return JSON.stringify({version:2,scope:'reviewed-batch',enabled:mock.enabled,project:STORYWALKER_PROJECT});
  await mock.credentialGate;return JSON.stringify({token:'fictional-test-token',project_url:STORYWALKER_PROJECT,logfire_api_url:'https://logfire-eu.pydantic.dev'});
 });
 mock.write.mockImplementation(async(path:string,body:string)=>{mock.staged.set(path,JSON.parse(body).enabled);});
 mock.rename.mockImplementation(async(path:string)=>{mock.enabled=mock.staged.get(path)!;mock.staged.delete(path);});
 mock.remove.mockImplementation(async(path:string)=>{if(path.endsWith('summary-config.json'))mock.enabled=false;else mock.staged.delete(path);});
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:200})));
 await configureSummary(true);vi.clearAllMocks();
});
afterEach(()=>{Reflect.deleteProperty(globalThis,'__storywalkerSummary');vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('stopping during credential lookup prevents the outbound request',async()=>{
 let release!:()=>void;mock.credentialGate=new Promise<void>(resolve=>{release=resolve;});
 const pending=exportReceivedSummary(batch,'reviewed-batch',()=>true,true);
 await vi.waitFor(()=>expect(mock.read.mock.calls.some(([path])=>path.endsWith('logfire_credentials.json'))).toBe(true));
 await configureSummary(false);release();await pending;expect(fetch).not.toHaveBeenCalled();
});
it('stopping aborts an in-flight request without claiming its delivery was undone',async()=>{
 let signal:AbortSignal|undefined;
 vi.mocked(fetch).mockImplementation(async(_url,init)=>{
  signal=init?.signal as AbortSignal;
  return new Promise((_resolve,reject)=>signal!.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
 });
 const pending=exportReceivedSummary(batch,'reviewed-batch',()=>true,true);
 await vi.waitFor(()=>expect(fetch).toHaveBeenCalledOnce());
 const stopped=await configureSummary(false);await pending;
 expect(signal?.aborted).toBe(true);expect(stopped.enabled).toBe(false);expect(stopped.status).toContain('Previously exported records remain');
});
it('rejects a symlinked configuration before any write',async()=>{
 mock.symlink=true;await expect(configureSummary(true)).rejects.toThrow('UNSAFE_PATH');
 expect(mock.write).not.toHaveBeenCalled();expect(mock.rename).not.toHaveBeenCalled();
});
it('a delayed enable cannot override a later stop',async()=>{
 let release!:()=>void;mock.credentialGate=new Promise<void>(resolve=>{release=resolve;});
 const enabling=configureSummary(true);const rejected=expect(enabling).rejects.toThrow('SUMMARY_SETTING_CHANGED');
 await vi.waitFor(()=>expect(mock.read).toHaveBeenCalled());
 const stopping=configureSummary(false);release();await rejected;
 expect((await stopping).enabled).toBe(false);expect(mock.enabled).toBe(false);
});

function deferred(){
 let resolve!:()=>void;
 return {promise:new Promise<void>(done=>{resolve=done;}),release:()=>resolve()};
}
async function expectOffAfterRestart(){
 Reflect.deleteProperty(globalThis,'__storywalkerSummary');
 expect((await summaryStatus()).enabled).toBe(false);
 await exportReceivedSummary(batch,'reviewed-batch',()=>true,true);
 expect(fetch).not.toHaveBeenCalled();
}
it('expiry during rename rolls back durable enable and stays off after restart',async()=>{
 mock.enabled=false;let allowed=true;
 const rename=mock.rename.getMockImplementation()!;
 mock.rename.mockImplementationOnce(async(path:string)=>{await rename(path);allowed=false;});
 await expect(configureSummary(true,()=>{if(!allowed)throw Error('EXPIRED');})).rejects.toThrow('EXPIRED');
 expect(mock.remove).toHaveBeenCalledWith(expect.stringContaining('summary-config.json'));
 expect((await summaryStatus()).enabled).toBe(false);
 await expectOffAfterRestart();
});
it('a filesystem rollback failure is surfaced and keeps current-process exports paused',async()=>{
 mock.enabled=false;let allowed=true;
 const rename=mock.rename.getMockImplementation()!;
 mock.rename.mockImplementationOnce(async(path:string)=>{await rename(path);allowed=false;});
 mock.remove.mockRejectedValueOnce(Error('ROLLBACK_FAILED'));
 await expect(configureSummary(true,()=>{if(!allowed)throw Error('EXPIRED');})).rejects.toThrow('ROLLBACK_FAILED');
 expect((await summaryStatus()).enabled).toBe(false);
 await exportReceivedSummary(batch,'reviewed-batch',()=>true,true);expect(fetch).not.toHaveBeenCalled();
 // Failed disk cleanup cannot promise restart safety; do not report success.
 expect(mock.enabled).toBe(true);
});
it('expiry during the final settings read rolls back instead of releasing success',async()=>{
 mock.enabled=false;let allowed=true;
 const read=mock.read.getMockImplementation()!;
 mock.read.mockImplementation(async(path:string)=>{
  const value=await read(path);
  if(path.endsWith('summary-config.json'))allowed=false;
  return value;
 });
 await expect(configureSummary(true,()=>{if(!allowed)throw Error('EXPIRED');})).rejects.toThrow('EXPIRED');
 expect(mock.enabled).toBe(false);
 await expectOffAfterRestart();
});
it('exports remain paused until final settings verification succeeds',async()=>{
 mock.enabled=false;const gate=deferred(),entered=deferred();
 const read=mock.read.getMockImplementation()!;
 mock.read.mockImplementation(async(path:string)=>{
  if(path.endsWith('summary-config.json')){entered.release();await gate.promise;}
  return read(path);
 });
 const configuring=configureSummary(true);
 await entered.promise;
 expect(mock.enabled).toBe(true); // Durable write alone cannot authorize export.
 expect((await summaryStatus()).enabled).toBe(false);
 await exportReceivedSummary(batch,'reviewed-batch',()=>true,true);
 expect(fetch).not.toHaveBeenCalled();
 gate.release();
 expect((await configuring).enabled).toBe(true);
 await exportReceivedSummary(batch,'reviewed-batch',()=>true,true);
 expect(fetch).toHaveBeenCalledOnce();
});
it('a stop during final verification supersedes and rolls back the pending enable',async()=>{
 mock.enabled=false;const gate=deferred(),entered=deferred();
 const read=mock.read.getMockImplementation()!;
 mock.read.mockImplementation(async(path:string)=>{
  if(path.endsWith('summary-config.json')){entered.release();await gate.promise;}
  return read(path);
 });
 const configuring=configureSummary(true);
 const rejected=expect(configuring).rejects.toThrow('SUMMARY_SETTING_CHANGED');
 await entered.promise;
 const stopping=configureSummary(false);
 await exportReceivedSummary(batch,'reviewed-batch',()=>true,true);expect(fetch).not.toHaveBeenCalled();
 gate.release();await rejected;
 expect((await stopping).enabled).toBe(false);
 await expectOffAfterRestart();
});
it('rollback finishes before a later authorized enable can persist',async()=>{
 mock.enabled=false;let allowed=true;const gate=deferred(),entered=deferred();
 const rename=mock.rename.getMockImplementation()!,remove=mock.remove.getMockImplementation()!;
 mock.rename.mockImplementationOnce(async(path:string)=>{await rename(path);allowed=false;});
 mock.remove.mockImplementationOnce(async(path:string)=>{entered.release();await gate.promise;await remove(path);});
 const configuring=configureSummary(true,()=>{if(!allowed)throw Error('EXPIRED');});
 const rejected=expect(configuring).rejects.toThrow('EXPIRED');
 await entered.promise;
 const later=configureSummary(true);
 expect(mock.rename).toHaveBeenCalledOnce();
 gate.release();await rejected;
 expect((await later).enabled).toBe(true);
 Reflect.deleteProperty(globalThis,'__storywalkerSummary');
 expect((await summaryStatus()).enabled).toBe(false); // Restart requires fresh Author consent.
 expect(fetch).not.toHaveBeenCalled();
});
it('overlapping delivery requests share a bounded in-flight dedupe key',async()=>{
 const gate=deferred();mock.credentialGate=gate.promise;
 const first=exportReceivedSummary(batch,'reviewed-batch',()=>true,true);
 await vi.waitFor(()=>expect(mock.read.mock.calls.some(([path])=>path.endsWith('logfire_credentials.json'))).toBe(true));
 expect(await exportReceivedSummary(batch,'reviewed-batch',()=>true,true)).toBe('busy');
 gate.release();expect(await first).toBe('delivered');expect(fetch).toHaveBeenCalledOnce();
});
