export type AtlasView={yaw:number;tilt:number;zoom:number};
// Author-approved oblique overview: chronology remains visibly vertical.
export const DEFAULT_ATLAS_VIEW:AtlasView={yaw:-.22,tilt:.78,zoom:1};
export const MEMORY_ATLAS_VIEW:AtlasView={yaw:.4,tilt:.3,zoom:1};
export function atlasProject(p:{x:number;z:number;y?:number},view:AtlasView,w:number,h:number){const scale=Math.min(w,h)/65*view.zoom,c=Math.cos(view.yaw),s=Math.sin(view.yaw);return {x:w/2+(p.x*c-p.z*s)*scale,y:h*.59+(p.x*s+p.z*c)*Math.sin(view.tilt)*scale-(p.y??0)*Math.cos(view.tilt)*scale};}
export function atlasDrag(dx:number,dy:number,view:AtlasView,w:number,h:number){const scale=Math.min(w,h)/65*view.zoom,c=Math.cos(view.yaw),s=Math.sin(view.yaw),right=dx/scale,forward=dy/(scale*Math.sin(view.tilt));return {x:right*c+forward*s,z:-right*s+forward*c};}
export function chronologicalHeight(start:string,first:string,last:string){const span=Date.parse(last)-Date.parse(first);return 2+(span>0?Math.max(0,Math.min(1,(Date.parse(start)-Date.parse(first))/span))*12:0);}
