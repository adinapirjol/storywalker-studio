/** Server-only, opt-in research candidates. No raw observation telemetry. */
import {readFile,writeFile,lstat,mkdir,chmod,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {evaluateHealthThresholds} from './native-transfer';
import type {ValidatedTransfer} from './native-transfer-contract';
import type {ThresholdRule,ThresholdState,ThresholdEvent,RestContext} from './health-event-contract';
import {healthExportDirectory,healthExportCredential,safeHealthExportPaths,STORYWALKER_PROJECT} from './health-summary';
export const DEFAULT_THRESHOLD_RULE:ThresholdRule={lower_bpm:50,upper_bpm:120,resting_baseline_bpm:null,baseline_confirmed:false,relative_delta_bpm:30,sustained_delta_bpm:20,sustained_duration_s:300,rapid_delta_bpm:30,rapid_window_s:120,rest_only:true,duration_s:0,min_samples:2,max_gap_s:60,hysteresis_bpm:5,cooldown_s:300,grouping_s:60};
const configPath=join(healthExportDirectory,'threshold-config.json');
type Candidate=ThresholdEvent&{pipeline:'fresh-live'|'fresh-received-batch'};
type Pending={event:Candidate;valid:()=>boolean};
type State={generation:number;paused:boolean;engine?:ThresholdState;context:RestContext|null;queue:Promise<void>;pendingWork:number;configuration?:Promise<unknown>;timer?:ReturnType<typeof setTimeout>;events:Pending[];controllers:Set<AbortController>;status:string;last?:Candidate;sent:number;lastCandidate?:Candidate};
const shared=globalThis as typeof globalThis&{__storywalkerThreshold?:State};
function state(){return shared.__storywalkerThreshold??=({generation:0,paused:false,context:null,queue:Promise.resolve(),pendingWork:0,events:[],controllers:new Set(),status:'Research event feed off.',sent:0});}
async function settings(){
 try{
  await safeHealthExportPaths();if((await lstat(configPath)).isSymbolicLink())throw Error('UNSAFE_PATH');
  const value=JSON.parse(await readFile(configPath,'utf8'));
  if(value.project!==STORYWALKER_PROJECT||typeof value.enabled!=='boolean'||!value.rule)throw Error('INVALID_SETTING');
  return value as {enabled:boolean;rule:ThresholdRule};
 }catch{return {enabled:false,rule:DEFAULT_THRESHOLD_RULE};}
}
export async function thresholdStatus(){
 const s=state(),saved=await settings();
 const context=s.context&&Date.parse(s.context.end)>Date.now()?s.context:null;
 const enabled=!s.paused&&saved.enabled;
 const status=enabled&&s.status==='Research event feed off.'?'Research events enabled; waiting for fresh input and current context.':s.status;
 return {enabled,rule:saved.rule,project:STORYWALKER_PROJECT,status,contextUntil:context?.end??null,last:s.last??null,lastCandidate:s.lastCandidate??null,sent:s.sent};
}
/** Clears ephemeral support/unsent candidates; cannot recall records already sent. */
export function clearThresholdSession(clearContext=true){
 const s=state();s.generation++;if(s.timer)clearTimeout(s.timer);s.timer=undefined;s.events=[];s.engine=undefined;
 for(const controller of s.controllers)controller.abort();s.controllers.clear();
 if(clearContext)s.context=null;
 s.last=undefined;s.lastCandidate=undefined;
 s.status='Research session cleared; unsent candidates dropped. Await fresh input and current context.';
}
export function configureThreshold(enabled:boolean,rule?:unknown,check:()=>void=()=>{}){
 const s=state();check();s.paused=true;clearThresholdSession();const generation=s.generation;
 const next=(s.configuration??Promise.resolve()).then(async()=>{
  check();const validated=!enabled&&rule===undefined?{rule:(await settings()).rule}:await evaluateHealthThresholds(rule??DEFAULT_THRESHOLD_RULE,undefined);check();
  if(enabled){await healthExportCredential();check();}
  if(s.generation!==generation)throw Error('THRESHOLD_SETTING_CHANGED');
  await mkdir(healthExportDirectory,{recursive:true,mode:0o700});await safeHealthExportPaths();check();
  await chmod(join(process.cwd(),'.logfire'),0o700);await chmod(healthExportDirectory,0o700);
  try{if((await lstat(configPath)).isSymbolicLink())throw Error('UNSAFE_PATH');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const temporary=join(healthExportDirectory,`threshold-config-${randomUUID()}.tmp`);
  let persisted=false;
  try{
   check();if(s.generation!==generation)throw Error('THRESHOLD_SETTING_CHANGED');
   await writeFile(temporary,JSON.stringify({enabled,rule:validated.rule,project:STORYWALKER_PROJECT}),{mode:0o600,flag:'wx'});
   check();if(s.generation!==generation)throw Error('THRESHOLD_SETTING_CHANGED');
   await rename(temporary,configPath);persisted=true;
   check();if(s.generation!==generation)throw Error('THRESHOLD_SETTING_CHANGED');
   s.paused=!enabled;s.sent=0;
   s.status=enabled?(validated.rule.rest_only?'Research events enabled. Waiting for your current awake/rest confirmation.':'Research events enabled. Unknown/activity context is allowed and marked confounded; waiting for fresh supporting readings.'):'Research events off. Previously exported records remain in Logfire.';
   const result=await thresholdStatus();check();
   if(s.generation!==generation)throw Error('THRESHOLD_SETTING_CHANGED');
   return result;
  }catch(error){
   // A revoked session must not leave an enable setting that activates after restart.
   s.paused=true;
   if(persisted)await unlink(configPath);
   throw error;
  }finally{if(!persisted)await unlink(temporary).catch(()=>undefined);}
 });
 s.configuration=next.catch(()=>undefined);return next;
}
/** Ten minutes allows a five-minute sampled span without implying ongoing sensor coverage. */
export function setThresholdRest(rest:boolean){
 clearThresholdSession();const s=state(),now=Date.now();
 s.context=rest?{start:new Date(now).toISOString(),end:new Date(now+600_000).toISOString()}:null;
 s.status=rest?'Awake/rest context confirmed for ten minutes; waiting for fresh supporting observations.':'Rest context cleared; rest-only events wait for a new confirmation.';
 return thresholdStatus();
}
export function thresholdPacket(events:Candidate[],now=Date.now(),test=false){
 return {resourceLogs:[{resource:{attributes:[{key:'service.name',value:{stringValue:'storywalker-body'}},{key:'deployment.environment.name',value:{stringValue:'personal-summary'}}]},scopeLogs:[{scope:{name:'storywalker.research-threshold'},logRecords:events.map(e=>({timeUnixNano:String(BigInt(now)*BigInt(1_000_000)),severityNumber:9,severityText:'INFO',body:{stringValue:test?'Storywalker fictional event connection test':'Storywalker research threshold candidate'},attributes:[
  {key:'event_id',value:{stringValue:e.event_id}},{key:'rule_id',value:{stringValue:e.rule_id}},
  {key:'event_kind',value:{stringValue:e.kind}},{key:'direction',value:{stringValue:e.direction}},
  {key:'source',value:{stringValue:e.source}},{key:'pipeline',value:{stringValue:e.pipeline}},
  {key:'context',value:{stringValue:e.context}},{key:'context_confounded',value:{boolValue:e.context_confounded}},
  {key:'support',value:{stringValue:e.support}},{key:'threshold_bpm',value:{doubleValue:e.threshold_bpm}},
  {key:'extreme_bpm',value:{doubleValue:e.extreme_bpm}},{key:'sample_count',value:{intValue:String(e.sample_count)}},
  {key:'measured_start',value:{stringValue:e.measured_start}},{key:'measured_end',value:{stringValue:e.measured_end}},
  {key:'app_received_start',value:{stringValue:e.received_start}},{key:'app_received_end',value:{stringValue:e.received_end}},
  {key:'candidate_only',value:{boolValue:true}},{key:'synthetic_test',value:{boolValue:test}},
  {key:'logfire.span_type',value:{stringValue:'log'}},
 ]}))}]}]};
}
async function sendPacket(events:Candidate[],active:()=>Promise<boolean>,test=false){
 const s=state(),controller=new AbortController();s.controllers.add(controller);
 try{
  const token=await healthExportCredential();if(!await active())return false;
  const response=await fetch('https://logfire-eu.pydantic.dev/v1/logs',{method:'POST',headers:{Authorization:token,'Content-Type':'application/json'},body:JSON.stringify(thresholdPacket(events,Date.now(),test)),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(5000)]),redirect:'error'});
  const text=await response.text();if(text.length>8192)throw Error('EXPORT_UNCONFIRMED');
  const result=JSON.parse(text);if(!response.ok||Number(result.partialSuccess?.rejectedLogRecords??0)!==0)throw Error('EXPORT_REJECTED');
  return true;
 }finally{s.controllers.delete(controller);}
}
async function flush(generation:number){
 const s=state();if(generation!==s.generation||s.paused)return;
 const pending=s.events;s.events=[];s.timer=undefined;
 const active=async()=>{const saved=await settings();return saved.enabled&&s.generation===generation&&!s.paused&&pending.every(p=>p.valid());};
 const events=pending.filter(p=>p.valid()).map(p=>p.event);
 if(!events.length)return;
 try{
  if(await sendPacket(events,active)&&await active()){
   s.last=events.at(-1);s.sent+=events.length;s.status=`Logfire accepted ${events.length} research candidate${events.length===1?'':'s'}. No medical alert or accepted evidence was created.`;
  }
 }catch{if(generation===s.generation)s.status='Event export failed. Local evidence is unchanged; no guaranteed delivery or persistent outbox.';}
}
/** Serial, bounded event evaluation. Receipts do not trigger evaluation; old backfill is excluded. */
export function observeThresholdBatch(batch:ValidatedTransfer,pipeline:Candidate['pipeline'],valid:()=>boolean){
 if(process.env.NODE_ENV==='test'||batch.mode!=='healthkit'||!valid())return Promise.resolve();
 const s=state(),generation=s.generation;
 if(s.pendingWork>=4){s.status='Research evaluation busy; an update was skipped. Original evidence is unchanged.';return Promise.resolve();}
 s.pendingWork++;
 const work=s.queue.then(async()=>{
  const saved=await settings();if(s.paused||generation!==s.generation||!saved.enabled||!valid())return;
  const context=s.context&&Date.parse(s.context.end)>Date.now()?s.context:null;
  const result=await evaluateHealthThresholds(saved.rule,s.engine,batch,new Date().toISOString(),context);
  if(s.paused||generation!==s.generation||!valid()||!(await settings()).enabled)return;
  s.engine=result.state;
  for(const event of result.events){
   s.lastCandidate={...event,pipeline};
   if(s.events.length<64)s.events.push({event:{...event,pipeline},valid});
   else s.status='Candidate group full; additional events were skipped. Local evidence is unchanged.';
  }
  if(s.events.length&&!s.timer){
   s.status=`Candidate queued locally · ${result.rule.grouping_s}-second event grouping.`;
   s.timer=setTimeout(()=>void flush(generation),result.rule.grouping_s*1000);s.timer.unref();
  }else if(!result.events.length)s.status=saved.rule.rest_only&&!context?'Waiting for your awake/rest confirmation; no resting state is inferred.':'Evaluating fresh readings; waiting for sufficient context or a rule crossing.';
 });
 s.queue=work.catch(()=>{if(generation===s.generation)s.status='Research event evaluation unavailable. No automatic interpretation or health alert.';}).finally(()=>{s.pendingWork--;});
 return s.queue;
}
/** Explicit diagnostic only. Never contains personal evidence or enables either export feed. */
export async function testThresholdConnection(check:()=>void=()=>{}){
 const now=new Date().toISOString(),s=state(),generation=s.generation;
 const event:Candidate={event_id:'a'.repeat(64),rule_id:'b'.repeat(64),kind:'absolute-high',direction:'above',source:'watch',context:'unknown',context_confounded:true,support:'single-observation',threshold_bpm:120,extreme_bpm:121,sample_count:1,measured_start:now,measured_end:now,received_start:now,received_end:now,pipeline:'fresh-live'};
 check();const sent=await sendPacket([event],async()=>{check();return s.generation===generation;},true);check();
 if(!sent)throw Error('TEST_CANCELLED');return {status:'Logfire accepted the fictional connection test. No personal reading was sent; research events remain separately controlled.'};
}
