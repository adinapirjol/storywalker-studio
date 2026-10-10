import {rotateBodyPoint,type BodyFace,type BodyPet} from './body-view';
import { acceptedDensity, spacePosition, type EpisodeSpace, type Regime, type Point } from './journey-experience';
import {drawSourceWindows} from './archive-renderer';
import type {WindowEvidence} from './xr-evidence';
import type { Decision } from './xr-scene';
import {projectPoint,type WalkCamera} from './spatial-projection';
export {projectPoint,type WalkCamera} from './spatial-projection';
export type Hit = { index: number; x: number; y: number; radius: number; windowId?:string; corners?:{x:number;y:number}[]; depth?:number };
/** BODY geometry uses the episode room projection; artistic colours never encode health. */
export function drawBodyCompanion(ctx:CanvasRenderingContext2D,width:number,height:number,heart:number|null,tempo:number|null,yaw:number,appearance:{shape?:'orb'|'companion';fieldScale?:number;history?:number[];audioBands?:number[];palette?:'lilac'|'lagoon'|'ember';wireframe?:boolean;pitch?:number;zoom?:number;face?:BodyFace;pet?:BodyPet|null;inspectEvidence?:boolean}={}) {
 ctx.clearRect(0,0,width,height);ctx.fillStyle='#090f1b';ctx.fillRect(0,0,width,height);
 const colours={lilac:['#baa4e4','#665985','#292538'],lagoon:['#9bcfc6','#426e78','#162f3a'],ember:['#e4c197','#876374','#352734']} as const;
 const [light,middle,dark]=colours[appearance.palette??'ember'];
 const cx=width/2,cy=height*.44,radius=Math.min(width*.22,height*.21)*Math.max(.65,Math.min(1.6,appearance.zoom??1));
 const pitch=appearance.pitch??0;
 const camera:WalkCamera={x:0,z:4.4,yaw:0,eye:1.5};
 const origin=projectPoint({x:0,y:1.5,z:0},camera,width,height)!;
 const project=(x:number,y:number,z:number)=>{const rotated=rotateBodyPoint(x,y,z,yaw,pitch),p=projectPoint({...rotated,y:rotated.y+1.5},camera,width,height)!;return {x:cx+(p.x-origin.x)*radius/origin.scale,y:cy+(p.y-origin.y)*radius/origin.scale};};
 const scale=Math.max(1,Math.min(1.04,appearance.fieldScale??1));
 const halo=ctx.createRadialGradient(cx,cy,radius*.6,cx,cy,radius*2.1);halo.addColorStop(0,middle+'36');halo.addColorStop(1,middle+'00');ctx.fillStyle=halo;ctx.fillRect(0,0,width,height);
 // The orbital layers are authored scenery, independent of measured values.
 for(let ring=0;ring<3;ring++){
  ctx.beginPath();ctx.ellipse(cx,cy,radius*(1.55+ring*.12)*scale,radius*(.56+ring*.09)*scale,-.28,0,Math.PI*2);
  ctx.lineWidth=ring===0?1.2:.7;ctx.strokeStyle=light+(ring===0?'70':'30');ctx.stroke();
 }
 if(appearance.shape==='companion'){
  const reach=heart===null?.3:.3+Math.max(0,Math.min(200,heart))/200*.6;
  for(const side of [-1,1]){const a=project(side*.65,.6,0),b=project(side*(1+reach),1.05,.15),c=project(side*.85,-.3,0);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(b.x,b.y,c.x,c.y);ctx.closePath();ctx.fillStyle=middle+'88';ctx.fill();ctx.strokeStyle=light+'aa';ctx.lineWidth=1;ctx.stroke();}
 }
 const fill=ctx.createRadialGradient(cx-radius*.3,cy-radius*.4,radius*.04,cx,cy,radius);fill.addColorStop(0,light);fill.addColorStop(.48,middle);fill.addColorStop(1,dark);
 ctx.fillStyle=fill;ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.fill();ctx.strokeStyle=light+'88';ctx.lineWidth=1;ctx.stroke();
 if(appearance.wireframe){
  for(let latitude=-60;latitude<=60;latitude+=30){const a=latitude*Math.PI/180;ctx.beginPath();for(let step=0;step<=96;step++){const t=step/96*Math.PI*2,p=project(Math.cos(a)*Math.cos(t),Math.sin(a),Math.cos(a)*Math.sin(t));if(step===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}ctx.strokeStyle=light+'44';ctx.lineWidth=.8;ctx.stroke();}
  for(let longitude=0;longitude<180;longitude+=30){const a=longitude*Math.PI/180;ctx.beginPath();for(let step=0;step<=96;step++){const t=step/96*Math.PI*2,p=project(Math.cos(t)*Math.cos(a),Math.sin(t),Math.cos(t)*Math.sin(a));if(step===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}ctx.strokeStyle=light+'33';ctx.stroke();}
 }
 for(const [i,value,limit,colour] of [[0,heart,200,'#cce6df'],[1,tempo,400,'#e8c997']] as const){
  const r=radius*(1.22+i*.18);ctx.setLineDash(i?[3,7]:[]);ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle='#79879733';ctx.lineWidth=1;ctx.stroke();
  if(value!==null){ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,Math.min(limit,value))/limit);ctx.strokeStyle=colour;ctx.lineWidth=2;ctx.stroke();}
 }
 ctx.setLineDash([]);
 if(appearance.shape==='companion'&&rotateBodyPoint(0,0,1,yaw,pitch).z>.24){
  const face=appearance.face??'neutral',pet=appearance.pet;
  const gazeX=(pet?.x??0)*.035,gazeY=-(pet?.y??0)*.025;
  const facePoint=(x:number,y:number)=>project(x,y,Math.sqrt(Math.max(0,1-x*x-y*y))*1.015);
  const strokeFace=(points:{x:number;y:number}[],fill=false)=>{ctx.beginPath();points.forEach((p,i)=>{const q=facePoint(p.x,p.y);if(i===0)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y);});ctx.strokeStyle='#fff3de';ctx.fillStyle='#fff3de';ctx.lineWidth=Math.max(1.5,radius*.022);ctx.lineCap='round';if(fill){ctx.closePath();ctx.fill();}else ctx.stroke();};
  for(const side of [-1,1]){
   const x=side*.23+gazeX,y=.17+gazeY;
   if(face==='crescent'||(pet?.strength??0)>.65)strokeFace(Array.from({length:17},(_,i)=>({x:x-.065+i/16*.13,y:y-.025*Math.sin(i/16*Math.PI)})));
   else {const rx=face==='wide'?.055:.032,ry=face==='wide'?.085:.055;strokeFace(Array.from({length:25},(_,i)=>({x:x+rx*Math.cos(i/24*Math.PI*2),y:y+ry*Math.sin(i/24*Math.PI*2)})),true);}
  }
  if(face==='round'||face==='wide')strokeFace(Array.from({length:25},(_,i)=>({x:(face==='wide'?.075:.043)*Math.cos(i/24*Math.PI*2),y:-.16+.055*Math.sin(i/24*Math.PI*2)})));
  else strokeFace(Array.from({length:17},(_,i)=>({x:-.10+i/16*.20,y:-.12-(face==='neutral'?0:.045*Math.sin(i/16*Math.PI))})));
  if(pet){for(const side of [-1,1]){const cheek=facePoint(side*.36,-.03);ctx.beginPath();ctx.ellipse(cheek.x,cheek.y,radius*.045,radius*.022,0,0,Math.PI*2);ctx.fillStyle=`rgba(232,201,151,${pet.strength*.45})`;ctx.fill();}}
  ctx.lineCap='butt';
 }
 (appearance.history??[]).slice(-8).forEach((value,i)=>{const angle=-Math.PI*.9+i*.15,r=radius*(1.49+Math.max(0,Math.min(200,value))/200*.12);ctx.beginPath();ctx.arc(cx+Math.cos(angle)*r,cy+Math.sin(angle)*r,2.3,0,Math.PI*2);ctx.fillStyle='#c6d9df';ctx.fill();});
 // Always show eight quiet antennae. Only actual generated audio extends them.
 ctx.lineCap='round';
 for(let i=0;i<8;i++){
  const level=Math.max(0,Math.min(1,appearance.audioBands?.[i]??0)),angle=-Math.PI/2+i*Math.PI/4;
  const inner=radius*1.72,outer=radius*(1.81+level*.16);
  ctx.beginPath();ctx.moveTo(cx+Math.cos(angle)*inner,cy+Math.sin(angle)*inner);ctx.lineTo(cx+Math.cos(angle)*outer,cy+Math.sin(angle)*outer);ctx.strokeStyle=appearance.audioBands?'#e8c997':'#8aa3a377';ctx.lineWidth=3;ctx.stroke();
  ctx.beginPath();ctx.arc(cx+Math.cos(angle)*outer,cy+Math.sin(angle)*outer,2.4,0,Math.PI*2);ctx.fillStyle=appearance.audioBands?'#e8c997':'#8aa3a3';ctx.fill();
 }
 if(appearance.inspectEvidence){ctx.lineCap='butt';ctx.textAlign='center';ctx.fillStyle='#fff5e4';ctx.font='26px Georgia';ctx.fillText(heart===null?'—':`${Math.round(heart)} bpm`,cx,height-43);ctx.font='10px sans-serif';ctx.fillStyle='#bfccd5';ctx.fillText('SELECTED MEASUREMENT',cx,height-22);ctx.textAlign='left';}
}
export function renderEpisodeRoom(ctx: CanvasRenderingContext2D, width:number,height:number, spaces:EpisodeSpace[], regime:Regime, base:'WORLD'|'TIME', camera:WalkCamera, selected:number, decisions:Record<string,Decision>, placements:Map<string,string[]>,windows:WindowEvidence[]=[],windowPage=0,dim=false) {
  const hits:Hit[]=[];
  ctx.clearRect(0,0,width,height);
  const backdrop=ctx.createLinearGradient(0,0,0,height); backdrop.addColorStop(0,'#090c18');backdrop.addColorStop(.52,'#161d2b');backdrop.addColorStop(1,'#070b11');ctx.fillStyle=backdrop;ctx.fillRect(0,0,width,height);
  const glow=ctx.createRadialGradient(width*.52,height*.5,0,width*.52,height*.5,width*.6);glow.addColorStop(0,'#68709022');glow.addColorStop(1,'#00000000');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
  const project=(p:Point,y=0)=>projectPoint({...p,y},camera,width,height);
  function line(a:Point,b:Point,color:string,dashed=false,y=.02){const p=project(a,y),q=project(b,y);if(!p||!q)return;ctx.beginPath();ctx.setLineDash(dashed?[3,7]:[]);ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);}
  ctx.globalAlpha=dim?.18:1;
  // A faint chronological floor trace, not a geographic route or intensity ranking.
  const points=spaces.map(s=>spacePosition(s,regime,base));
  for(let i=1;i<points.length;i++)line(points[i-1],points[i],regime==='WORLD'?'#b4dace18':'#e5c8a12c',true);
  const ordered=spaces.map((space,index)=>({space,index,p:points[index],depth:project(points[index],1)?.depth??-1})).sort((a,b)=>b.depth-a.depth);
  for(const {space,index,p,depth} of ordered){
    if(depth<=0)continue;
    const near=Math.hypot(p.x-camera.x,p.z-camera.z)<7, focused=index===selected, count=acceptedDensity(space,decisions);
    const top=2.7, half=regime==='TIME'?1.65:space.transit?.65:1.05;
    const color=space.author?'195,177,230':'170,210,205';
    const screen=project(p,1.3);if(!screen||screen.x < -width ||screen.x>width*2)continue;
    const portal=(pos:Point,ghost=false)=>{
      // Fixed-height frames: aesthetic scale is constant, never emotional importance.
      for(let layer=regime==='TIME'?1:3;layer>=0;layer--){
        const depth=space.author?.45:Math.min(2.4,.3+Math.log2(1+space.durationHours)*.25);
        const z=pos.z-layer*(regime==='TIME'?depth:.42);
        const verts=[project({x:pos.x-half,z},0),project({x:pos.x-half,z},top),project({x:pos.x+half,z},top),project({x:pos.x+half,z},0)];
        if(verts.some(v=>!v))continue;
        const v=verts as NonNullable<ReturnType<typeof project>>[];
        ctx.beginPath();v.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();
        if(!ghost){const g=ctx.createLinearGradient(v[1].x,v[1].y,v[0].x,v[0].y);g.addColorStop(0,`rgba(${color},${layer===0?.13:.03})`);g.addColorStop(1,`rgba(${color},.01)`);ctx.fillStyle=g;ctx.fill();}
        ctx.setLineDash(ghost?[3,6]:[]);ctx.strokeStyle=ghost?'#f1e5c648':`rgba(${color},${focused?.7:.24})`;ctx.lineWidth=ghost?.7:focused?1.5:.8;ctx.stroke();ctx.setLineDash([]);
      }
    };
    if(regime==='MEMORY'){
      portal(space.world,true);
      // The authored displacement is always WORLD -> stored MEMORY. A TIME
      // presentation offset must never masquerade as an Author move.
      if(Math.hypot(space.memory.x-space.world.x,space.memory.z-space.world.z)>.001){
        line(space.world,space.memory,'#ecd0abcc',false,.08);
        if(base==='TIME')portal(space.memory,true);
      }
      if(base==='TIME'&&focused)line(space.memory,p,'#aab4ca30',true,.04);
      const ghost=project(space.world,.08);if(ghost&&focused){ctx.font='10px monospace';ctx.fillStyle='#cbbda1';ctx.fillText('WORLD GHOST',ghost.x+6,ghost.y);}
    }
    portal(p);
    const foot=project(p,.015);
    if(foot && (regime!=='TIME'||(near&&count>0))){ctx.save();ctx.translate(foot.x,foot.y);const r=Math.min(300,foot.scale*2.3);ctx.scale(1,.19);const g=ctx.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,`rgba(${color},.19)`);g.addColorStop(1,`rgba(${color},0)`);ctx.fillStyle=g;ctx.fillRect(-r,-r,r*2,r*2);ctx.restore();}
    // One filament per 25 accepted selection matches, bounded for legibility. Counts can overlap.
    const filaments=regime==='TIME'&&!near?0:Math.min(48,Math.ceil(count/25));
    for(let j=0;j<filaments;j++){
      const px=p.x-half+.1+(j%12)/11*(half*2-.2),z=p.z-.2-Math.floor(j/12)*.27;
      const a=project({x:px,z},.15),b=project({x:px,z},.4+((j*17)%23)/12);
      if(a&&b){ctx.strokeStyle='#efc69665';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
    }
    // Source traces appear only nearby; no persistent GPS markers.
    if(near||focused||(regime==='TIME'&&index%5===0)){
      ctx.font=`${focused?14:11}px Georgia`;ctx.textAlign='center';ctx.fillStyle=focused?'#fff3dc':'#c6d3d4';
      const t=project(p,top+.3);if(t){ctx.fillText(String(index+1).padStart(2,'0')+' / '+space.label.slice(0,48),t.x,t.y);}
      const b=project(p,-.3);if(b&&near){ctx.font='10px monospace';ctx.fillStyle='#a9b9bd';ctx.fillText(`${space.members.length} source windows  ·  ${space.count} plays`,b.x,b.y);}
      const titles=near&&regime!=='TIME'?(placements.get(space.id)??[]):[];
      titles.slice(0,3).forEach((title,i)=>{const q=project(p,1.65-i*.3);if(q){ctx.font='italic 12px Georgia';ctx.fillStyle='#eee1c9';ctx.fillText(title.slice(0,52),q.x,q.y);}});
      ctx.textAlign='left';
    }
    if(regime==='TIME'&&near&&focused&&!dim){
      const contained=space.members.map(i=>windows[i]).filter(Boolean);
      hits.push(...drawSourceWindows(ctx,width,height,camera,contained,p,focused?windowPage:0).map(h=>({...h,index})));
    }
    if(!dim){
      const corners=[project({x:p.x-half,z:p.z},0),project({x:p.x-half,z:p.z},top),project({x:p.x+half,z:p.z},top),project({x:p.x+half,z:p.z},0)];
      if(corners.every(q=>q!==null))hits.push({index,x:screen.x,y:screen.y,radius:0,corners:corners as {x:number;y:number}[],depth:screen.depth});
    }
  }
  ctx.globalAlpha=1;
  const shade=ctx.createLinearGradient(0,height*.72,0,height);shade.addColorStop(0,'#070b1100');shade.addColorStop(1,'#070b11bb');ctx.fillStyle=shade;ctx.fillRect(0,0,width,height);
  return hits;
}
