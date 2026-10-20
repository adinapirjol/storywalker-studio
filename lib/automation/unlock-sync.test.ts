import {afterEach,expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {rmSync} from 'node:fs';
import {join} from 'node:path';
import {openContextSandbox,closeVault,putVaultRecords,readVaultRecords,type OpenVault} from '@/lib/vault/private-vault';
import {emptySettings} from './contracts';

const mocks=vi.hoisted(()=>({access:vi.fn(),resume:vi.fn(),stop:vi.fn(),read:vi.fn()}));
vi.mock('@/lib/vault/vault-route-access',()=>({withBrowserVault:mocks.access}));
vi.mock('@/lib/native/native-receiver',()=>({resumeSavedHealthReceiver:mocks.resume,stopReceiverForSession:mocks.stop}));
vi.mock('./staged-files',()=>({readPrivateStage:mocks.read}));
import {syncAfterUnlock} from './unlock-sync';
const namespace=`context-sandbox-unlock-${randomUUID()}`;
let vault:OpenVault|undefined;
afterEach(()=>{if(vault)closeVault(vault);vault=undefined;vi.resetAllMocks();rmSync(join('private-data',namespace),{recursive:true,force:true});});
async function setup(){vault=await openContextSandbox(namespace);mocks.access.mockImplementation((_token,work)=>work(vault,()=>{}));}
it('does not resume, import or write without saved opt-in',async()=>{
  await setup();expect(await syncAfterUnlock('fictional')).toEqual({watch:'disabled',results:[]});
  expect(mocks.resume).not.toHaveBeenCalled();expect(mocks.read).not.toHaveBeenCalled();expect(readVaultRecords(vault!)).toHaveLength(0);
});
it('preserves successful music ingestion when saved Watch address cannot resume',async()=>{
  await setup();putVaultRecords(vault!,[{id:'automation:settings:v1',kind:'reference',capturedAt:new Date().toISOString(),payload:{...emptySettings,watch:true,lastfm:true}}]);
  mocks.resume.mockRejectedValue(Error('ADDRESS_CHANGED'));
  mocks.read.mockReturnValue({schemaVersion:1,source:'lastfm-scrobbles',importedAt:'2026-05-01T00:00:00Z',records:[]});
  expect(await syncAfterUnlock('fictional')).toMatchObject({watch:'ADDRESS_CHANGED',results:[{source:'lastfm',status:'saved',count:0}]});
  expect(mocks.resume).toHaveBeenCalledWith(vault,'fictional');
});
it('fails closed after expiry without misrepresenting authentication as failed',async()=>{
  mocks.access.mockRejectedValue(Error('expired'));
  expect(await syncAfterUnlock('expired')).toMatchObject({status:'sync-unavailable'});
  expect(mocks.resume).not.toHaveBeenCalled();expect(mocks.read).not.toHaveBeenCalled();
});

it('cancels after receiver resumption without reading stages or leaving its listener running',async()=>{
 await setup();putVaultRecords(vault!,[{id:'automation:settings:v1',kind:'reference',capturedAt:new Date().toISOString(),payload:{...emptySettings,watch:true,lastfm:true}}]);
 const controller=new AbortController();mocks.resume.mockImplementation(async()=>{controller.abort();});
 mocks.access.mockImplementation((_token,work)=>work(vault,()=>controller.signal.throwIfAborted()));
 expect(await syncAfterUnlock('fictional',controller.signal)).toMatchObject({status:'sync-cancelled'});
 expect(mocks.read).not.toHaveBeenCalled();expect(mocks.stop).toHaveBeenCalledWith('fictional');
});
it('preserves confirmed source results when only the unlock-receipt write fails',async()=>{
 await setup();putVaultRecords(vault!,[{id:'automation:settings:v1',kind:'reference',capturedAt:new Date().toISOString(),payload:{...emptySettings,lastfm:true}}]);
 mocks.read.mockReturnValue({schemaVersion:1,source:'lastfm-scrobbles',importedAt:'2026-05-01T00:00:00Z',records:[]});
 const storage=await import('@/lib/vault/private-vault'), original=storage.putVaultRecords;
 const spy=vi.spyOn(storage,'putVaultRecords').mockImplementation((opened,records)=>{if(records.some(r=>r.id==='automation:unlock-receipt:v1'))throw Error('fictional disk fault');return original(opened,records);});
 try {
  expect(await syncAfterUnlock('fictional')).toMatchObject({results:[{source:'lastfm',status:'saved'}],warning:expect.stringContaining('confirmed')});
  expect(storage.readVaultRecord(vault!,'import:lastfm-history:v1')).toBeDefined();
 }finally{spy.mockRestore();}
});

it('returns only a saved/reload acknowledgement when access ends after a confirmed import',async()=>{
 await setup();putVaultRecords(vault!,[{id:'automation:settings:v1',kind:'reference',capturedAt:new Date().toISOString(),payload:{...emptySettings,lastfm:true}}]);
 mocks.read.mockReturnValue({schemaVersion:1,source:'lastfm-scrobbles',importedAt:'2026-05-01T00:00:00Z',records:[]});
 mocks.access.mockImplementation(async(_token,work)=>{await work(vault,()=>{});throw Error('fictional final session expiry');});
 expect(await syncAfterUnlock('fictional')).toEqual({watch:'unavailable',results:[],status:'saved-reload-required'});
});
