'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { episodeSpaces, spacePosition, moveEpisodeSpace, type Regime } from '@/lib/journey-experience';
import { renderEpisodeRoom, type Hit, type WalkCamera } from '@/lib/episode-renderer';
import type { XRScene, Decision } from '@/lib/xr-scene';
import {windowEvidence} from '@/lib/xr-evidence';
import {CLOSED_ARCHIVE,openEvidence,crossedPlane,chamberStep,sourceWindowPlanes,type ArchiveView} from '@/lib/archive-spatial';
import {drawEvidenceSurface,drawEvidenceChamber} from '@/lib/archive-renderer';
import {beginLook,advanceLook,pickArchiveHit,walkWheelDelta,type LookGesture} from '@/lib/archive-interaction';
import css from './xr-experience.module.css';
import {XRGeographicAtlas} from './xr-geographic-atlas';

type Props={scene:XRScene;decisions:Record<string,Decision>;activated:boolean;onChange:(scene:XRScene)=>void;onInspect:(index:number)=>void;onCalibrate:()=>void};
export function XREpisodeExperience({scene,decisions,activated,onChange,onInspect,onCalibrate}:Props){
 const spaces=useMemo(()=>episodeSpaces(scene),[scene]);
 const experience=scene.experience??{regime:'TIME' as Regime,memoryBase:'TIME' as const,fragmentDecisions:[]};
 const {regime,memoryBase}=experience;
 const windows=useMemo(()=>windowEvidence(scene,decisions),[scene,decisions]);
 const [archiveView,setArchiveView]=useState<ArchiveView>(CLOSED_ARCHIVE),[windowPage,setWindowPage]=useState(0);
 const archive=useRef<ArchiveView>(CLOSED_ARCHIVE);
 const activeWindow=windows.find(w=>w.windowId===archiveView.windowId);
 function updateArchive(next:ArchiveView){archive.current=next;setArchiveView(next);}
 function closeArchive(){keys.current.clear();const origin=archive.current.origin;if(origin)camera.current={...origin};updateArchive(CLOSED_ARCHIVE);setMessage('Returned to the unchanged TIME corridor.');}
 function selectWindow(id:string){stopSound();setInspecting(false);updateArchive(openEvidence(id,camera.current,performance.now()));setMessage('Evidence surface opened inside TIME. Walk through the plane or press Enter.');canvas.current?.focus({preventScroll:true});}
 function enterChamber(){if(archive.current.phase!=='surface')return;updateArchive({...archive.current,phase:'chamber',artifactPage:0});camera.current={x:0,z:.8,yaw:0,eye:1.7};keys.current.clear();setMessage('Archival composition, not a reconstruction of the place. Turn around and cross back to TIME.');}
 function moveCamera(next:WalkCamera){const view=archive.current,before=camera.current;
  if(view.phase==='chamber'){const step=chamberStep(before,next);if(step.exits){closeArchive();return;}camera.current=step.camera;}
  else {camera.current=next;if(view.phase==='surface'&&view.anchor&&crossedPlane(before,next,view.anchor,view.yaw))enterChamber();}
 }

 const [selected,setSelected]=useState(0),[inspecting,setInspecting]=useState(false),[immersive,setImmersive]=useState(false),[moving,setMoving]=useState(false),[message,setMessage]=useState(''),[near,setNear]=useState(false),[sounding,setSounding]=useState(false);
 const index=Math.min(selected,spaces.length-1),current=spaces[index],position=spacePosition(current,regime,memoryBase);
 const root=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),camera=useRef<WalkCamera>({x:4,z:2,yaw:-.46,eye:1.7}),keys=useRef(new Set<string>()),hits=useRef<Hit[]>([]);
 const gesture=useRef<LookGesture|null>(null),redraw=useRef<()=>void>(()=>{});
 const engine=useRef<{context:AudioContext;voices:{cueId:string;spaceId:string;osc:OscillatorNode;gain:GainNode;panner:PannerNode}[]}|null>(null);
 const fragments=useMemo(()=>{const map=new Map<string,string[]>();for(const space of spaces){
  const music=space.selections.filter(s=>decisions[s.cueId]==='accepted').map(s=>scene.cues.find(c=>c.id===s.cueId)!.title);
  const authored=scene.cues.filter(c=>c.source==='author'&&decisions[c.id]==='accepted'&&[...(scene.experience?.fragmentDecisions??[])].reverse().find(d=>d.cueId===c.id)?.episodeId===space.id).map(c=>c.title);
  map.set(space.id,[...authored,...music]);
 }return map;},[spaces,scene,decisions]);
 function focus(i:number){if(archive.current.phase!=='corridor')closeArchive();setWindowPage(0);const n=Math.max(0,Math.min(spaces.length-1,i)),p=spacePosition(spaces[n],regime,memoryBase);setSelected(n);setInspecting(false);camera.current={x:p.x+2.7,z:p.z+5.7,yaw:-.443,eye:1.7};redraw.current();canvas.current?.focus({preventScroll:true});}
 function stopSound(){const old=engine.current;engine.current=null;if(old){old.voices.forEach(v=>v.osc.stop());void old.context.close();}setSounding(false);}
 async function sound(){if(engine.current){stopSound();return;}try{
  const context=new AudioContext();await context.resume();
  const voices=spaces.flatMap(space=>space.selections.filter(s=>decisions[s.cueId]==='accepted'&&scene.cues.find(c=>c.id===s.cueId)?.treatment!=='silent').slice(0,2).map(s=>{
   const cue=scene.cues.find(c=>c.id===s.cueId)!,osc=context.createOscillator(),gain=context.createGain(),panner=context.createPanner();osc.frequency.value=cue.frequency;gain.gain.value=0;panner.panningModel='HRTF';panner.rolloffFactor=0;osc.connect(gain).connect(panner).connect(context.destination);osc.start();return {cueId:cue.id,spaceId:space.id,osc,gain,panner};
  }));engine.current={context,voices};setSounding(true);setMessage('Synthetic locator tones enabled. These are not recordings or a reconstruction of what you heard.');
 }catch{stopSound();setMessage('Audio unavailable; the silent rehearsal remains usable.');}}
 function changeRegime(next:Regime){if(archive.current.phase!=='corridor')closeArchive();stopSound();setMoving(false);setInspecting(false);onChange({...scene,experience:{...experience,regime:next}});}
 function move(dx:number,dz:number){onChange(moveEpisodeSpace(scene,current,dx,dz,memoryBase));setMessage('Author displacement recorded; WORLD and source evidence preserved. Save review to Vault to keep it.');}
 function windowMatchMedia(){return window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
 function place(cueId:string,episodeId:string|null){onChange({...scene,experience:{...experience,fragmentDecisions:[...experience.fragmentDecisions,{cueId,episodeId,at:new Date().toISOString(),author:'Author',interpretation:'Composition only; no factual association inferred'}]}});setMessage('Composition decision recorded. This does not establish where or when the work was experienced. Save review to keep it.');}
 useEffect(()=>{if(!activated){const old=engine.current;engine.current=null;if(old){old.voices.forEach(v=>v.osc.stop());void old.context.close();}}},[activated]);
 useEffect(()=>{
  const element=canvas.current;if(!element)return;
  const ctx=element.getContext('2d');if(!ctx)return;
  let frame=0,last=performance.now(),lastNear=0;
  const draw=()=>{const rect=element.getBoundingClientRect(),ratio=Math.min(2,window.devicePixelRatio||1);if(element.width!==Math.round(rect.width*ratio)||element.height!==Math.round(rect.height*ratio)){element.width=Math.round(rect.width*ratio);element.height=Math.round(rect.height*ratio);}ctx.setTransform(ratio,0,0,ratio,0,0);
   const view=archive.current,evidenceWindow=windows.find(w=>w.windowId===view.windowId);
   if(regime==='TIME'&&view.phase==='chamber'&&evidenceWindow){drawEvidenceChamber(ctx,rect.width,rect.height,camera.current,evidenceWindow,view.artifactPage);hits.current=[];}
   else{
    hits.current=renderEpisodeRoom(ctx,rect.width,rect.height,spaces,regime,memoryBase,camera.current,index,decisions,fragments,windows,windowPage,view.phase==='surface');
    if(regime==='TIME'&&view.phase==='surface'&&evidenceWindow){const group=spaces.find(s=>s.members.some(i=>windows[i]?.windowId===evidenceWindow.windowId));const contained=group?.members.map(i=>windows[i])??[];const source=group?sourceWindowPlanes(contained,group.time,Math.floor(contained.findIndex(w=>w.windowId===evidenceWindow.windowId)/4)).find(p=>p.window.windowId===evidenceWindow.windowId):undefined;drawEvidenceSurface(ctx,rect.width,rect.height,camera.current,view,evidenceWindow,source??position,performance.now(),windowMatchMedia());}
   }
  };
  redraw.current=draw;
  const tick=(now:number)=>{const dt=Math.min(.05,(now-last)/1000);last=now;const c={...camera.current},k=keys.current;
   if(k.has('arrowleft'))c.yaw-=dt;if(k.has('arrowright'))c.yaw+=dt;
   const f=Number(k.has('w')||k.has('arrowup'))-Number(k.has('s')||k.has('arrowdown')),side=Number(k.has('d'))-Number(k.has('a'));
   c.x=Math.max(-60,Math.min(60,c.x+(Math.sin(c.yaw)*f+Math.cos(c.yaw)*side)*dt*3));c.z=Math.max(-60,Math.min(60,c.z+(-Math.cos(c.yaw)*f+Math.sin(c.yaw)*side)*dt*3));
   moveCamera(c);
   if(now-lastNear>200){const p=spacePosition(spaces[index],regime,memoryBase);setNear(Math.hypot(p.x-c.x,p.z-c.z)<7);lastNear=now;}
   const audio=engine.current;if(audio){const l=audio.context.listener;l.positionX.value=c.x;l.positionY.value=c.eye;l.positionZ.value=c.z;l.forwardX.value=Math.sin(c.yaw);l.forwardY.value=0;l.forwardZ.value=-Math.cos(c.yaw);l.upX.value=0;l.upY.value=1;l.upZ.value=0;
    // Normalise the sum; dense groups cannot make the room unexpectedly loud.
    const active=audio.voices.map(v=>{const s=spaces.find(s=>s.id===v.spaceId)!,p=spacePosition(s,regime,memoryBase),g=Math.max(0,1-Math.hypot(p.x-c.x,p.z-c.z)/6);return {v,p,g};});const sum=Math.max(1,active.reduce((s,v)=>s+v.g,0));
    for(const {v,p,g} of active){v.panner.positionX.value=p.x;v.panner.positionY.value=1.4;v.panner.positionZ.value=p.z;v.gain.gain.setTargetAtTime(activated?g/sum*.018:0,audio.context.currentTime,.15);}
   }
   draw();frame=requestAnimationFrame(tick);
  };
  const heldKeys=keys.current;
  const blur=()=>{heldKeys.clear();const old=engine.current;engine.current=null;if(old){old.voices.forEach(v=>v.osc.stop());void old.context.close();setSounding(false);}};
  const wheel=(e:WheelEvent)=>{e.preventDefault();const amount=walkWheelDelta(e.deltaY,e.deltaMode,element.clientHeight),c={...camera.current};c.x=Math.max(-60,Math.min(60,c.x-Math.sin(c.yaw)*amount));c.z=Math.max(-60,Math.min(60,c.z+Math.cos(c.yaw)*amount));moveCamera(c);draw();};
  element.addEventListener('wheel',wheel,{passive:false});
  const visibility=()=>{if(document.hidden)blur();};window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);frame=requestAnimationFrame(tick);
  return()=>{element.removeEventListener('wheel',wheel);cancelAnimationFrame(frame);heldKeys.clear();window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);};
 },[spaces,regime,memoryBase,index,decisions,fragments,activated,windows,windowPage]);
 useEffect(()=>()=>{const old=engine.current;if(old)void old.context.close();},[]);
 useEffect(()=>{const close=()=>{if(!document.fullscreenElement)setImmersive(false);};document.addEventListener('fullscreenchange',close);return()=>document.removeEventListener('fullscreenchange',close);},[]);
 if(!current)return null;
 if(['WORLD','MEMORY'].includes(regime))return <XRGeographicAtlas scene={scene} decisions={decisions} activated={activated} onChange={onChange} onRegime={changeRegime} onInspect={onInspect}/>;
 return <div ref={root} className={`${css.experience} ${immersive?css.immersive:''} ${archiveView.phase!=='corridor'?css.archiveOpen:''}`}>
  <div className={`${css.top} ${archiveView.phase!=='corridor'?css.archiveTop:''}`}><div><span className={css.eyebrow}>SPATIAL REHEARSAL / {String(index+1).padStart(2,'0')} OF {spaces.length}</span><h2>{archiveView.phase==='chamber'?<>An archive<br/><em>within TIME.</em></>:archiveView.phase==='surface'?<>A window<br/><em>drawn closer.</em></>:<>A passage made<br/><em>of intervals.</em></>}</h2></div>
   <div className={css.regimes} role="group" aria-label="Spatial regime">{(['WORLD','TIME','MEMORY'] as const).map(mode=><button key={mode} aria-pressed={mode===regime} onClick={()=>changeRegime(mode)}>{mode}</button>)}</div>
  </div>
  <canvas ref={canvas} className={css.canvas} tabIndex={0} aria-label="Walkable episode spaces. W A S D to walk, arrows to turn, drag to look, scroll to approach. Click a portal to focus."
   onKeyDown={e=>{const key=e.key.toLowerCase();if(['w','a','s','d','arrowleft','arrowright','arrowup','arrowdown'].includes(key)){e.preventDefault();keys.current.add(key);}if(key==='escape'){if(archive.current.phase!=='corridor'){e.preventDefault();closeArchive();return;}gesture.current=null;setMoving(false);setInspecting(false);setImmersive(false);if(document.fullscreenElement)void document.exitFullscreen();}if(key==='enter'&&!e.repeat){e.preventDefault();if(regime==='TIME'){if(archive.current.phase==='surface')enterChamber();else if(archive.current.phase==='chamber')closeArchive();else if(near)selectWindow(windows[current.members[Math.min(windowPage*4,current.members.length-1)]].windowId);}else setInspecting(v=>!v);}}}
   onKeyUp={e=>keys.current.delete(e.key.toLowerCase())} onBlur={()=>keys.current.clear()}
   onPointerDown={e=>{if(e.button!==0)return;e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);gesture.current=beginLook(e.clientX,e.clientY);}}
   onPointerMove={e=>{const g=gesture.current;if(!g)return;const next=advanceLook(g,e.clientX,e.clientY);gesture.current=next.gesture;camera.current.yaw+=next.yawDelta;redraw.current();}}
   onPointerCancel={()=>{gesture.current=null;}}
   onPointerUp={e=>{const g=gesture.current;gesture.current=null;if(!g)return;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(advanceLook(g,e.clientX,e.clientY).gesture.dragged)return;const rect=e.currentTarget.getBoundingClientRect(),hit=pickArchiveHit(hits.current,e.clientX-rect.left,e.clientY-rect.top,archive.current.phase);if(hit?.windowId){setSelected(hit.index);selectWindow(hit.windowId);}else if(hit){setSelected(hit.index);setWindowPage(0);setInspecting(false);}}} />
  <div className={css.compass} aria-hidden="true">{regime==='WORLD'?'GEOGRAPHIC CALIBRATION':regime==='TIME'?(archiveView.phase==='chamber'?'ARCHIVAL COMPOSITION / NOT A PLACE RECONSTRUCTION':archiveView.phase==='surface'?'SOURCE-SUPPORTED EVIDENCE SURFACE':'CHRONOLOGICAL PASSAGE'):`AUTHOR COMPOSITION / FROM ${memoryBase}`}<span>+ </span></div>
  <div className={`${css.bottom} ${archiveView.phase!=='corridor'?css.archiveBottom:''}`}>
   <div className={css.focus}><span className={css.eyebrow}>{current.author?'AUTHOR EPISODE':'PROPOSED EPISODE CONTAINER'} / {current.transit?'TRANSIT':'STAY WINDOWS'}</span><h3>{current.label}</h3><p>{new Date(current.start).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:scene.journeyLayout!.timeZone})} — {new Date(current.end).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:scene.journeyLayout!.timeZone})} · {near?'Within reach':'Approach to discover'}</p></div>
   <div className={css.navigation}><button onClick={()=>focus(index-1)} disabled={index===0}>← Previous</button><button onClick={()=>focus(index)}>Approach</button><button onClick={()=>focus(index+1)} disabled={index===spaces.length-1}>Next →</button>{regime!=='TIME'&&<button onClick={()=>setInspecting(!inspecting)}>{inspecting?'Close evidence':'Discover'}</button>}</div>
  </div>
  <div className={css.tools}>
   <span>WASD walk · drag to look · scroll to approach · ← → turn</span>
   <button onClick={()=>{camera.current.yaw-=.25;redraw.current();}}>Turn left</button><button onClick={()=>{const c={...camera.current};c.x+=Math.sin(c.yaw);c.z-=Math.cos(c.yaw);moveCamera(c);redraw.current();}}>Step forward</button><button onClick={()=>{camera.current.yaw+=.25;redraw.current();}}>Turn right</button>
   <button disabled={!activated||archiveView.phase!=='corridor'} onClick={()=>void sound()}>{sounding&&activated?'Silence':'Enable synthetic sound'}</button>
   <button onClick={()=>{if(immersive){setImmersive(false);if(document.fullscreenElement)void document.exitFullscreen();}else{setImmersive(true);void root.current?.requestFullscreen?.().catch(()=>{});}}}>{immersive?'Leave immersive':'Enter immersive'}</button>
   {regime==='WORLD'&&<button onClick={onCalibrate}>Show calibration map</button>}
  </div>
  {regime==='TIME'&&<div className={css.archiveControls}>
   {archiveView.phase==='corridor'? <><span>{near?`${current.members.length} source windows · approach a plane to open its evidence`:'Approach an episode to reveal its source windows'}</span><button disabled={!near||windowPage===0} onClick={()=>setWindowPage(p=>p-1)}>Earlier windows</button><button disabled={!near||(windowPage+1)*4>=current.members.length} onClick={()=>setWindowPage(p=>p+1)}>Later windows</button><button disabled={!near} onClick={()=>selectWindow(windows[current.members[Math.min(windowPage*4,current.members.length-1)]].windowId)}>Open first visible window</button></>:
    <><span>{archiveView.phase==='surface'?'Walk across the selected plane to enter':'Turn around and cross the doorway to leave'} · {activeWindow?.artifacts.length??0} attached artefacts · {activeWindow?.candidates??0} candidates withheld</span><button disabled={archiveView.artifactPage===0} onClick={()=>updateArchive({...archive.current,artifactPage:archive.current.artifactPage-1})}>Earlier artefacts</button><button disabled={(archiveView.artifactPage+1)*(archiveView.phase==='surface'?3:6)>=(activeWindow?.artifacts.length??0)} onClick={()=>updateArchive({...archive.current,artifactPage:archive.current.artifactPage+1})}>Later artefacts</button>{archiveView.phase==='surface'&&<button onClick={enterChamber}>Cross into chamber</button>}<button onClick={closeArchive}>Return to TIME corridor</button></>}
  </div>}
  <p className={css.srOnly} aria-live="polite">{archiveView.phase==='corridor'?`${regime} corridor`:archiveView.phase==='surface'?'Evidence surface':'Bounded evidence chamber'}. {activeWindow?`${activeWindow.windowId}. ${activeWindow.artifacts.map(a=>`${a.kind}: ${a.title}. ${a.preview.join(' ')} Source: ${a.sourceId}`).join(' ')}`:''}</p>
  {regime==='MEMORY'&&<div className={css.memoryTools}><label>Begin from <select aria-label="Memory starting representation" value={memoryBase} onChange={e=>onChange({...scene,experience:{...experience,memoryBase:e.target.value as 'WORLD'|'TIME'}})}><option>WORLD</option><option>TIME</option></select></label><button aria-pressed={moving} onClick={()=>setMoving(!moving)}>{moving?'Finish moving':'Move focused space'}</button><button onClick={()=>move(-1,0)}>Move west</button><button onClick={()=>move(1,0)}>Move east</button><button onClick={()=>move(0,-1)}>Move north</button><button onClick={()=>move(0,1)}>Move south</button><span>WORLD ghost · solid amber: Author displacement · faint dotted: TIME layout offset</span></div>}
  {inspecting&&regime!=='TIME'&&<div className={css.discover}>
   <button onClick={()=>setInspecting(false)} aria-label="Close discovered evidence">×</button><p className={css.eyebrow}>WITHIN THIS SPACE</p><h3>{current.label}</h3><p>{current.members.length} source windows · {current.count} uniquely assigned plays. {current.author?'Author date envelopes, not measured stay duration.':`${current.durationHours.toFixed(1)} hours of recorded intervals; gaps excluded.`}</p>
   <p>{(fragments.get(current.id)??[]).join(' · ')||'No accepted fragments placed here.'}</p>
   <p>Amber filaments: one per 25 accepted selection matches, capped at 48. Artist/track/album matches can overlap. Frame size and colour are aesthetic constants; neither means emotion or importance.</p>
   <p>Grouping proposal: consecutive Timeline stops within 25 km of the first stop, gaps ≤36 hours. Author episodes remain separate. This container does not establish continuous presence.</p>
   <button onClick={()=>{onInspect(current.members[0]);setInspecting(false);setImmersive(false);if(document.fullscreenElement)void document.exitFullscreen();}}>Inspect contained source evidence</button>
   <h4>Compose a cultural / authored fragment</h4><p>Placement records your composition, separately from the original work and viewing context.</p>
   {scene.cues.filter(c=>c.source==='author'&&decisions[c.id]==='accepted').map(c=><div key={c.id}><span>{c.title}</span> <button onClick={()=>place(c.id,current.id)}>Place in this space</button> <button onClick={()=>place(c.id,null)}>Leave unplaced</button></div>)}
   {regime==='MEMORY'&&<p>WORLD {current.world.x.toFixed(2)}, {current.world.z.toFixed(2)} → MEMORY {current.memory.x.toFixed(2)}, {current.memory.z.toFixed(2)}. Display position {position.x.toFixed(2)}, {position.z.toFixed(2)} ({memoryBase} baseline + saved displacement).</p>}
  </div>}
  <p className={css.status} role="status">{message||(!activated?'Silent draft · activate the accepted mapping above before enabling sound.':'Synthetic sound is optional; no recordings or music playback.')}</p>
 </div>;
}
