import {projectPoint,type WalkCamera} from './spatial-projection';
import {sourceWindowPlanes,type ArchiveView} from './archive-spatial';
import type {WindowEvidence,ArchiveArtifact} from './xr-evidence';
import type {Point} from './journey-experience';
export type PlaneHit={windowId:string;x:number;y:number;radius:number;corners:{x:number;y:number}[];depth:number};
const cards=new Map<string,HTMLCanvasElement>();
const thumbnails=new Map<string,HTMLImageElement>();
function wrap(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,lineHeight:number,max=5){let line='',row=0;for(const word of text.split(/\s+/)){const next=line?line+' '+word:word;if(ctx.measureText(next).width>width&&line){ctx.fillText(line,x,y+row*lineHeight);if(++row>=max)return y+row*lineHeight;line=word;}else line=next;}if(line)ctx.fillText(line,x,y+row++*lineHeight);return y+row*lineHeight;}
function texture(key:string,title:string,eyebrow:string,lines:string[],footer:string,image?:string){
 const signature=JSON.stringify([key,title,eyebrow,lines,footer,image?.slice(-40)]);const existing=cards.get(signature);if(existing)return existing;
 const c=document.createElement('canvas');c.width=900;c.height=650;const ctx=c.getContext('2d')!;
 ctx.fillStyle='#132129';ctx.fillRect(0,0,900,650);ctx.strokeStyle='#b3c5c55a';ctx.lineWidth=2;ctx.strokeRect(14,14,872,622);
 ctx.font='15px monospace';ctx.fillStyle='#91b0b5';ctx.fillText(eyebrow.slice(0,88),40,48);ctx.fillStyle='#eee5d3';ctx.font='32px Georgia';let y=wrap(ctx,title,40,100,820,38,2)+20;
 if(image){let img=thumbnails.get(image);if(!img){img=new Image();img.src=image;thumbnails.set(image,img);img.onload=()=>cards.delete(signature);if(thumbnails.size>12)thumbnails.delete(thumbnails.keys().next().value!);}if(img.complete&&img.naturalWidth){const scale=Math.min(300/img.naturalWidth,220/img.naturalHeight);ctx.drawImage(img,550,y,img.naturalWidth*scale,img.naturalHeight*scale);}}
 ctx.font='21px Georgia';ctx.fillStyle='#beced0';for(const line of lines){if(y>540)break;y=wrap(ctx,line,40,y,image?475:810,27,4)+16;}
 ctx.strokeStyle='#b3c5c52a';ctx.beginPath();ctx.moveTo(40,575);ctx.lineTo(860,575);ctx.stroke();ctx.font='13px monospace';ctx.fillStyle='#93afb2';wrap(ctx,footer,40,604,810,17,2);
 cards.set(signature,c);if(cards.size>40)cards.delete(cards.keys().next().value!);return c;
}
/** Texture a real world-space quadrilateral. Two affine triangles per strip keep
 * text attached to its perspective plane while the viewer moves. */
function plane(ctx:CanvasRenderingContext2D,w:number,h:number,camera:WalkCamera,position:Point,yaw:number,width:number,height:number,image:HTMLCanvasElement,bottom=.25,opacity=1){
 const t={x:Math.cos(yaw),z:Math.sin(yaw)};
 const project=(u:number,v:number)=>projectPoint({x:position.x+t.x*(u-.5)*width,z:position.z+t.z*(u-.5)*width,y:bottom+(1-v)*height},camera,w,h);
 const corners=[project(0,0),project(1,0),project(1,1),project(0,1)];if(corners.some(p=>!p))return null;
 ctx.save();ctx.globalAlpha=opacity;
 function triangle(src:number[][],dst:NonNullable<ReturnType<typeof project>>[]){const [a,b,c]=src,[p,q,r]=dst;const det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);if(!det)return;
  const A=((q.x-p.x)*(c[1]-a[1])-(r.x-p.x)*(b[1]-a[1]))/det,B=((q.y-p.y)*(c[1]-a[1])-(r.y-p.y)*(b[1]-a[1]))/det,C=((r.x-p.x)*(b[0]-a[0])-(q.x-p.x)*(c[0]-a[0]))/det,D=((r.y-p.y)*(b[0]-a[0])-(q.y-p.y)*(c[0]-a[0]))/det;
  ctx.save();ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.lineTo(r.x,r.y);ctx.closePath();ctx.clip();ctx.transform(A,B,C,D,p.x-A*a[0]-C*a[1],p.y-B*a[0]-D*a[1]);ctx.drawImage(image,0,0);ctx.restore();
 }
 for(let i=0;i<8;i++){const u=i/8,v=(i+1)/8,p=[project(u,0)!,project(v,0)!,project(v,1)!,project(u,1)!];triangle([[u*image.width,0],[v*image.width,0],[v*image.width,image.height]],[p[0],p[1],p[2]]);triangle([[u*image.width,0],[v*image.width,image.height],[u*image.width,image.height]],[p[0],p[2],p[3]]);}
 ctx.restore();return corners as NonNullable<ReturnType<typeof project>>[];
}
export function pointInsidePlane(x:number,y:number,corners:{x:number;y:number}[]){let sign=0;for(let i=0;i<corners.length;i++){const a=corners[i],b=corners[(i+1)%corners.length],cross=(b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x);if(Math.abs(cross)<.001)continue;const next=Math.sign(cross);if(sign&&sign!==next)return false;sign=next;}return !!sign;}
function inventoryTexture(window:WindowEvidence,index:number){
 const counts=Object.entries(window.artifacts.reduce<Record<string,number>>((n,a)=>({...n,[a.kind]:(n[a.kind]??0)+1}),{}));
 const key=JSON.stringify(['inventory',window.windowId,index,window.start,counts,window.candidates]);const cached=cards.get(key);if(cached)return cached;
 // Portrait previews match the entrance geometry. Reading material expands only
 // after selection; squeezing a landscape evidence surface here made it illegible.
 const c=document.createElement('canvas');c.width=300;c.height=840;const ctx=c.getContext('2d')!;
 ctx.fillStyle='#13212988';ctx.fillRect(0,0,300,840);ctx.strokeStyle='#b3c5c580';ctx.lineWidth=2;ctx.strokeRect(4,4,292,832);
 ctx.fillStyle='#eee5d3';ctx.font='32px Georgia';ctx.fillText(`Window ${index+1}`,22,65);
 ctx.font='18px monospace';ctx.fillStyle='#b8cccf';ctx.fillText(window.start.slice(0,10),22,105);ctx.fillText(window.start.slice(11,16),22,134);
 ctx.font='23px Georgia';let y=215;
 for(const [kind,count] of counts)y=wrap(ctx,`${count} ${kind}`,22,y,256,30,2)+15;
 if(!counts.length)wrap(ctx,'No attached evidence',22,y,256,30,3);
 ctx.font='17px monospace';if(window.candidates)wrap(ctx,`${window.candidates} candidates withheld`,22,675,256,24,3);
 ctx.fillText('Open to explore',22,793);
 cards.set(key,c);if(cards.size>40)cards.delete(cards.keys().next().value!);return c;
}
export function drawSourceWindows(ctx:CanvasRenderingContext2D,w:number,h:number,camera:WalkCamera,windows:WindowEvidence[],position:Point,page:number):PlaneHit[]{
 const hits:PlaneHit[]=[];
 for(const p of sourceWindowPlanes(windows,position,page)){
  const tex=inventoryTexture(p.window,p.index);
  const corners=plane(ctx,w,h,camera,{x:p.x,z:p.z},0,p.width,p.height,tex,.3,.9);if(corners){const center=projectPoint({x:p.x,z:p.z,y:1.25},camera,w,h)!;hits.push({windowId:p.window.windowId,x:center.x,y:center.y,radius:0,corners,depth:center.depth});}
 }
 return hits;
}
export function surfaceTexture(window:WindowEvidence,page:number){const rows=window.artifacts.slice(page*3,page*3+3);return texture(`surface:${window.windowId}:${page}`,window.label,`SOURCE WINDOW / ${window.start.slice(0,16)} / ${window.artifacts.length} ARTEFACTS`,rows.length?rows.flatMap(a=>[`${a.kind.toUpperCase()} / ${a.title}`,a.preview[0]??'Source has no textual preview.']):['No supported artefacts. This surface is intentionally sparse.'],`${window.windowId} · page ${page+1}/${Math.max(1,Math.ceil(window.artifacts.length/3))} · Cross this plane to enter the same archive.`);}
export function drawEvidenceSurface(ctx:CanvasRenderingContext2D,w:number,h:number,camera:WalkCamera,view:ArchiveView,window:WindowEvidence,source:Point,now:number,reducedMotion:boolean){
 if(!view.anchor)return;
 // Only representation animates: source anchors and chronology are untouched.
 const t=reducedMotion?1:Math.min(1,Math.max(0,(now-view.openedAt)/550)),ease=1-Math.pow(1-t,3),p={x:source.x+(view.anchor.x-source.x)*ease,z:source.z+(view.anchor.z-source.z)*ease};
 plane(ctx,w,h,camera,p,view.yaw,1+(5-1)*ease,1.9+(2.7-1.9)*ease,surfaceTexture(window,view.artifactPage));
}
export function drawEvidenceChamber(ctx:CanvasRenderingContext2D,w:number,h:number,camera:WalkCamera,window:WindowEvidence,page:number){
 ctx.fillStyle='#080f16';ctx.fillRect(0,0,w,h);
 const project=(x:number,z:number,y=0)=>projectPoint({x,z,y},camera,w,h);
 const line=(a:number[],b:number[],color='#8fa6ae50')=>{const p=project(a[0],a[1],a[2]??0),q=project(b[0],b[1],b[2]??0);if(!p||!q)return;ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();};
 // Fixed bounds for navigation, never a reconstruction of the recorded place.
 for(const y of [0,3.8]){line([-4,-6,y],[4,-6,y]);line([-4,-6,y],[-4,2,y]);line([4,-6,y],[4,2,y]);line([-4,2,y],[4,2,y]);}
 for(const x of [-4,4])for(const z of [-6,2])line([x,z,0],[x,z,3.8]);
 const artefacts=window.artifacts.slice(page*6,page*6+6);
 const placements=[{x:-1.65,z:-5.4,yaw:0},{x:1.65,z:-5.4,yaw:0},{x:-3.8,z:-3.5,yaw:-Math.PI/2},{x:3.8,z:-3.5,yaw:Math.PI/2},{x:-3.8,z:-.8,yaw:-Math.PI/2},{x:3.8,z:-.8,yaw:Math.PI/2}];
 const ordered=artefacts.map((a,i)=>({a,p:placements[i],d:Math.hypot(camera.x-placements[i].x,camera.z-placements[i].z)})).sort((a,b)=>b.d-a.d);
 for(const {a,p} of ordered)plane(ctx,w,h,camera,p,p.yaw,2.7,2.05,artifactTexture(a),.65);
 const doorway=texture('exit','Return to TIME','CROSS BACK', ['The corridor is unchanged.','This chamber contains archival evidence, not a reconstruction of a physical place.'],window.windowId);
 plane(ctx,w,h,camera,{x:0,z:1.9},Math.PI,2.5,2.9,doorway,0,.6);
 if(!artefacts.length){const empty=project(0,-5,1.7);if(empty){ctx.textAlign='center';ctx.font='20px Georgia';ctx.fillStyle='#b4c2c5';ctx.fillText('No supported artefacts in this window.',empty.x,empty.y);ctx.textAlign='left';}}
}
function artifactTexture(a:ArchiveArtifact){return texture(a.id,a.title,`${a.kind.toUpperCase()} / ${a.precision.toUpperCase()}`,a.preview,`${a.sourceId} · ${a.fingerprint.slice(0,16)}`,a.thumbnail);}
