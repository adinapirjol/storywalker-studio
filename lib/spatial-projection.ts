import type {Point} from './journey-experience';
export type WalkCamera = { x: number; z: number; yaw: number; eye: number };
export function projectPoint(p: Point & {y?:number}, camera: WalkCamera, width: number, height: number) {
  const dx=p.x-camera.x, dz=p.z-camera.z, c=Math.cos(camera.yaw), s=Math.sin(camera.yaw);
  const depth=dx*s-dz*c, lateral=dx*c+dz*s;
  if(depth<.15) return null;
  const scale=Math.min(width,height)*.9/depth;
  return {x:width/2+lateral*scale,y:height*.52+(camera.eye-(p.y??0))*scale,scale,depth};
}
