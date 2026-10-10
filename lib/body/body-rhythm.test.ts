import {afterEach,describe,expect,it,vi} from 'vitest';
import {BodyRhythm,musicalBrief,rhythmBands,rhythmTempo} from './body-rhythm';
import {drawBodyCompanion} from '@/lib/xr/episode-renderer';

afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
describe('original BODY audio boundaries',()=>{
 it('uses bounded musical tempo and eight spectrum bands, including silence',()=>{
  expect([NaN,-10,113.7,900].map(rhythmTempo)).toEqual([96,30,114,240]);
  const silence=new Uint8Array(1024);expect(rhythmBands(silence,48000,2048)).toEqual(Array(8).fill(0));
  silence[2]=255;const levels=rhythmBands(silence,48000,2048);expect(levels).toHaveLength(8);expect(levels[0]).toBe(1);expect(levels[7]).toBe(0);
 });
 it('exports explicit creative choices without musical tempo or any external data fields',()=>{
  const brief=musicalBrief('deep','broken','spacious');
  expect(brief).toContain('deep sine bass');expect(brief).toContain('syncopated');expect(brief).toContain('spacious');
  expect(brief).not.toMatch(/\d|Spotify|HealthKit|heart|artist name|source_id/);
 });
 it('rounds only the canvas label while preserving the supplied reading',()=>{
  const text:string[]=[];const ctx=new Proxy({fillText:(value:string)=>text.push(value),createRadialGradient:()=>({addColorStop:()=>{}})},{get:(target,key)=>key in target?target[key as keyof typeof target]:()=>{}}) as unknown as CanvasRenderingContext2D;
  const value=113.22080993652344;drawBodyCompanion(ctx,700,400,value,null,0,{inspectEvidence:true});
  expect(text).toContain('113 bpm');expect(text.join(' ')).not.toContain(String(value));expect(value).toBe(113.22080993652344);
  text.length=0;drawBodyCompanion(ctx,700,400,value,null,0);expect(text).toEqual([]);
 });
 it('closes audio and prevents scheduling when stopped during resume',async()=>{
  vi.useFakeTimers();let resume:()=>void=()=>{};let voices=0;const close=vi.fn().mockResolvedValue(undefined);
  const parameter={value:0,setTargetAtTime:()=>{}};
  class Context {
   currentTime=0;state='running';sampleRate=48000;destination={};close=close;
   createGain(){return {gain:parameter,connect:()=>{},disconnect:()=>{}};}
   createAnalyser(){return {fftSize:2048,frequencyBinCount:1024,smoothingTimeConstant:0,connect:()=>{}};}
   createOscillator(){voices++;throw Error('Stopped engine must not schedule');}
   resume(){return new Promise<void>(resolve=>{resume=resolve;});}
  }
  vi.stubGlobal('AudioContext',Context);
  const engine=new BodyRhythm();engine.configure(96,.12,'warm','steady');const started=engine.start();engine.stop();resume();await started;
  vi.advanceTimersByTime(1000);expect(voices).toBe(0);expect(close).toHaveBeenCalledOnce();expect(engine.levels()).toEqual(Array(8).fill(0));expect(vi.getTimerCount()).toBe(0);
 });
});
