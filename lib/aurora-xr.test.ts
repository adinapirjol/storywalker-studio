import {expect,it} from 'vitest';
import {auroraCoastXR} from './aurora-xr';
import {episodeSpaces} from './journey-experience';
import {windowEvidence} from './xr-evidence';
import {parseSceneFile,reviewExport} from './xr-scene';
import {buildAtlasNow} from './private-atlas';
import type {VaultRecord} from './private-vault';
it('builds a deterministic complete public rehearsal, with sparse and unresolved windows',()=>{
 const a=auroraCoastXR(),b=auroraCoastXR();expect(a).toEqual(b);expect(episodeSpaces(a.scene)).toHaveLength(6);
 const windows=windowEvidence(a.scene,a.decisions);expect(windows[8].artifacts).toHaveLength(1);expect(windows[0].candidates).toBe(1);
 expect(windows[0].artifacts.some(a=>a.id==='fictional:refused')).toBe(false);
 expect(a.scene.journeyLayout!.coverage.unmatchedPlays).toBe(1);
 expect(a.scene.journeyEpisodes!.some(e=>e.memoryDecisions.length>0)).toBe(true);
 expect(a.scene.experience!.soundDecisions).toHaveLength(1);
 expect(parseSceneFile(reviewExport(a.scene,a.decisions))).toEqual(a);
});
it('coverage uses observation timestamps and compares timezone offsets chronologically',()=>{
 const record:VaultRecord={id:'import:fixture',kind:'import',capturedAt:'2030-01-01T00:00:00Z',payload:{source:'fictional',document:{records:[{endedAt:'2027-07-18T10:00:00+03:00'},{watchedAt:'2027-07-18T08:00:00Z'},{addedAtUtc:'2027-07-18T06:00:00Z'},{}]}}};
 const coverage=buildAtlasNow([record],'2030-01-01T00:00:00Z').imports[0].coverage;
 expect(coverage).toEqual({from:'2027-07-18T06:00:00Z',through:'2027-07-18T08:00:00Z',datedRows:3});
});
it('Atlas separates saved compositions from source counts and ignores archived duplicates',()=>{
 const fixture=auroraCoastXR(),at='2027-07-30T12:00:00.000Z';
 const source:VaultRecord={id:'import:music',kind:'import',capturedAt:at,payload:{source:'lastfm-scrobbles',importedAt:at,document:{records:[{playedAt:'2027-07-18T09:00:00Z'}]}}};
 const scene:VaultRecord={id:'xr:spatial-draft:v1',kind:'reference',capturedAt:at,payload:{...fixture,updatedAt:at}};
 const records=[source,scene,{...source,id:'lastfm:before-delta:old'},{...source,id:'lastfm:before-final-period:old'},{...scene,id:'xr:spatial-draft:archive:old'},{...scene,id:'xr:spatial-draft:before-evidence:old'}];
 const original=JSON.stringify(records),a=buildAtlasNow(records,at);
 expect(a.sourceRecordCount).toBe(1);expect(a.imports).toHaveLength(1);expect(a.imports[0].coverage?.from).toBe('2027-07-18T09:00:00Z');expect(a.spatial?.episodes).toBe(6);expect(a.spatial?.refused).toBe(1);
 const acknowledged={...a,acknowledgedImports:a.imports,acknowledgedSourceIds:[]};
 const b=buildAtlasNow(records,at,acknowledged),c=buildAtlasNow(records,at,{...b,acknowledgedImports:b.imports,acknowledgedSourceIds:[]});
 expect(b).toEqual(c);expect(b.whatChanged).toEqual([]);expect(JSON.stringify(records)).toBe(original);
});
