import {expect,it} from 'vitest';
import {advanceLook,beginLook,pickArchiveHit,walkWheelDelta} from './archive-interaction';
import type {Hit} from './episode-renderer';
const corners=[{x:10,y:10},{x:80,y:15},{x:70,y:100},{x:20,y:95}];
const episode:Hit={index:0,x:45,y:50,radius:100,corners,depth:5};
const window:Hit={...episode,windowId:'fixture-window',depth:6};
it('keeps a click tremor still, and a vertical or returning drag cannot become a click',()=>{
 const start=beginLook(100,100),tremor=advanceLook(start,102,101);
 expect(tremor.yawDelta).toBe(0);expect(tremor.gesture.dragged).toBe(false);
 const vertical=advanceLook(start,100,120);expect(vertical.gesture.dragged).toBe(true);
 expect(advanceLook(vertical.gesture,100,100).gesture.dragged).toBe(true);
 const turn=advanceLook(start,110,100);expect(turn.yawDelta).toBeCloseTo(-.04);
 expect(advanceLook(turn.gesture,115,100).yawDelta).toBeCloseTo(-.02);
 expect(walkWheelDelta(1,0,700)).toBe(.004);
 expect(walkWheelDelta(10000,0,700)).toBe(.6);
 expect(walkWheelDelta(-1,2,700)).toBe(-.6);
});
it('targets the visible plane, not a large invisible circular marker',()=>{
 expect(pickArchiveHit([episode],0,50,'corridor')).toBeUndefined();
 expect(pickArchiveHit([episode],40,50,'corridor')).toBe(episode);
 expect(pickArchiveHit([episode,window],40,50,'corridor')).toBe(window);
 const closer={...window,windowId:'closer-window',depth:3};
 expect(pickArchiveHit([closer,window],40,50,'corridor')).toBe(closer);
});
it('cannot select dimmed chronology through an open surface or chamber',()=>{
 expect(pickArchiveHit([episode,window],40,50,'surface')).toBeUndefined();
 expect(pickArchiveHit([episode,window],40,50,'chamber')).toBeUndefined();
});
