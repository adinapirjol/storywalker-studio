import {expect,it} from 'vitest';
import {buildVaultDemo} from './vault-demo';
import {DEMO_XR_SCENE,type XRScene} from './xr-scene';
const start='2030-01-01T00:00:00Z',end='2030-01-02T00:00:00Z';
const source:XRScene={...DEMO_XR_SCENE,journeyEpisodes:[{id:'window',label:'Invented courtyard',start,end,timeZone:'UTC',routeOrder:0,notionEvidence:[],context:[],memoryDecisions:[],worldPosition:{position:{x:1,y:0,z:2},projection:'fixture',evidenceIds:['geo']},memoryPosition:{x:1,y:0,z:2},provenance:{nodes:[{id:'geo',sourceId:'source',type:'timeline',start,end,coordinates:{latitude:0,longitude:0},certainty:'unknown'},{id:'song',type:'lastfm',sourceId:'music',start,end}],edges:[{evidenceId:'geo',role:'physical-geography',basis:'source-record'},{evidenceId:'song',role:'listening-observation',basis:'temporal-overlap'}]}}],journeyLayout:{version:1,mode:'WORLD',from:start,toExclusive:end,timeZone:'UTC',projection:{method:'local-equirectangular-uniform-v1',originLatitude:0,originLongitude:0,metresPerUnit:100,usableRoomWidth:36,north:'negative-z'},sources:[{type:'timeline',id:'source',fingerprint:'fixture',capturedAt:start}],coverage:{timelineStart:start,timelineEnd:end,visits:1,excludedRoutes:0,invalidVisits:0,duplicateVisits:0,baselinePlays:5,duplicatePlays:0,matchedPlays:5,ambiguousPlays:0,unmatchedPlays:0},rules:[]}};
it('retains existing evidence and geography without copying listening or granting approval',()=>{
 const before=JSON.stringify(source);const result=buildVaultDemo(source,['window']);
 expect(JSON.stringify(source)).toBe(before);
 expect(result.journeyEpisodes![0].worldPosition).toEqual(source.journeyEpisodes![0].worldPosition);
 expect(result.journeyEpisodes![0].provenance.nodes.map(n=>n.type)).toEqual(['timeline']);
 expect(result.cues.every(c=>c.treatment==='silent')).toBe(true);
 expect(result.draft?.canonical).toBe(false);
 expect(result.journeyLayout?.coverage.matchedPlays).toBe(0);
 expect(JSON.stringify(result)).not.toContain('music');
});
it('rejects missing, repeated and excessive selections',()=>{
 for(const ids of [[],['absent'],['window','window'],['a','b','c','d']])expect(()=>buildVaultDemo(source,ids)).toThrow();
});
