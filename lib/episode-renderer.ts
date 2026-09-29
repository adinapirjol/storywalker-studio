import { acceptedDensity, spacePosition, type EpisodeSpace, type Regime, type Point } from './journey-experience';
import {drawSourceWindows} from './archive-renderer';
import type {WindowEvidence} from './xr-evidence';
import type { Decision } from './xr-scene';
import {projectPoint,type WalkCamera} from './spatial-projection';
export {projectPoint,type WalkCamera} from './spatial-projection';
export type Hit = { index: number; x: number; y: number; radius: number; windowId?:string; corners?:{x:number;y:number}[]; depth?:number };
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
