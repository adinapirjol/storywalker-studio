import {afterEach,expect,it} from 'vitest';
import {createHash,randomUUID} from 'node:crypto';
import {chmodSync,mkdtempSync,readFileSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {closeVault,openContextSandbox,putVaultRecords,readVaultRecord,readVaultRecords,type OpenVault} from '@/lib/vault/private-vault';
import {makePrivatePlaylistSnapshot} from '@/lib/music/private-playlist';
import {emptySettings,suggestCalendarEvent,type CalendarEvent} from './contracts';
import {ingestSelectedStages} from './private-sync';
import {readPrivateStage} from './staged-files';

const namespace=`context-sandbox-sync-${randomUUID()}`;
let vault:OpenVault|undefined;
afterEach(()=>{if(vault)closeVault(vault);vault=undefined;rmSync(join('private-data',namespace),{recursive:true,force:true});});
const now='2026-10-19T10:00:00Z';
const old={playedAt:'2026-05-01T10:00:00Z',trackName:'Fictional older track',artistName:'Example',importerProvenance:'fixture'};
const document={schemaVersion:1,source:'lastfm-scrobbles',importedAt:now,records:[old]};
const event:CalendarEvent={key:createHash('sha256').update(JSON.stringify(['primary','fictional-event'])).digest('hex'),calendarId:'primary',eventId:'fictional-event',title:'Fictional workshop',start:'2026-05-02',end:'2026-05-03',status:'confirmed',recurring:false,fetchedAt:now};

it('disabled sources cause no stage reads or writes',async()=>{
  vault=await openContextSandbox(namespace);
  const result=ingestSelectedStages(vault,emptySettings,()=>{throw Error('must not read');},now);
  expect(result.results).toEqual([]);expect(readVaultRecords(vault)).toHaveLength(0);
});
it('merges staged history, preserves old evidence and is repeat safe across reopen',async()=>{
  vault=await openContextSandbox(namespace);
  putVaultRecords(vault,[{id:'import:lastfm-history:v1',kind:'import',capturedAt:now,payload:{document}}]);
  const read=()=>({...document,records:[{...old,playedAt:'2026-10-18T10:00:00Z',trackName:'Fictional new track'}]});
  expect(ingestSelectedStages(vault,{...emptySettings,lastfm:true},read,now).results[0]).toMatchObject({status:'saved',count:2,added:1});
  const bytes=readFileSync(vault.storagePath!);expect(bytes.includes(Buffer.from('Fictional new track'))).toBe(false);
  closeVault(vault);vault=await openContextSandbox(namespace);
  expect(ingestSelectedStages(vault,{...emptySettings,lastfm:true},read,now).results[0]).toMatchObject({status:'unchanged',count:2,added:0});
  expect(readVaultRecords(vault).filter(r=>r.id.startsWith('automation:backup:'))).toHaveLength(1);
});
it('one failed provider preserves its data while another succeeds',async()=>{
  vault=await openContextSandbox(namespace);
  const snapshot=makePrivatePlaylistSnapshot({playlist:{id:'fictionalplaylist123456',name:'Fictional'},importedAt:now,occurrences:[]});
  const result=ingestSelectedStages(vault,{...emptySettings,lastfm:true,spotifyIds:[snapshot.playlist.id]},path=>{
    if(path.includes('lastfm'))throw Error('missing');return snapshot;
  },now);
  expect(result.results).toMatchObject([{source:'lastfm',status:'unavailable'},{source:'spotify',status:'saved'}]);
});
it('imports only individually selected Calendar plans; cancelled updates do not imply attendance',async()=>{
  vault=await openContextSandbox(namespace);
  const settings={...emptySettings,calendarKeys:[event.key]};
  const catalog={version:1,from:'2026-05-01',toExclusive:now,complete:true,events:[event]};
  expect(ingestSelectedStages(vault,settings,()=>catalog,now).results[0]).toMatchObject({count:1,status:'saved'});
  ingestSelectedStages(vault,settings,()=>({...catalog,events:[{...event,status:'cancelled'}]}),now);
  expect(readVaultRecord(vault,`import:calendar-selected:${event.key}`)?.payload).toMatchObject({attendance:'unknown',evidence:'planned-activity',event:{status:'cancelled'}});
  expect(suggestCalendarEvent({...event,status:'cancelled'})).toMatch(/^Excluded/);
  expect(suggestCalendarEvent({...event,recurring:true})).toMatch(/^Review/);
});
it('imports five selected snapshots, preserves duplicate occurrences and stays repeat safe after reopening',async()=>{
  vault=await openContextSandbox(namespace);
  const ids=Array.from({length:5},(_,i)=>`fictionalplaylist${i}`);
  const occurrence={sourcePosition:0,addedAt:now,availability:'available' as const,trackId:'fictional',trackName:'Fictional repeated track',artistNames:['Example'],albumName:'Example',durationMs:1000};
  const snapshots=new Map(ids.map(id=>[
    `spotify/${createHash('sha256').update(id).digest('hex').slice(0,16)}.private.json`,
    makePrivatePlaylistSnapshot({playlist:{id,name:'Fictional playlist'},importedAt:now,occurrences:[occurrence,{...occurrence,sourcePosition:1}]}),
  ]));
  const settings={...emptySettings,spotifyIds:ids};
  const read=(path:string)=>snapshots.get(path);
  expect(ingestSelectedStages(vault,settings,read,now).results).toEqual(ids.map(()=>({source:'spotify',status:'saved',count:2})));
  expect(readFileSync(vault.storagePath!).includes(Buffer.from('Fictional repeated track'))).toBe(false);
  closeVault(vault);vault=await openContextSandbox(namespace);
  expect(ingestSelectedStages(vault,settings,read,now).results).toEqual(ids.map(()=>({source:'spotify',status:'unchanged',count:2})));
  expect(readVaultRecords(vault).filter(r=>r.id.startsWith('import:spotify-playlist:'))).toHaveLength(5);
  expect(readVaultRecords(vault).filter(r=>r.id.startsWith('automation:backup:'))).toHaveLength(0);
});
it('rejects wrong source identity, future snapshots, symlinks and public stage permissions',async()=>{
  vault=await openContextSandbox(namespace);
  const settings={...emptySettings,calendarKeys:[event.key]};
  const result=ingestSelectedStages(vault,settings,()=>({version:1,from:'',toExclusive:'',complete:true,events:[{...event,eventId:'different'}]}),now);
  expect(result.results[0].status).toBe('unavailable');expect(readVaultRecords(vault)).toHaveLength(0);
  expect(ingestSelectedStages(vault,{...emptySettings,lastfm:true},()=>({...document,importedAt:'2099-01-01T00:00:00Z'}),now).results[0].status).toBe('unavailable');
  const root=mkdtempSync(join(tmpdir(),'stage-test-'));
  try{
    writeFileSync(join(root,'source.json'),'{}',{mode:0o600});
    expect(readPrivateStage('source.json',100,root)).toEqual({});
    symlinkSync(join(root,'source.json'),join(root,'link.json'));
    expect(()=>readPrivateStage('link.json',100,root)).toThrow();
    chmodSync(join(root,'source.json'),0o644);expect(()=>readPrivateStage('source.json',100,root)).toThrow();
  }finally{rmSync(root,{recursive:true,force:true});}
});
