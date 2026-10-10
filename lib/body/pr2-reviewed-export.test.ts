/** Fictional encrypted sandbox; export config/credentials and transport are mocked. */
vi.hoisted(()=>{process.env.STORYWALKER_HEALTH_PROJECT_URL='https://logfire-eu.pydantic.dev/fictional/research';});
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {rmSync} from 'node:fs';
import {join} from 'node:path';
const config=vi.hoisted(()=>({value:{enabled:false} as Record<string,unknown>}));
vi.mock('node:fs/promises',async original=>{
 const fs=await original<typeof import('node:fs/promises')>();
 return {...fs,
  lstat:async(path:string)=>path.includes('.logfire')?{isSymbolicLink:()=>false}:fs.lstat(path),
  mkdir:async(path:string,options:never)=>path.includes('.logfire')?undefined:fs.mkdir(path,options),
  chmod:async(path:string,mode:never)=>path.includes('.logfire')?undefined:fs.chmod(path,mode),
  readFile:async(path:string,options:never)=>path.endsWith('summary-config.json')?JSON.stringify(config.value):path.endsWith('logfire_credentials.json')?JSON.stringify({token:'fictional-token',project_url:'https://logfire-eu.pydantic.dev/fictional/research',logfire_api_url:'https://logfire-eu.pydantic.dev'}):fs.readFile(path,options),
  writeFile:async(path:string,data:string,options:never)=>{if(path.includes('.logfire'))config.value=JSON.parse(data);else await fs.writeFile(path,data,options);},
  rename:async(from:string,to:string)=>{if(!from.includes('.logfire'))await fs.rename(from,to);},
  unlink:async(path:string)=>{if(path.includes('.logfire'))config.value={enabled:false};else await fs.unlink(path);},
 };
});
import {openContextSandbox,closeVault,type OpenVault} from '@/lib/vault/private-vault';
import {stageNativeTransfer,decideNativeTransfer,type NativeSummary} from '@/lib/native/native-transfer';
import {configureSummary,exportReviewedSummary,summaryStatus,clearLiveSummary} from './health-summary';
import type {ValidatedTransfer} from '@/lib/native/native-transfer-contract';
let vault:OpenVault,namespace:string;
const fixture=():ValidatedTransfer=>({version:1,batch_id:randomUUID(),mode:'healthkit',deletions:[],observations:[{schema_version:1,id:randomUUID(),source_id:'fictional-source',source_type:'healthkit',source_revision:'1',device_revision:null,event_start:'2020-01-01T00:00:00Z',event_end:'2020-01-01T00:00:00Z',received_at:'2020-01-01T00:00:01Z',original_offset:'unknown',semantics:'measurement',acquisition:'historical',provenance:'source_recorded',quality:[],payload:{kind:'heart_rate',value:80,unit:'bpm'}}]});
const staged=()=>stageNativeTransfer(vault,fixture(),'fictional-digest',Buffer.alloc(32,1));
const exportItem=(item:NativeSummary,consent=true,valid=()=>true)=>exportReviewedSummary(vault,item.id,item.revision,consent,valid);
beforeEach(async()=>{
 Reflect.deleteProperty(globalThis,'__storywalkerSummary');config.value={enabled:false};
 namespace='context-sandbox-pr2-'+randomUUID();vault=await openContextSandbox(namespace);
 vi.stubEnv('NODE_ENV','development');vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}')));
});
afterEach(()=>{clearLiveSummary();closeVault(vault);rmSync(join(process.cwd(),'private-data',namespace),{recursive:true,force:true});vi.unstubAllEnvs();vi.unstubAllGlobals();Reflect.deleteProperty(globalThis,'__storywalkerSummary');});
it('staging, acceptance and refusal do not send; only separately consented accepted evidence sends once',async()=>{
 await configureSummary(true);const batch=fixture();let item=stageNativeTransfer(vault,batch,'fictional-digest',Buffer.alloc(32,1));
 expect(fetch).not.toHaveBeenCalled();await expect(exportItem(item)).rejects.toThrow('REVIEW_REQUIRED');
 item=decideNativeTransfer(vault,item.id,item.revision,'accept');expect(fetch).not.toHaveBeenCalled();
 expect((await exportItem(item,false)).status).toBe('consent-required');expect(fetch).not.toHaveBeenCalled();
 expect((await exportItem(item)).status).toBe('delivered');expect(fetch).toHaveBeenCalledOnce();
 expect((await exportItem(item)).status).toBe('already-delivered');
 stageNativeTransfer(vault,batch,'fictional-digest',Buffer.alloc(32,1));expect(fetch).toHaveBeenCalledOnce();
 const refused=staged(),deleted=decideNativeTransfer(vault,refused.id,refused.revision,'delete');
 await expect(exportItem(deleted)).rejects.toThrow('REVIEW_REQUIRED');
 const removed=decideNativeTransfer(vault,item.id,item.revision,'delete');
 await expect(exportItem(removed)).rejects.toThrow('REVIEW_REQUIRED');expect(fetch).toHaveBeenCalledOnce();
});
it('off and legacy settings never authorize export or change themselves',async()=>{
 let item=staged();item=decideNativeTransfer(vault,item.id,item.revision,'accept');
 expect((await exportItem(item)).status).toBe('not-confirmed');
 config.value={enabled:true,project:'https://logfire-eu.pydantic.dev/fictional/research'};const old=JSON.stringify(config.value);
 expect((await summaryStatus()).enabled).toBe(false);await exportItem(item);
 expect(JSON.stringify(config.value)).toBe(old);expect(fetch).not.toHaveBeenCalled();
});
it('rejects stale review revisions without sending',async()=>{
 await configureSummary(true);const item=staged();decideNativeTransfer(vault,item.id,item.revision,'accept');
 await expect(exportItem(item)).rejects.toThrow('STALE_REVIEW');expect(fetch).not.toHaveBeenCalled();
});
it('expiry aborts an in-flight export and does not claim delivery',async()=>{
 let valid=true;await configureSummary(true,()=>{if(!valid)throw Error('expired');});
 let signal:AbortSignal|undefined;
 vi.mocked(fetch).mockImplementation(async(_url,init)=>new Promise((_resolve,reject)=>{
  signal=init?.signal as AbortSignal;signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});
 }));
 let item=staged();item=decideNativeTransfer(vault,item.id,item.revision,'accept');
 const pending=exportItem(item,true,()=>valid);
 await vi.waitFor(()=>expect(fetch).toHaveBeenCalledOnce());valid=false;
 expect((await pending).status).toBe('not-confirmed');expect(signal?.aborted).toBe(true);expect((await summaryStatus()).enabled).toBe(false);
});
it('restart requires reconfirmation even for versioned settings',async()=>{
 await configureSummary(true);Reflect.deleteProperty(globalThis,'__storywalkerSummary');
 expect((await summaryStatus()).enabled).toBe(false);expect(config.value.enabled).toBe(true);
});
