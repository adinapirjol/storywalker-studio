import {describe,it,expect} from 'vitest';
import {bodyWindows,groupBodyWindows,tempoAt,bodyPlaybackDelay,bodyFieldScale,type BodyWindow} from './body-composition';
import type {ContextState,Observation} from './context-contract';
const at=(second:number)=>new Date(Date.UTC(2030,4,1,12,0,second)).toISOString();
const observation=(id:string,payload:Observation['payload'],start=0,end=start):Observation=>({id,payload,source_id:id,source_type:'fictional',acquisition:'simulated',event_start:at(start),event_end:at(end),received_at:at(end+50),schema_version:1,source_revision:'1',device_revision:null,original_offset:'+00:00',semantics:'measurement',provenance:'source_recorded',quality:[]});
const place=observation('place',{kind:'location',label:'Fictional square',city:'Tidal City',country:'Imagined Coast',accuracy_m:120});
const window=(start:number,end:number):BodyWindow=>({id:String(start),start:at(start),end:at(end),revision:1,readings:[],listening:[],locations:[place],relationship:'awaiting Author',support:'no canonical account',stale:false});
describe('BODY composition boundaries',()=>{
 it('compresses sparse evidence only in explicit preview mode without changing evidence or order',()=>{
  const readings=[observation('a',{kind:'heart_rate',value:113.22,unit:'bpm'},0),observation('b',{kind:'heart_rate',value:115,unit:'bpm'},410)];
  const original=JSON.stringify(readings);
  expect(bodyPlaybackDelay(readings,0,5)).toBe(82000);
  expect(bodyPlaybackDelay(readings,0,5,'preview')).toBe(2000);
  expect(bodyPlaybackDelay(readings,0,20,'preview')).toBe(2000);
  expect(bodyPlaybackDelay(readings,1,5,'preview')).toBeNull();
  expect(bodyPlaybackDelay([...readings].reverse(),0,5,'preview')).toBeNull();
  expect(JSON.stringify(readings)).toBe(original);
 });
 it('replays measurement gaps at 1/5/20x without changing values or using arrival time',()=>{
  const readings=[observation('first',{kind:'heart_rate',value:130,unit:'bpm'},30),observation('late',{kind:'heart_rate',value:131,unit:'bpm'},35)];
  expect([1,5,20].map(speed=>bodyPlaybackDelay(readings,0,speed))).toEqual([5000,1000,250]);
  expect(bodyPlaybackDelay(readings,1,5)).toBeNull();
  expect(bodyPlaybackDelay(readings,0,0)).toBeNull();
  expect(bodyPlaybackDelay([...readings].reverse(),0,5)).toBeNull();
  expect(readings[1].payload).toMatchObject({value:131});
 });
 it('bounds the fictional field and removes motion when paused or reduced motion is selected',()=>{
  expect(bodyFieldScale(.5,96,.04,false,false)).toBe(1);
  expect(bodyFieldScale(.5,96,.04,true,true)).toBe(1);
  expect(bodyFieldScale(0,96,.04,true,false)).toBe(1);
  expect(bodyFieldScale(1.25,96,.04,true,false)).toBeCloseTo(1.04);
  expect(bodyFieldScale(2.5,96,.04,true,false)).toBeCloseTo(1);
  expect(bodyFieldScale(1,NaN,.04,true,false)).toBe(1);
  for(let time=0;time<10;time+=.1)expect(bodyFieldScale(time,900,1,true,false)).toBeLessThanOrEqual(1.04);
 });
 it('uses event time, keeps uncertain or multiple tempos, and never uses receipt time to match',()=>{
  const w=window(0,90);w.listening=[observation('bell',{kind:'listening',label:'Original fictional bell',policy:'fictional',tempo_bpm:96},10,30)];
  expect(tempoAt(w,observation('heart',{kind:'heart_rate',unit:'bpm',value:130},20))).toHaveLength(1);
  expect(tempoAt(w,observation('late',{kind:'heart_rate',unit:'bpm',value:130},80))).toHaveLength(0);
 });
 it('merges only consecutive supported labels, deduplicates interval duration and splits gaps or stale geography',()=>{
  expect(groupBodyWindows([window(0,60),window(30,90)],'city')[0].coveredSeconds).toBe(90);
  expect(groupBodyWindows([window(0,60),window(400,460)],'city')).toHaveLength(2);
  expect(groupBodyWindows([window(0,60),{...window(60,90),stale:true},window(90,120)],'country')).toHaveLength(3);
  const elsewhere={...place,payload:{...place.payload,city:'Another fictional city'}} as Observation;
  expect(groupBodyWindows([window(0,60),{...window(60,90),locations:[elsewhere]}],'city')).toHaveLength(2);
  expect(groupBodyWindows([window(0,60),{...window(60,90),locations:[elsewhere]}],'country')).toHaveLength(1);
 });
 it('excludes real health, unpermitted listening and deleted sources; refusal and invalidation survive',()=>{
  const heart=observation('h',{kind:'heart_rate',value:140,unit:'bpm'}),real={...heart,id:'real',source_type:'healthkit',acquisition:'historical'};
  const forbidden={...observation('s',{kind:'listening',label:'forbidden',policy:'fictional',tempo_bpm:120}),source_type:'spotify'};
  const state={observations:[heart,real,forbidden],captures:[{id:'c',context:{start:at(0),end:at(60),revision:2,observation_ids:['h','real','s'],stale_location:true}}],proposals:[{id:'p',capture_id:'c'}],decisions:[{proposal_id:'p',status:'refused'}],memories:[{id:'c:memory:1',support:'invalidated'}],deleted_sources:[]} as unknown as ContextState;
  expect(bodyWindows(state)[0]).toMatchObject({relationship:'refused',support:'invalidated',listening:[]});
  expect(bodyWindows(state)[0].readings.map(o=>o.id)).toEqual(['h']);
  state.deleted_sources=['h'];expect(bodyWindows(state)[0].readings).toHaveLength(0);
 });
});
