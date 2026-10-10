import {expect,it} from 'vitest';
import {bodyFace,bodyPetAt,defaultBodyView,orbitBody,zoomBody,rotateBodyPoint} from './body-view';
it('keeps camera controls bounded and rejects invalid gesture values',()=>{
 expect(orbitBody(defaultBodyView,0,9999).pitch).toBe(1.15);
 expect(orbitBody(defaultBodyView,0,-9999).pitch).toBe(-1.15);
 expect(Math.abs(orbitBody(defaultBodyView,999999,0).yaw)).toBeLessThanOrEqual(Math.PI);
 expect(zoomBody(defaultBodyView,100).zoom).toBe(1.6);
 expect(zoomBody(defaultBodyView,.001).zoom).toBe(.65);
 expect(zoomBody(defaultBodyView,NaN)).toEqual(defaultBodyView);
 expect(orbitBody(defaultBodyView,Infinity,2)).toEqual(defaultBodyView);
});
it('rotates the face to the back and preserves point length',()=>{
 expect(rotateBodyPoint(0,0,1,Math.PI,0).z).toBeCloseTo(-1);
 const p=rotateBodyPoint(.3,.4,Math.sqrt(.75),.7,.4);
 expect(Math.hypot(p.x,p.y,p.z)).toBeCloseTo(1);
});
it('maps authored visual bands without inferring states or mutating readings',()=>{
 expect([null,NaN,0,79.9,80,119.9,120,159.9,160].map(bodyFace)).toEqual(['neutral','neutral','neutral','crescent','arc','arc','round','round','wide']);
});

it('pets only near the projected body and never needs a heart reading',()=>{
 expect(bodyPetAt(350,228.8,700,520,1)?.strength).toBe(1);
 expect(bodyPetAt(0,0,700,520,1)).toBeNull();
 expect(bodyPetAt(100,100,0,0,1)).toBeNull();
 expect(bodyPetAt(NaN,100,700,520,1)).toBeNull();
});
