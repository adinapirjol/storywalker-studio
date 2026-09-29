import {it,expect} from 'vitest';
import {enrichWindowEvidence} from './xr-enrichment';
import {windowEvidence,windowDepth} from './xr-evidence';
import {CLOSED_ARCHIVE,openEvidence,crossedPlane,chamberStep,sourceWindowPlanes} from './archive-spatial';
import {groundJourney} from './journey-grounding';
import {DEMO_XR_SCENE,parseSceneFile,reviewExport} from './xr-scene';
import {validateDraftReview} from './xr-draft';
import {pointInsidePlane} from './archive-renderer';
import type {VaultRecord} from './private-vault';
const at=(h:number)=>`2026-05-15T${String(h).padStart(2,'0')}:00:00Z`;
function fixture(){return groundJourney(DEMO_XR_SCENE,{schemaVersion:1,source:'google-timeline',schemaEncountered:'fixture',importedAt:at(20),records:[{kind:'visit',startAt:at(10),endAt:at(12),latitude:40,longitude:10,certainty:'reported',authorCorrected:false},{kind:'visit',startAt:at(12),endAt:at(14),latitude:40,longitude:10,certainty:'reported',authorCorrected:false}]},{schemaVersion:1,source:'lastfm-scrobbles',importedAt:at(20),records:[]},{from:at(0),toExclusive:'2026-05-16T00:00:00Z',timelineToExclusive:'2026-05-16T00:00:00Z',timeZone:'UTC',sources:[{type:'timeline',id:'timeline',fingerprint:'a',capturedAt:at(20)},{type:'lastfm',id:'lastfm',fingerprint:'b',capturedAt:at(20)}]});}
function rec(id:string,payload:unknown):VaultRecord{return{id,kind:'capture',capturedAt:at(11),payload};}
it('attaches only explicit or unique contained source times; leaves date-only and multi-window candidates unassigned',()=>{
 const scene=fixture(),before=JSON.stringify(scene),report=enrichWindowEvidence(scene,[rec('exact',{title:'Exact',occurredAt:at(11)}),rec('date',{title:'Day',date:'2026-05-15'}),rec('spans',{title:'Spans',startsWhen:at(11),endsWhen:at(13)}),rec('edge',{title:'Boundary',occurredAt:at(12)}),rec('import-time',{title:'No event time'}),rec('link',{title:'Explicit',episodeId:scene.journeyEpisodes![0].id})],at(20));
 expect(report.matches.filter(m=>m.status==='attached')).toHaveLength(3);
 expect(report.matches.filter(m=>m.basis==='date-only')).toHaveLength(2);
 expect(report.matches.filter(m=>m.basis==='ambiguous-time')).toHaveLength(2);
 expect(report.artifacts.some(a=>a.title==='No event time')).toBe(false);
 const edge=report.artifacts.find(a=>a.title==='Boundary')!;expect(report.matches.find(m=>m.artifactId===edge.id)?.windowId).toBe(scene.journeyEpisodes![1].id);
 expect(JSON.stringify(scene)).toBe(before);
});
it('keeps floating EXIF and uncertain Author envelopes pending, never uses remote media or Spotify',()=>{
 const scene=fixture();scene.journeyEpisodes![0].reconstructedTiming={precision:'day',label:'Envelope',note:'Unknown clock times',listeningWindows:[]};
 const report=enrichWindowEvidence(scene,[rec('exif',{title:'Photo',exif:{DateTimeOriginal:'2026:05:15 11:00:00'},thumbnailDataUrl:'https://example.test/private.jpg'}),rec('bound',{title:'Uncertain',occurredAt:at(11)}),{id:'import:spotify',kind:'import',capturedAt:at(20),payload:{document:{source:'spotify',records:[]}}}],at(20));
 expect(report.matches.every(m=>m.status==='candidate')).toBe(true);expect(report.matches.some(m=>m.basis==='uncertain-boundary')).toBe(true);expect(report.artifacts.every(a=>!a.thumbnail)).toBe(true);expect(report.artifacts.some(a=>a.kind==='media')).toBe(true);
});
it('surfaces contain supported artefacts only; review is append-only and survives export',()=>{
 const scene=fixture(),report=enrichWindowEvidence(scene,[rec('day',{title:'Uncertain date',date:'2026-05-15'})],at(20));
 const enriched={...scene,evidenceArchive:report};const first=windowEvidence(enriched,{})[0];expect(first.artifacts.map(a=>a.kind)).toEqual(['timeline']);expect(first.candidates).toBe(1);
 const m=report.matches[0],review={...enriched,evidenceArchive:{...report,decisions:[{artifactId:m.artifactId,windowId:m.windowId,decision:'accept' as const,author:'Author' as const,at:at(20)}]}};
 expect(windowEvidence(review,{})[0].artifacts).toHaveLength(2);expect(validateDraftReview(enriched,{scene:review,decisions:{}}).scene).toEqual(review);
 expect(parseSceneFile(reviewExport(review,{})).scene).toEqual(review);
 expect(()=>validateDraftReview(review,{scene:enriched,decisions:{}})).toThrow('decisions');
 const forged=structuredClone(review);forged.evidenceArchive.artifacts[0].title='Rewritten';expect(()=>validateDraftReview(enriched,{scene:forged,decisions:{}})).toThrow('Source evidence');
});
it('opens a bounded chamber without changing the corridor camera or source anchors',()=>{
 const camera={x:2,z:4,yaw:0,eye:1.7},view=openEvidence('window',camera,10);camera.x=100;expect(view.origin!.x).toBe(2);
 expect(crossedPlane({x:2,z:1},{x:2,z:0},view.anchor!,0)).toBe(true);expect(crossedPlane({x:10,z:1},{x:10,z:0},view.anchor!,0)).toBe(false);
 expect(chamberStep({x:0,z:1,yaw:0,eye:1.7},{x:0,z:2,yaw:0,eye:1.7}).exits).toBe(true);
 expect(chamberStep({x:2,z:1,yaw:0,eye:1.7},{x:8,z:4,yaw:0,eye:1.7})).toMatchObject({exits:false,camera:{x:3.7,z:1.75}});
 expect(CLOSED_ARCHIVE.phase).toBe('corridor');
});
it('segments by source windows, caps measured duration depth and uses polygon hit testing',()=>{
 const windows=windowEvidence(fixture(),{});expect(sourceWindowPlanes(windows,{x:0,z:0},0)).toHaveLength(2);expect(windowDepth(5)).toBeGreaterThan(windowDepth(1));expect(windowDepth(1e9)).toBe(2.4);expect(windowDepth(1e9,true)).toBe(.45);
 expect(pointInsidePlane(2,2,[{x:0,y:0},{x:4,y:1},{x:3,y:4},{x:0,y:4}])).toBe(true);expect(pointInsidePlane(4,0,[{x:0,y:0},{x:4,y:1},{x:3,y:4},{x:0,y:4}])).toBe(false);
});
it('research snapshots require explicit Author composition, never recording-time or semantic attachment',()=>{
 const scene=fixture(),record=rec('research-session:test',{source:'research-session',title:'Research',description:'Refused interpretation',researchRecordedAt:at(11),occurredAt:at(11)});
 expect(enrichWindowEvidence(scene,[record]).matches).toHaveLength(0);
 const linked={...record,payload:{...(record.payload as object),sourceWindowId:scene.journeyEpisodes![0].id}};
 const archive=enrichWindowEvidence(scene,[linked]);expect(archive.matches).toMatchObject([{status:'attached',basis:'explicit-source-link'}]);expect(archive.artifacts[0].kind).toBe('author');expect(archive.artifacts[0].preview[0]).toContain('not event or attendance evidence');
});
