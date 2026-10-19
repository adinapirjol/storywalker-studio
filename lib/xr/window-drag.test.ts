import { expect, it } from 'vitest';
import { AirSwipe } from './air-swipe';
import { followWindowDrag } from './window-drag';
it('follows intermediate finger positions instead of jumping',()=>{
 const x=followWindowDrag(0,.6,1/60);expect(x).toBeGreaterThan(0);expect(x).toBeLessThan(.6);
});
it('converges at different refresh rates and settles exactly',()=>{
 for(const fps of [30,60,120]){let x=0;for(let i=0;i<fps;i++)x=followWindowDrag(x,-1,1/fps);expect(x).toBe(-1);}
});
it('returns to the original view on cancellation and supports reversing',()=>{
 let x=followWindowDrag(0,-.7,.05);expect(followWindowDrag(x,.4,.05)).toBeGreaterThan(x);
 for(let i=0;i<60;i++)x=followWindowDrag(x,0,1/60);expect(x).toBe(0);
});
it('bounds input and uses direct follow for reduced motion',()=>{
 expect(followWindowDrag(0,8,1/60,true)).toBe(1);
 expect(followWindowDrag(0,NaN,.05)).toBe(0);
});

it('lets a continuous drag pause midway without expiring',()=>{
 const swipe=new AirSwipe(.08,Infinity);
 for(let t=0;t<=300;t+=100)swipe.sample({x:.5,y:.5},t);
 for(let t=400;t<=4000;t+=100)swipe.sample({x:.54,y:.5},t);
 expect(swipe.feedback.phase).toBe('ready');expect(swipe.feedback.progress).toBeCloseTo(-.5);
 expect(swipe.sample({x:.59,y:.5},4100)).toBe(1);
});
