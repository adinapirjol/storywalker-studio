import {describe,it,expect} from 'vitest';
import {contextRoom} from './context-xr';
import type {ContextState} from './context-contract';
describe('context room boundary',()=>{
 it('uses silent bounded dimensions and makes refusal a real relationship state',()=>{
  const state={captures:[{id:'fiction',triggering_ids:[],context:{start:'2030-01-01T00:00:00Z',end:'2030-01-01T00:01:00Z',revision:1,coverage_s:30,stale_location:true,observation_ids:[]}}],proposals:[{id:'p',capture_id:'fiction'}],decisions:[{proposal_id:'p',status:'refused'}],memories:[],observations:[]} as unknown as ContextState;
  const room=contextRoom(state);
  expect(room.scene.cues).toHaveLength(4);
  expect(room.scene.cues.every(c=>c.treatment==='silent'&&c.source==='demo')).toBe(true);
  expect(room.decisions['context-0-memory']).toBe('refused');
  expect(room.scene.cues.find(c=>c.id==='context-0-body')?.note).toContain('Source deleted');
 });
});
