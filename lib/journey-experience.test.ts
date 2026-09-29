import { expect, it } from 'vitest';
import { groundJourney } from './journey-grounding';
import { episodeSpaces, spacePosition, moveEpisodeSpace } from './journey-experience';
import { DEMO_XR_SCENE, xrSceneSchema, parseSceneFile, reviewExport } from './xr-scene';
import { validateDraftReview } from './xr-draft';
import { projectPoint } from './episode-renderer';
const at=(d:number)=>`2026-05-${d}T00:00:00Z`;
function fixture(){return groundJourney(DEMO_XR_SCENE,{schemaVersion:1,source:'google-timeline',importedAt:at(28),schemaEncountered:'fixture',records:[15,16,17,22].map((d,i)=>({kind:'visit',startAt:at(d),endAt:at(d+1),latitude:40,longitude:i===2?12:10+i*.01,certainty:'reported',authorCorrected:false}))},{schemaVersion:1,source:'lastfm-scrobbles',importedAt:at(28),records:[]},{from:at(15),toExclusive:at(28),timelineToExclusive:at(27),timeZone:'UTC',sources:[{type:'timeline',id:'t',fingerprint:'t',capturedAt:at(28)},{type:'lastfm',id:'l',fingerprint:'l',capturedAt:at(28)}]});}
it('contains nearby consecutive raw stops without altering the source; keeps departures and return gaps distinct',()=>{
 const scene=fixture(),before=JSON.stringify(scene),spaces=episodeSpaces(scene);
 expect(spaces.map(s=>s.members)).toEqual([[0,1],[2],[3]]);
 expect(spaces[0].durationHours).toBe(48);expect(JSON.stringify(scene)).toBe(before);
 expect(spacePosition(spaces[0],'MEMORY','TIME')).toEqual(spaces[0].time);
 expect(spacePosition(spaces[0],'MEMORY','WORLD')).toEqual(spaces[0].world);
});
it('moves a container rigidly, records the representation base, preserves source and round trips decisions',()=>{
 const scene=fixture(),group=episodeSpaces(scene)[0];const moved=moveEpisodeSpace(scene,group,1,1,'TIME',at(28));
 for(let i=0;i<2;i++){
  const a=scene.journeyEpisodes![i],b=moved.journeyEpisodes![i];expect(b.worldPosition).toEqual(a.worldPosition);expect(b.listening).toEqual(a.listening);expect(b.provenance).toEqual(a.provenance);
  expect(b.memoryPosition!.x-a.memoryPosition!.x).toBeCloseTo(1);expect(b.memoryDecisions.at(-1)).toMatchObject({representationBase:'TIME',author:'Author',interpretation:'None inferred'});
 }
 expect(moved.journeyEpisodes![2]).toEqual(scene.journeyEpisodes![2]);
 expect(validateDraftReview(scene,{scene:moved,decisions:{}}).scene).toEqual(moved);
 expect(parseSceneFile(reviewExport(moved,{})).scene).toEqual(moved);
 const gs=episodeSpaces(moved)[0],p=spacePosition(gs,'MEMORY','TIME');expect(p.x-gs.time.x).toBeCloseTo(gs.memory.x-gs.world.x);
 const extreme=moveEpisodeSpace(scene,group,999,-999,'WORLD');expect(xrSceneSchema.safeParse(extreme).success).toBe(true);
});
it('preserves composition history, refuses unknown placement and rejects source tampering',()=>{
 const scene=fixture();scene.cues[0].source='author';
 const composed={...scene,experience:{regime:'MEMORY' as const,memoryBase:'TIME' as const,fragmentDecisions:[{cueId:'listening',episodeId:scene.journeyEpisodes![0].id,at:at(28),author:'Author' as const,interpretation:'Composition only; no factual association inferred' as const}]}};
 expect(validateDraftReview(scene,{scene:composed,decisions:{}}).scene.experience).toEqual(composed.experience);
 expect(()=>validateDraftReview(composed,{scene,decisions:{}})).toThrow('composition');
 expect(xrSceneSchema.safeParse({...composed,experience:{...composed.experience,fragmentDecisions:[{...composed.experience.fragmentDecisions[0],episodeId:'invented'}]}}).success).toBe(false);
 const forged=structuredClone(composed);forged.journeyEpisodes![0].start=at(14);expect(()=>validateDraftReview(scene,{scene:forged,decisions:{}})).toThrow();
});
it('perspective hides positions behind the walker and honours orientation',()=>{
 const camera={x:0,z:10,yaw:0,eye:1.7};expect(projectPoint({x:0,z:12},camera,1000,700)).toBeNull();expect(projectPoint({x:0,z:0},camera,1000,700)?.x).toBe(500);
 expect(projectPoint({x:10,z:10},{...camera,yaw:Math.PI/2},1000,700)?.x).toBeCloseTo(500);
});
