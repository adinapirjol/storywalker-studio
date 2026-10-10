/** Server-only, separately opted-in summaries. Never instrument this module or raw health input. */
import {readFile,writeFile,lstat,mkdir,chmod,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {Observation,ValidatedTransfer} from './native-transfer-contract';
import {summarizeReceivedHealth,type ReceivedHealthSummary} from './native-transfer';
export const healthExportDirectory=join(process.cwd(),'.logfire/storywalker');
const directory=healthExportDirectory;
export const STORYWALKER_PROJECT='https://logfire-eu.pydantic.dev/adinablazrx/storywalker';
const configPath=join(directory,'summary-config.json');
const credentialPath=join(directory,'logfire_credentials.json');
type Kind='received-batch'|'live-window';
type State={status:string;last?:ReceivedHealthSummary&{kind:Kind};sent:Set<string>;sending:Set<string>;window?:{observations:Observation[];ids:Set<string>;valid:()=>boolean;timer:ReturnType<typeof setTimeout>};generation:number;paused:boolean;requests:Set<AbortController>;configuration?:Promise<unknown>};
const shared=globalThis as typeof globalThis&{__storywalkerSummary?:State};
function state(){
 const s=shared.__storywalkerSummary??=({status:'Summary feed off.',sent:new Set(),sending:new Set(),generation:0,paused:false,requests:new Set()});
 s.generation??=0;s.paused??=false;s.requests??=new Set();return s;
}
export async function safeHealthExportPaths(){
 for(const path of [join(process.cwd(),'.logfire'),directory])if((await lstat(path)).isSymbolicLink())throw Error('UNSAFE_PATH');
}

async function savedSummaryEnabled(){
 try{
  await safeHealthExportPaths();
  if((await lstat(configPath)).isSymbolicLink())return false;
  const value=JSON.parse(await readFile(configPath,'utf8'));
  return value.enabled===true&&value.project===STORYWALKER_PROJECT;
 }catch{return false;}
}
async function config(){return !state().paused&&await savedSummaryEnabled();}
export async function healthExportCredential(){
 if((await lstat(join(process.cwd(),'.logfire'))).isSymbolicLink()||(await lstat(directory)).isSymbolicLink()||(await lstat(credentialPath)).isSymbolicLink())throw Error('UNSAFE_PATH');
 const value=JSON.parse(await readFile(credentialPath,'utf8'));
 if(value.project_url!==STORYWALKER_PROJECT||value.logfire_api_url!=='https://logfire-eu.pydantic.dev'||typeof value.token!=='string')throw Error('TARGET_UNAVAILABLE');
 return value.token as string;
}
export async function summaryStatus(){return {enabled:await config(),project:STORYWALKER_PROJECT,status:state().status,last:state().last??null};}
export function clearLiveSummary(){const s=state();s.generation++;for(const controller of s.requests)controller.abort();s.requests.clear();if(s.window)clearTimeout(s.window.timer);s.window=undefined;}
export function configureSummary(enabled:boolean,check:()=>void=()=>{}){
 check();const s=state();s.paused=true;clearLiveSummary();const generation=s.generation;
 const next=(s.configuration??Promise.resolve()).then(()=>writeConfiguration(enabled,generation,check));
 s.configuration=next.catch(()=>undefined);return next;
}
async function writeConfiguration(enabled:boolean,generation:number,check:()=>void){
 const s=state();
 const checkCurrent=()=>{
  check();
  if(s.generation!==generation)throw Error('SUMMARY_SETTING_CHANGED');
 };
 // Stopping must remain possible when an export credential is missing or invalid.
 if(enabled)await healthExportCredential();
 checkCurrent();
 await mkdir(directory,{recursive:true,mode:0o700});await safeHealthExportPaths();
 await chmod(join(process.cwd(),'.logfire'),0o700);await chmod(directory,0o700);
 try{if((await lstat(configPath)).isSymbolicLink())throw Error('UNSAFE_PATH');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const temporary=join(directory,`summary-config-${randomUUID()}.tmp`);
 let persisted=false;
 try{
  checkCurrent();
  await writeFile(temporary,JSON.stringify({enabled,project:STORYWALKER_PROJECT,changedAt:new Date().toISOString()}),{mode:0o600,flag:'wx'});
  checkCurrent();
  await rename(temporary,configPath);
  persisted=true;
  checkCurrent();
  // Confirm durable consent while exports remain paused, then recheck authority.
  const savedEnabled=await savedSummaryEnabled();
  checkCurrent();
  if(savedEnabled!==enabled)throw Error('SUMMARY_SETTING_UNCONFIRMED');
  s.paused=!enabled;
  s.status=enabled?'Enabled for new received batches and 20-second live windows.':'Summary feed off. Previously exported records remain in Logfire.';
  return {enabled:savedEnabled,project:STORYWALKER_PROJECT,status:s.status,last:s.last??null};
 }catch(error){
  s.paused=true;
  s.status='Summary feed paused after a failed settings save. Check its state before retrying.';
  // The configuration queue holds later saves until this rollback finishes.
  // Missing consent defaults to off, including after a process restart.
  if(persisted)await unlink(configPath);
  throw error;
 }finally{if(!persisted)await unlink(temporary).catch(()=>undefined);}
}
/** Strict allowlist constructs OTLP from the Pydantic result; identifiers/packets never become labels. */
export function summaryPacket(summary:ReceivedHealthSummary,kind:Kind,now=Date.now()){
 const attributes=[
  {key:'summary_id',value:{stringValue:summary.summary_id}},
  {key:'source',value:{stringValue:summary.source}},
  {key:'pipeline',value:{stringValue:kind}},
  {key:'received_count',value:{intValue:String(summary.received_count)}},
  {key:'preferred_count',value:{intValue:String(summary.preferred_count)}},
  {key:'maximum_bpm',value:{doubleValue:summary.maximum_bpm}},
  {key:'app_received_start',value:{stringValue:summary.received_start}},
  {key:'app_received_end',value:{stringValue:summary.received_end}},
  {key:'logfire.span_type',value:{stringValue:'log'}},
 ];
 const resource={attributes:[{key:'service.name',value:{stringValue:'storywalker-body'}},{key:'deployment.environment.name',value:{stringValue:'personal-summary'}}]};
 return {resourceLogs:[{resource,scopeLogs:[{scope:{name:'storywalker.allowlisted-summary'},logRecords:[{timeUnixNano:String(BigInt(now)*BigInt(1_000_000)),severityNumber:9,severityText:'INFO',body:{stringValue:'Received heart-rate summary'},attributes}]}]}]};
}
export async function exportReceivedSummary(batch:ValidatedTransfer,kind:Kind='received-batch',valid:()=>boolean=()=>true){
 const generation=state().generation;
 if(process.env.NODE_ENV==='test'||batch.mode!=='healthkit'||!valid()||!await config())return;
 const s=state(),key=kind+':'+batch.batch_id;
 const active=()=>!s.paused&&s.generation===generation&&valid();
 if(!active())return;
 if(s.sent.has(key)||s.sending.has(key)||s.sending.size>=2)return;
 s.sending.add(key);
 const controller=new AbortController();s.requests.add(controller);
 try{
  const summary=await summarizeReceivedHealth(batch);
  if(!summary||!active()||!await config())return;
  const token=await healthExportCredential();
  if(!active()||!await config()||!active())return;
  const response=await fetch('https://logfire-eu.pydantic.dev/v1/logs',{method:'POST',headers:{Authorization:token,'Content-Type':'application/json'},body:JSON.stringify(summaryPacket(summary,kind)),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(5000)]),redirect:'error'});
  const text=await response.text();if(text.length>8192)throw Error('EXPORT_UNCONFIRMED');
  const result=JSON.parse(text);
  if(!response.ok||Number(result.partialSuccess?.rejectedLogRecords??0)!==0)throw Error('EXPORT_REJECTED');
  s.sent.add(key);if(s.sent.size>2000)s.sent.delete(s.sent.values().next().value!);
  if(!active())return;
  s.last={...summary,kind};s.status=result.partialSuccess?.errorMessage?'Export accepted with a server warning.':'Logfire accepted the summary. No raw observations exported.';
 }catch{if(active())s.status='Summary export unavailable. Local evidence and phone queue are unchanged.';}
 finally{s.requests.delete(controller);s.sending.delete(key);}
}
/** Live windows are bounded, ephemeral and clear on receiver stop/expiry. No disk outbox. */
export async function observeLiveSummary(observation:Observation,valid:()=>boolean){
 const generation=state().generation;
 if(process.env.NODE_ENV==='test'||!await config())return;
 if(Date.now()-Date.parse(observation.event_start)>120_000||!valid()||observation.payload.kind!=='heart_rate'||observation.source_type!=='healthkit')return;
 const s=state();
 if(s.paused||s.generation!==generation)return;
 if(!s.window){
  const timer=setTimeout(()=>{const window=s.window;s.window=undefined;if(window&&window.valid())void exportReceivedSummary({version:1,batch_id:randomUUID(),mode:'healthkit',observations:window.observations,deletions:[]},'live-window',window.valid);},20_000);
  timer.unref();s.window={observations:[],ids:new Set(),valid,timer};
 }
 const window=s.window;
 if(!window.ids.has(observation.id)&&window.observations.length<200){window.ids.add(observation.id);window.observations.push(observation);}
}
