import { expect, it } from 'vitest';
import { AirSwipe } from './air-swipe';
function arm(s: AirSwipe, start = 0) { for (const t of [0, 100, 200, 300]) s.sample({ x: .5, y: .5 }, start + t); }
it('maps a physical left sweep to next and right to previous', () => {
 const s = new AirSwipe(); arm(s); expect(s.sample({ x: .72, y: .5 }, 450)).toBe(1);
 s.reset(); arm(s); expect(s.sample({ x: .28, y: .5 }, 450)).toBe(-1);
});
it('rejects jitter, vertical motion, missing hands and stale frame jumps', () => {
 const s = new AirSwipe(); arm(s); expect(s.sample({ x: .52, y: .5 }, 400)).toBeNull();
 expect(s.sample({ x: .8, y: .8 }, 500)).toBeNull();
 s.reset(); arm(s); s.sample(null, 400); expect(s.sample({ x: .8, y: .5 }, 500)).toBeNull();
 s.reset(); arm(s); expect(s.sample({ x: .8, y: .5 }, 1200)).toBeNull();
});
it('requires another hold after cooldown; return motion cannot skip a second window', () => {
 const s = new AirSwipe(); arm(s); expect(s.sample({ x: .75, y: .5 }, 450)).toBe(1);
 expect(s.sample({ x: .2, y: .5 }, 600)).toBeNull();
 arm(s, 1800); expect(s.sample({ x: .28, y: .5 }, 2250)).toBe(-1);
});

it('stays ready while the user reads instructions, then accepts a slower small sweep', () => {
 const s = new AirSwipe(); arm(s);
 for(let t=400;t<=3000;t+=100) s.sample({x:.5,y:.5},t);
 expect(s.feedback.phase).toBe('ready');
 s.sample({x:.54,y:.52},3400); s.sample({x:.58,y:.53},3800);
 expect(s.sample({x:.64,y:.54},4200)).toBe(1);
 expect(s.feedback.phase).toBe('cooldown');
 s.sample(null,4300); expect(s.feedback.direction).toBe(1);
});
it('arms at low frame rates and reports partial sweep progress', () => {
 const s = new AirSwipe(); s.sample({x:.5,y:.5},0); s.sample({x:.51,y:.5},450);
 expect(s.feedback.phase).toBe('ready');
 expect(s.sample({x:.57,y:.52},900)).toBeNull();
 expect(s.feedback.progress).toBeCloseTo(-.5);
 expect(s.sample({x:.65,y:.54},1350)).toBe(1);
});
