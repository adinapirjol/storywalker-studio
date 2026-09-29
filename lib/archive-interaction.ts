import {pointInsidePlane} from './archive-renderer';
import type {ArchiveView} from './archive-spatial';
import type {Hit} from './episode-renderer';

export type LookGesture = {x:number;y:number;lastX:number;dragged:boolean};
export function beginLook(x:number,y:number):LookGesture{return {x,y,lastX:x,dragged:false};}
export function walkWheelDelta(delta:number,mode:number,height:number){
 const pixels=delta*(mode===1?16:mode===2?height:1);
 return Math.max(-.6,Math.min(.6,pixels*.004));
}
export function advanceLook(g:LookGesture,x:number,y:number){
 const dragged=g.dragged||Math.hypot(x-g.x,y-g.y)>=5;
 // A small click tremor must not turn the camera underneath the hit test.
 return {gesture:{...g,lastX:x,dragged},yawDelta:dragged?(x-(g.dragged?g.lastX:g.x))*-.004:0};
}
export function pickArchiveHit(hits:Hit[],x:number,y:number,phase:ArchiveView['phase']){
 // Once an archive is open, dimmed chronology is context, not a click target.
 if(phase!=='corridor')return undefined;
 const inside=hits.filter(h=>h.corners?pointInsidePlane(x,y,h.corners):Math.hypot(h.x-x,h.y-y)<h.radius);
 const windows=inside.filter(h=>h.windowId);
 return (windows.length?windows:inside).sort((a,b)=>(a.depth??Infinity)-(b.depth??Infinity))[0];
}
