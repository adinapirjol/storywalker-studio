import { expect,it } from 'vitest';
import { PalmOpen, palmPose, PalmZoom, fingerSpread } from './palm-open';
it('requires gathering before opening and fires only once',()=>{
 const s=new PalmOpen();expect(s.sample('open',0)).toBe(false);expect(s.sample('open',300)).toBe(false);
 s.sample('gathered',400);s.sample('gathered',700);expect(s.phase).toBe('armed');
 expect(s.sample('open',800)).toBe(false);expect(s.sample('open',1000)).toBe(true);
 expect(s.sample('open',1100)).toBe(false);s.sample('open',1500);s.sample('open',2000);expect(s.sample('open',2400)).toBe(false);
});
it('cancels when tracking disappears',()=>{
 const s=new PalmOpen();s.sample('gathered',0);s.sample('gathered',300);s.sample('missing',400);
 expect(s.sample('open',500)).toBe(false);expect(s.sample('open',800)).toBe(false);
});

it('distinguishes clustered fingertips from a spread palm using hand-relative scale',()=>{
 const points=Array.from({length:21},()=>({x:.5,y:.6}));
 points[0]={x:.5,y:.9};points[5]={x:.4,y:.6};points[17]={x:.6,y:.6};
 for(const i of [4,8,12,16,20])points[i]={x:.5,y:.4};
 expect(palmPose([points])).toBe('gathered');
 points[4]={x:.1,y:.5};points[8]={x:.32,y:.15};points[12]={x:.48,y:.1};points[16]={x:.62,y:.15};points[20]={x:.77,y:.25};
 expect(palmPose([points])).toBe('open');expect(palmPose([points,points])).toBe('missing');
});

it('reverse requires an open-palm hold then gathered fingertips, once per cycle',()=>{
 const s=new PalmOpen(true);
 expect(s.sample('gathered',0)).toBe(false);expect(s.sample('gathered',300)).toBe(false);
 s.sample('open',400);s.sample('open',700);expect(s.phase).toBe('armed');
 expect(s.sample('gathered',800)).toBe(false);expect(s.sample('gathered',1000)).toBe(true);
 expect(s.sample('gathered',1100)).toBe(false);
});
it('reverse cancels on missing hands and does not fire from an index swipe',()=>{
 const s=new PalmOpen(true);s.sample('open',0);s.sample('open',300);s.sample('missing',400);
 expect(s.sample('gathered',500)).toBe(false);expect(s.sample('gathered',800)).toBe(false);
 const index=new PalmOpen(true);index.sample('other',0);index.sample('other',300);
 expect(index.sample('gathered',400)).toBe(false);
});

it('continuous zoom follows intermediate spread and can reverse without a new trigger',()=>{
 const p=Array.from({length:21},()=>({x:.5,y:.6}));p[0]={x:.5,y:.9};p[5]={x:.4,y:.6};p[17]={x:.6,y:.6};
 for(const i of [4,8,12,16,20])p[i]={x:.5,y:.4};
 const z=new PalmZoom();expect(z.sample([p],false,0)).toBeNull();expect(z.sample([p],false,300)).toBe(0);
 p[4]={x:.32,y:.4};p[20]={x:.68,y:.4};const half=z.sample([p],true,400)!;
 expect(half).toBeGreaterThan(0);expect(half).toBeLessThan(1);
 p[4]={x:.15,y:.4};p[20]={x:.85,y:.4};expect(z.sample([p],true,500)).toBe(1);
 for(const i of [4,8,12,16,20])p[i]={x:.5,y:.4};expect(z.sample([p],true,600)).toBe(0);
 expect(z.sample([],false,700)).toBeNull();expect(z.active).toBe(false);
 expect(fingerSpread([p,p])).toBeNull();
});
