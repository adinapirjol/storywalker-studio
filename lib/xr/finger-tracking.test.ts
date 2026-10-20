import { expect, it } from 'vitest';
import { indexPointer, type HandPoint } from './finger-tracking';
import { AirSwipe } from './air-swipe';
function hand(): HandPoint[] { const p = Array.from({length:21},()=>({x:.5,y:.8})); p[6]={x:.5,y:.55};p[8]={x:.5,y:.25}; return p; }
it('uses the index tip with all other fingers curled',()=>{const p=hand();expect(indexPointer([p])).toEqual(p[8]);});
it('rejects folded index, multiple hands, incomplete and invalid landmarks',()=>{
 const p=hand();p[8]={x:.5,y:.75};expect(indexPointer([p])).toBeNull();
 expect(indexPointer([hand(),hand()])).toBeNull();expect(indexPointer([])).toBeNull();
 expect(indexPointer([[{x:0,y:0}]])).toBeNull();p[8].x=NaN;expect(indexPointer([p])).toBeNull();
});
it('browses with an index movement while the wrist stays still',()=>{
 const s=new AirSwipe(.08),p=hand();for(const t of [0,100,200,300])s.sample(indexPointer([p]),t);
 p[8]={x:.59,y:.25};expect(s.sample(indexPointer([p]),450)).toBe(1);
 expect(p[0]).toEqual({x:.5,y:.8});
});
