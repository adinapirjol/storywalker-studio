vi.hoisted(()=>{process.env.STORYWALKER_HEALTH_PROJECT_URL='https://logfire-eu.pydantic.dev/fictional/research';});
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const io=vi.hoisted(()=>({enabled:false,rule:undefined as unknown,symlink:false,credentialGate:undefined as Promise<void>|undefined,events:[] as unknown[],read:vi.fn(),write:vi.fn(),rename:vi.fn(),remove:vi.fn(),evaluate:vi.fn()}));
vi.mock('node:fs/promises',()=>({
 lstat:async(path:string)=>({isSymbolicLink:()=>io.symlink&&path.endsWith('threshold-config.json')}),readFile:io.read,writeFile:io.write,rename:io.rename,
 mkdir:async()=>undefined,chmod:async()=>undefined,unlink:io.remove,
}));
vi.mock('@/lib/native/native-transfer',()=>({evaluateHealthThresholds:io.evaluate}));
import {configureThreshold,thresholdStatus,setThresholdRest,clearThresholdSession,observeThresholdBatch,thresholdPacket,testThresholdConnection,DEFAULT_THRESHOLD_RULE} from './health-threshold';
import {STORYWALKER_PROJECT} from './health-summary';
import type {ThresholdEvent,ThresholdState} from './health-event-contract';
const engine:ThresholdState={watch:{last:null,last_value:null,last_received:null,source_key:'',runs:{}},phone:{last:null,last_value:null,last_received:null,source_key:'',runs:{}}};
const event:ThresholdEvent={event_id:'a'.repeat(64),rule_id:'b'.repeat(64),kind:'absolute-high',direction:'above',source:'watch',context:'author-reported-rest',context_confounded:false,support:'repeated-observations',threshold_bpm:120,extreme_bpm:125,sample_count:2,measured_start:'2030-05-01T12:00:00Z',measured_end:'2030-05-01T12:00:05Z',received_start:'2030-05-01T12:00:00Z',received_end:'2030-05-01T12:00:05Z'};
const batch={version:1 as const,batch_id:'invented',mode:'healthkit' as const,observations:[],deletions:[]};
beforeEach(()=>{
 Reflect.deleteProperty(globalThis,'__storywalkerThreshold');Reflect.deleteProperty(globalThis,'__storywalkerSummary');
 vi.useFakeTimers();vi.setSystemTime(new Date('2030-05-01T12:00:10Z'));vi.stubEnv('NODE_ENV','development');vi.clearAllMocks();
 io.enabled=false;io.rule=DEFAULT_THRESHOLD_RULE;io.symlink=false;io.events=[];io.credentialGate=undefined;
 io.read.mockImplementation(async(path:string)=>{
  if(path.endsWith('threshold-config.json'))return JSON.stringify({version:2,scope:'unreviewed-live',enabled:io.enabled,rule:io.rule,project:STORYWALKER_PROJECT});
  await io.credentialGate;return JSON.stringify({token:'fictional-test-token',project_url:STORYWALKER_PROJECT,logfire_api_url:'https://logfire-eu.pydantic.dev'});
 });
 io.write.mockImplementation(async(_path:string,body:string)=>{const next=JSON.parse(body);io.enabled=next.enabled;io.rule=next.rule;});
 io.rename.mockResolvedValue(undefined);io.remove.mockImplementation(async(path:string)=>{if(path.endsWith('threshold-config.json'))io.enabled=false;});
 io.evaluate.mockImplementation(async(rule:unknown,_state:unknown,input:unknown)=>({rule,state:engine,events:input?io.events:[]}));
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:200})));
});
afterEach(()=>{clearThresholdSession();Reflect.deleteProperty(globalThis,'__storywalkerThreshold');Reflect.deleteProperty(globalThis,'__storywalkerSummary');vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('configuration status reports the saved context mode instead of a generic rest-only claim',async()=>{
 expect((await configureThreshold(true,DEFAULT_THRESHOLD_RULE)).status).toContain('awake/rest confirmation');
 const result=await configureThreshold(true,{...DEFAULT_THRESHOLD_RULE,rest_only:false});
 expect(result.rule.rest_only).toBe(false);expect(result.status).toContain('Unknown/activity context is allowed');
});
it('allowlists candidate fields and excludes raw/source extras',()=>{
 const packet=thresholdPacket([{...event,pipeline:'fresh-live',observations:['PRIVATE-CANARY'],source_id:'PRIVATE-SOURCE',note:'PRIVATE-NOTE'}] as never,1000);
 const text=JSON.stringify(packet);expect(text).not.toContain('PRIVATE-');expect(text).toContain('candidate_only');
 expect(packet.resourceLogs[0].scopeLogs[0].logRecords[0].severityText).toBe('INFO');
});
it('off by default, and invalid/fictional arrivals never export or evaluate',async()=>{
 await observeThresholdBatch(batch,'fresh-live',()=>true);
 await observeThresholdBatch({...batch,mode:'simulated'},'fresh-live',()=>true);
 expect(io.evaluate).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
 expect((await thresholdStatus()).enabled).toBe(false);
});
it('groups only event candidates and rechecks session validity before credential-gated export',async()=>{
 await configureThreshold(true,DEFAULT_THRESHOLD_RULE);io.events=[event];
 let valid=true;await observeThresholdBatch(batch,'fresh-live',()=>valid);
 expect(fetch).not.toHaveBeenCalled();
 let release!:()=>void;io.credentialGate=new Promise<void>(resolve=>{release=resolve;});
 await vi.advanceTimersByTimeAsync(60000);valid=false;release();await vi.advanceTimersByTimeAsync(1);
 expect(fetch).not.toHaveBeenCalled();
});
it('stop clears the pending group and works when credentials/validator are unavailable',async()=>{
 await configureThreshold(true,DEFAULT_THRESHOLD_RULE);io.events=[event];await observeThresholdBatch(batch,'fresh-live',()=>true);
 io.evaluate.mockRejectedValue(new Error('unavailable'));io.credentialGate=new Promise(()=>{});
 const calls=io.evaluate.mock.calls.length;const stopped=await configureThreshold(false);
 expect(stopped.enabled).toBe(false);expect(io.evaluate.mock.calls.length).toBe(calls);
 await vi.advanceTimersByTimeAsync(60000);expect(fetch).not.toHaveBeenCalled();
});
it('sends only grouped candidates and treats explicit server rejection as failure',async()=>{
 await configureThreshold(true,DEFAULT_THRESHOLD_RULE);io.events=[event];await observeThresholdBatch(batch,'fresh-live',()=>true);
 await vi.advanceTimersByTimeAsync(60000);expect(fetch).toHaveBeenCalledOnce();expect((await thresholdStatus()).sent).toBe(1);
 expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).resourceLogs[0].scopeLogs[0].logRecords).toHaveLength(1);
 vi.mocked(fetch).mockResolvedValue(new Response('{"partialSuccess":{"rejectedLogRecords":1}}',{status:200}));
 await observeThresholdBatch(batch,'fresh-live',()=>true);await vi.advanceTimersByTimeAsync(60000);
 expect((await thresholdStatus()).sent).toBe(1);expect((await thresholdStatus()).status).toContain('failed');
});
it('context confirmation expires and cannot survive receiver stop',async()=>{
 const active=await setThresholdRest(true);expect(active.contextUntil).not.toBeNull();
 await vi.advanceTimersByTimeAsync(600001);expect((await thresholdStatus()).contextUntil).toBeNull();
 await setThresholdRest(true);clearThresholdSession();expect((await thresholdStatus()).contextUntil).toBeNull();
});
it('late enable cannot defeat a later stop; symlink configuration is rejected',async()=>{
 let release!:()=>void;io.credentialGate=new Promise<void>(resolve=>{release=resolve;});
 const enabling=configureThreshold(true,DEFAULT_THRESHOLD_RULE);const rejected=expect(enabling).rejects.toThrow('THRESHOLD_SETTING_CHANGED');
 await vi.waitFor(()=>expect(io.read.mock.calls.some(([path])=>path.endsWith('logfire_credentials.json'))).toBe(true));
 const stopping=configureThreshold(false);release();await rejected;expect((await stopping).enabled).toBe(false);
 io.symlink=true;await expect(configureThreshold(false)).rejects.toThrow('UNSAFE_PATH');
});
it('fictional connection test does not enable real-data export and has an explicit test marker',async()=>{
 const result=await testThresholdConnection();expect(result.status).toContain('fictional');expect((await thresholdStatus()).enabled).toBe(false);
 expect(vi.mocked(fetch).mock.calls[0][1]!.body).toContain('synthetic_test');
});
it('expiry during configuration prevents persisting an enable',async()=>{
 let allowed=true,release!:()=>void;io.credentialGate=new Promise<void>(resolve=>{release=resolve;});
 const configuring=configureThreshold(true,DEFAULT_THRESHOLD_RULE,()=>{if(!allowed)throw Error('EXPIRED');});
 const rejected=expect(configuring).rejects.toThrow('EXPIRED');
 await vi.waitFor(()=>expect(io.read.mock.calls.some(([path])=>path.endsWith('logfire_credentials.json'))).toBe(true));
 allowed=false;release();await rejected;expect(io.write).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});
it('expiry during the atomic rename removes the enable setting rather than activating on restart',async()=>{
 let allowed=true;io.rename.mockImplementationOnce(async()=>{allowed=false;});
 await expect(configureThreshold(true,DEFAULT_THRESHOLD_RULE,()=>{if(!allowed)throw Error('EXPIRED');})).rejects.toThrow('EXPIRED');
 expect(io.remove).toHaveBeenCalledWith(expect.stringContaining('threshold-config.json'));
 expect((await thresholdStatus()).enabled).toBe(false);
});
it('stopping aborts an in-flight event export and does not claim acceptance',async()=>{
 await configureThreshold(true,DEFAULT_THRESHOLD_RULE);io.events=[event];
 let signal:AbortSignal|undefined;
 vi.mocked(fetch).mockImplementationOnce(async(_url,options)=>{signal=options?.signal as AbortSignal;return new Promise((_resolve,reject)=>signal!.addEventListener('abort',()=>reject(Error('cancelled'))));});
 await observeThresholdBatch(batch,'fresh-live',()=>true);await vi.advanceTimersByTimeAsync(60000);
 expect(signal?.aborted).toBe(false);await configureThreshold(false);
 expect(signal?.aborted).toBe(true);expect((await thresholdStatus()).sent).toBe(0);
});
it('rechecks the receiver session after reading export settings',async()=>{
 await configureThreshold(true,DEFAULT_THRESHOLD_RULE);io.events=[event];let valid=true;
 await observeThresholdBatch(batch,'fresh-live',()=>valid);
 const original=io.read.getMockImplementation()!;
 io.read.mockImplementation(async(path:string)=>{const result=await original(path);if(path.endsWith('threshold-config.json'))valid=false;return result;});
 await vi.advanceTimersByTimeAsync(60000);expect(fetch).not.toHaveBeenCalled();
});

it('legacy saved consent and restart never enable unreviewed live export',async()=>{
 io.enabled=true;
 const read=io.read.getMockImplementation()!;
 io.read.mockImplementation(async(path:string)=>path.endsWith('threshold-config.json')?JSON.stringify({enabled:true,rule:io.rule,project:STORYWALKER_PROJECT}):read(path));
 await observeThresholdBatch(batch,'fresh-live',()=>true);
 expect((await thresholdStatus()).enabled).toBe(false);expect(fetch).not.toHaveBeenCalled();
 io.read.mockImplementation(read);
 await configureThreshold(true);
 Reflect.deleteProperty(globalThis,'__storywalkerThreshold');
 await observeThresholdBatch(batch,'fresh-live',()=>true);
 expect((await thresholdStatus()).enabled).toBe(false);expect(fetch).not.toHaveBeenCalled();
});
it('current live consent expiry prevents evaluation despite a valid receiver',async()=>{
 let authorized=true;await configureThreshold(true,DEFAULT_THRESHOLD_RULE,()=>{if(!authorized)throw Error('expired');});
 const before=io.evaluate.mock.calls.length;authorized=false;
 await observeThresholdBatch(batch,'fresh-live',()=>true);
 expect(io.evaluate).toHaveBeenCalledTimes(before);expect(fetch).not.toHaveBeenCalled();
});
it('expiry of live consent aborts an in-flight request without claiming recall',async()=>{
 let authorized=true;await configureThreshold(true,DEFAULT_THRESHOLD_RULE,()=>{if(!authorized)throw Error('expired');});io.events=[event];
 let signal:AbortSignal|undefined;
 vi.mocked(fetch).mockImplementation(async(_url,init)=>new Promise((_resolve,reject)=>{
  signal=init?.signal as AbortSignal;signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});
 }));
 await observeThresholdBatch(batch,'fresh-live',()=>true);await vi.advanceTimersByTimeAsync(60000);
 expect(fetch).toHaveBeenCalledOnce();authorized=false;await vi.advanceTimersByTimeAsync(100);
 expect(signal?.aborted).toBe(true);expect((await thresholdStatus()).enabled).toBe(false);
});
