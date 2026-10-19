import {createHash,randomUUID} from 'node:crypto';
import {minimisedLastFmHistorySchema} from '@/lib/evidence/private-ingest';
import {mergeLastFmHistory} from '@/lib/evidence/private-import-integrations';
import {privatePlaylistSnapshotSchema} from '@/lib/music/private-playlist';
import {putVaultRecords,readVaultRecord,vaultRecordHeaders,refreshVaultDerivedViews,type OpenVault,type VaultRecord} from '@/lib/vault/private-vault';
import {calendarCatalogSchema,emptySettings,syncSettingsSchema,type SyncSettings} from './contracts';
import {readPrivateStage} from './staged-files';

export const settingsId='automation:settings:v1';
export const receiptId='automation:receipt:v1';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function syncSettings(vault:OpenVault) {
  const row=readVaultRecord(vault,settingsId);
  return row?syncSettingsSchema.parse(row.payload):emptySettings;
}
export function musicChoices(vault:OpenVault) {
  return vaultRecordHeaders(vault).filter(r=>r.id.startsWith('import:spotify-playlist:')).map(r=>{
    const payload=readVaultRecord(vault,r.id)!.payload as {snapshot:unknown};
    const snapshot=privatePlaylistSnapshotSchema.parse(payload.snapshot);
    return {id:snapshot.playlist.id,name:snapshot.playlist.name};
  });
}
export function calendarCandidates() {return calendarCatalogSchema.parse(readPrivateStage('calendar/candidates.private.json'));}

type SourceResult={source:string;status:'saved'|'unchanged'|'unavailable';count?:number;added?:number;changed?:number};
/** Stage readers are injected for fictional tests. No account calls or key persistence. */
export function ingestSelectedStages(vault:OpenVault,settings:SyncSettings,read=readPrivateStage,now=new Date().toISOString()) {
  const writes:VaultRecord[]=[], results:SourceResult[]=[];
  const replace=(record:VaultRecord)=>{
    const previous=readVaultRecord(vault,record.id);
    if(previous) writes.push({...previous,id:`automation:backup:${randomUUID()}`});
    writes.push(record);
  };
  if(settings.lastfm) {
    try {
      const staged=minimisedLastFmHistorySchema.parse(read('minimised/lastfm-history.private.json'));
      if(Date.parse(staged.importedAt)>Date.parse(now)+60_000) throw Error('FUTURE_STAGE');
      const id='import:lastfm-history:v1', previous=readVaultRecord(vault,id);
      const payload=previous?.payload as {document?:unknown}|undefined;
      const before=payload?.document?minimisedLastFmHistorySchema.parse(payload.document).records:[];
      const records=mergeLastFmHistory(payload?.document,staged.records), added=records.length-before.length;
      if(added||!previous) replace({id,kind:'import',capturedAt:now,payload:{...payload,schemaVersion:1,privacy:'private',canonical:false,source:'lastfm-history',consent:'selected-staging-auto-import',importedAt:now,document:{...staged,records},summary:{retained:records.length}}});
      results.push({source:'lastfm',status:added||!previous?'saved':'unchanged',count:records.length,added});
    }catch {results.push({source:'lastfm',status:'unavailable'});}
  }
  for(const playlistId of settings.spotifyIds) {
    try {
      const file=createHash('sha256').update(playlistId).digest('hex').slice(0,16);
      const snapshot=privatePlaylistSnapshotSchema.parse(read(`spotify/${file}.private.json`));
      if(snapshot.playlist.id!==playlistId||snapshot.occurrenceCount!==snapshot.occurrences.length||Date.parse(snapshot.importedAt)>Date.parse(now)+60_000) throw Error('INVALID_STAGE');
      const id=`import:spotify-playlist:${playlistId}`, previous=readVaultRecord(vault,id);
      const old=(previous?.payload as {snapshot?:unknown}|undefined)?.snapshot;
      const prior=old?privatePlaylistSnapshotSchema.parse(old):undefined;
      if(prior&&Date.parse(snapshot.importedAt)<Date.parse(prior.importedAt)) throw Error('OLDER_STAGE');
      const changed=!prior||hash({...prior,importedAt:''})!==hash({...snapshot,importedAt:''});
      if(changed) replace({id,kind:'import',capturedAt:now,payload:{schemaVersion:1,privacy:'private',canonical:false,source:'spotify-playlist',consent:'selected-staging-auto-import',importedAt:now,snapshot}});
      results.push({source:'spotify',status:changed?'saved':'unchanged',count:snapshot.occurrenceCount});
    }catch {results.push({source:'spotify',status:'unavailable'});}
  }
  if(settings.calendarKeys.length) {
    const startWrites=writes.length;
    try {
      const catalog=calendarCatalogSchema.parse(read('calendar/candidates.private.json'));
      const events=new Map(catalog.events.map(e=>[e.key,e]));
      let count=0,changed=0,missing=0;
      for(const key of settings.calendarKeys) {
        const event=events.get(key);
        if(!event){missing++;continue;}
        if(hash([event.calendarId,event.eventId])!==key||Date.parse(event.fetchedAt)>Date.parse(now)+60_000) throw Error('INVALID_STAGE');
        const id=`import:calendar-selected:${key}`, previous=readVaultRecord(vault,id);
        const old=(previous?.payload as {event?:typeof event}|undefined)?.event;
        if(old&&Date.parse(event.fetchedAt)<Date.parse(old.fetchedAt)){missing++;continue;}
        if(!old||hash({...old,fetchedAt:''})!==hash({...event,fetchedAt:''})) {
          replace({id,kind:'import',capturedAt:now,payload:{schemaVersion:1,source:'google-calendar-selected',privacy:'private',canonical:false,evidence:'planned-activity',attendance:'unknown',consent:'individually-selected',event}});
          changed++;
        }
        count++;
      }
      results.push({source:'calendar',status:missing?'unavailable':changed?'saved':'unchanged',count,changed});
    }catch {writes.splice(startWrites);results.push({source:'calendar',status:'unavailable'});}
  }
  const receipt={at:now,results};
  if(writes.length) putVaultRecords(vault,[...writes,{id:receiptId,kind:'reference',capturedAt:now,payload:receipt}]);
  if(writes.length) {
    try {refreshVaultDerivedViews(vault);} catch {return {...receipt,warning:"Evidence saved; derived views need refresh."};}
  }
  return receipt;
}
