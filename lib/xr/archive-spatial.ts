import type {WalkCamera} from './episode-renderer';
import type {Point} from './journey-experience';
import {windowDepth,type WindowEvidence} from './xr-evidence';
export type ArchiveView={phase:'corridor'|'surface'|'chamber';windowId:string|null;page:number;artifactPage:number;origin:WalkCamera|null;anchor:Point|null;yaw:number;openedAt:number};
export const CLOSED_ARCHIVE:ArchiveView={phase:'corridor',windowId:null,page:0,artifactPage:0,origin:null,anchor:null,yaw:0,openedAt:0};
export function openEvidence(windowId:string,camera:WalkCamera,now:number):ArchiveView{return {...CLOSED_ARCHIVE,phase:'surface',windowId,origin:{...camera},anchor:{x:camera.x+Math.sin(camera.yaw)*3.8,z:camera.z-Math.cos(camera.yaw)*3.8},yaw:camera.yaw,openedAt:now};}
export function crossedPlane(before:Point,after:Point,anchor:Point,yaw:number,halfWidth=2.8){
 const normal={x:Math.sin(yaw),z:-Math.cos(yaw)},tangent={x:Math.cos(yaw),z:Math.sin(yaw)};
 const side=(p:Point)=>(p.x-anchor.x)*normal.x+(p.z-anchor.z)*normal.z;
 const a=side(before),b=side(after);if(a>=0||b<0||b===a)return false;
 const t=-a/(b-a),x=before.x+(after.x-before.x)*t-anchor.x,z=before.z+(after.z-before.z)*t-anchor.z;
 return Math.abs(x*tangent.x+z*tangent.z)<=halfWidth;
}
export function chamberStep(before:WalkCamera,after:WalkCamera){
 const exits=before.z<1.8&&after.z>=1.8&&Math.abs(after.x)<1.4;
 return {exits,camera:{...after,x:Math.max(-3.7,Math.min(3.7,after.x)),z:Math.max(-5.7,Math.min(1.75,after.z))}};
}
export function sourceWindowPlanes(windows:WindowEvidence[],position:Point,page:number){
 const start=Math.max(0,Math.min(Math.floor(page),Math.max(0,Math.ceil(windows.length/4)-1)))*4;
 return windows.slice(start,start+4).map((window,i,subset)=>({window,index:start+i,x:position.x+(i-(subset.length-1)/2)*.8,z:position.z-.3-windowDepth(window.durationHours,window.approximate),width:.68,height:1.9}));
}
