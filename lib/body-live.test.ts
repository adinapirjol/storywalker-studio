import {expect,it} from 'vitest';
import {liveBodyWindows,liveSampleFresh,liveSampleStatus,type BodyLiveSample} from './body-live';
import type {Observation} from './native-transfer-contract';
const now=Date.parse('2030-01-01T12:00:00Z');
const value:BodyLiveSample={observation:{id:'fictional-test',event_start:new Date(now-20_000).toISOString(),event_end:new Date(now-20_000).toISOString(),payload:{kind:'heart_rate',value:127.3,unit:'bpm'}} as Observation,arrivedAt:new Date(now).toISOString()};
it('expires independently on transport silence and measurement age; rejects future clocks',()=>{
 expect(liveSampleFresh(value,now)).toBe(true);
 expect(liveSampleFresh(value,now+15_001)).toBe(false);
 expect(liveSampleFresh({...value,observation:{...value.observation,event_start:new Date(now-120_001).toISOString()}},now)).toBe(false);
 expect(liveSampleFresh(value,now-21_000)).toBe(false);
 expect(liveSampleFresh(null,now)).toBe(false);
});
it('keeps precision and identity, does not interpolate, and labels retained older visual support',()=>{
 const windows=liveBodyWindows(value,now);expect(windows[0].readings).toEqual([value.observation]);
 expect(windows[0].support).toBe('not accepted evidence');
 expect(liveBodyWindows(value,now+16_000)[0].stale).toBe(true);
 expect(liveSampleStatus(value,now+300_000)).toContain('Last-known pose · not current · measured 5 minutes ago');
 expect(liveSampleStatus(value,now+16_000)).toContain('Phone delivery quiet');
 expect(liveBodyWindows(value,now-21_000)).toEqual([]);
});

it('re-delivery of an old measurement never presents it as current',()=>{
 const repeated={...value,lastContactAt:new Date(now+300_000).toISOString()};
 expect(liveSampleFresh(repeated,now+300_000)).toBe(false);
 expect(liveSampleStatus(repeated,now+300_000)).toContain('not current');
 expect(liveBodyWindows(null,now)).toEqual([]);
});
