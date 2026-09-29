import {it,expect} from 'vitest';
import {researchPayload,researchSessionSchema} from './research-session';
import {applyEditorialAction,createEditorialExperiment} from './editorial-experiment';
import {atlasProject,atlasDrag,chronologicalHeight} from './atlas-spatial';
import {FICTIONAL_ECHOES,createLocativeSession,processLocativePosition,refuseActivatedEcho} from './locative';
import {buildLocalRetrievalIndex} from './private-retrieval-index';
it('retains responses for accept and refuse without substituting them for a revision',()=>{
 const accepted=applyEditorialAction(createEditorialExperiment(),'accept','Author response');
 expect(accepted.revisedWording).toBeUndefined();expect(accepted.audit[0]).toMatchObject({wording:'Author response',at:expect.any(String)});
 const refused=applyEditorialAction(accepted,'refuse','Do not connect these');expect(refused.audit[1].wording).toBe('Do not connect these');expect(refused.canonical).toBe(false);
});
it('minimises snapshots, distinguishes recording time and indexes Author responses',()=>{
 const input=researchSessionSchema.parse({study:'refusal',title:'Editorial study',note:'Boundary',entries:[{action:'refuse',subject:'fiction',wording:'Do not infer attendance'}],latitude:45,longitude:12});
 const payload=researchPayload(input,'2026-09-29T00:00:00Z');expect(payload).not.toHaveProperty('latitude');expect(payload).not.toHaveProperty('occurredAt');expect(payload.canonical).toBe(false);expect(payload.evidence).toContain('Do not infer attendance');
 expect(buildLocalRetrievalIndex([{id:'research-session:test',kind:'capture',capturedAt:payload.researchRecordedAt,payload}]).records[0].terms).toContain('attendance');
});
it('inverts screen drags at a fixed chronological height across orbit angles and zoom',()=>{
 for(const yaw of [-2,0,1])for(const zoom of [.4,1,4]){const view={yaw,tilt:.65,zoom},a=atlasProject({x:3,z:-4,y:8},view,1200,760),b=atlasProject({x:5,z:-7,y:8},view,1200,760),d=atlasDrag(b.x-a.x,b.y-a.y,view,1200,760);expect(d.x).toBeCloseTo(2);expect(d.z).toBeCloseTo(-3);}
 expect(chronologicalHeight('2026-06-01','2026-06-01','2026-06-11')).toBe(2);expect(chronologicalHeight('2026-06-11','2026-06-01','2026-06-11')).toBe(14);
});
it('keeps a refused re-entry echo silent until reset',()=>{
 const echo=FICTIONAL_ECHOES[1];let s=processLocativePosition([echo],echo.centre,createLocativeSession());s=refuseActivatedEcho(s,echo.id);s=processLocativePosition([echo],{latitude:0,longitude:.1},s);s=processLocativePosition([echo],echo.centre,s);expect(s.lastEvents[0].triggered).toBe(false);
});
