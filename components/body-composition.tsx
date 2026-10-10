'use client';
import {useCallback, useEffect, useId, useMemo, useRef, useState} from 'react';
import {bodyFace,bodyPetAt,type BodyPet,defaultBodyView,orbitBody,zoomBody,type BodyFace} from '@/lib/body-view';
import type {PointerEvent as ReactPointerEvent} from 'react';
import type {ContextState} from '@/lib/context-contract';
import {type BodyWindow, type BodyPlaybackMode, bodyWindows, groupBodyWindows, tempoAt, bodyPlaybackDelay, bodyFieldScale} from '@/lib/body-composition';
import {drawBodyCompanion} from '@/lib/episode-renderer';
import {BodyRhythmControls} from './body-rhythm';
import type {BodyRhythm} from '@/lib/body-rhythm';
import css from './body-composition.module.css';
import fictionalPreview from '@/lib/body-preview.fictional.json';

export function BodyComposition({state,onInspect,designOnly=false,privateWindows,incoming=false,onGoLive,liveConnecting=false}:{state:ContextState;onInspect?:(id:string)=>void;designOnly?:boolean;privateWindows?:BodyWindow[];incoming?:boolean;onGoLive?:()=>void;liveConnecting?:boolean}) {
 const rhythm=useRef<BodyRhythm|null>(null);
 const [rhythmActive,setRhythmActive]=useState(false);
 const onRhythm=useCallback((engine:BodyRhythm|null)=>{rhythm.current=engine;setRhythmActive(engine!==null);},[]);
 const [designSample,setDesignSample]=useState(designOnly);
 const [playing,setPlaying]=useState(false),[speed,setSpeed]=useState(5),[reducedMotion,setReducedMotion]=useState(true);
 const [playbackMode,setPlaybackMode]=useState<BodyPlaybackMode>('preview'),[remainingMs,setRemainingMs]=useState(0);
 const [palette,setPalette]=useState<'lilac'|'lagoon'|'ember'>('ember'),[wireframe,setWireframe]=useState(true);
 const [shape,setShape]=useState<'orb'|'companion'>('companion'),[fieldMotion,setFieldMotion]=useState(false),[fieldTempo,setFieldTempo]=useState(96),[fieldDepth,setFieldDepth]=useState(.02);
 useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>{setReducedMotion(media.matches);if(media.matches)setPlaying(false);};update();media.addEventListener('change',update);const hide=()=>{if(document.hidden)setPlaying(false);};document.addEventListener('visibilitychange',hide);return()=>{media.removeEventListener('change',update);document.removeEventListener('visibilitychange',hide);};},[]);
 const [selected,setSelected]=useState(''),[sample,setSample]=useState(0),[level,setLevel]=useState<'city'|'country'>('city'),[gap,setGap]=useState(300),[view,setView]=useState(defaultBodyView);
 const petTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(petTimer.current)clearTimeout(petTimer.current);},[]);
 const [inspect,setInspect]=useState(false);
 const [pet,setPet]=useState<BodyPet|null>(null);
 const [faceMode,setFaceMode]=useState<'reading'|BodyFace>('reading');
 const pointers=useRef(new Map<number,{x:number;y:number}>());
 const windows=useMemo(()=>privateWindows??bodyWindows(designSample?fictionalPreview as ContextState:state),[state,designSample,privateWindows]),current=windows.find(w=>w.id===selected)??windows[0];
 useEffect(()=>{setPlaying(false);setSample(0);},[incoming,current?.id]);
 const clusters=groupBodyWindows(windows,level,gap),reading=current?.readings[Math.min(sample,current.readings.length-1)];
 const bpm=reading?.payload.kind==='heart_rate'?reading.payload.value:null;
 const face=faceMode==='reading'?bodyFace(bpm):faceMode;
 const displayBpm=bpm===null?'unavailable':Math.round(bpm);
 const cues=current?tempoAt(current,reading):[],tempo= cues.length===1 && cues[0].payload.kind==='listening' ? cues[0].payload.tempo_bpm??null : null;
 const canvas=useRef<HTMLCanvasElement>(null),description=useId();
 const history=useMemo(()=>current?.readings.slice(0,sample+1).flatMap(o=>o.payload.kind==='heart_rate'?[o.payload.value]:[])??[],[current,sample]);
 useEffect(()=>{
  if(!playing||reducedMotion)return;
  const delay=current?bodyPlaybackDelay(current.readings,sample,speed,playbackMode):null;
  if(delay===null){setPlaying(false);return;}
  const deadline=performance.now()+delay;setRemainingMs(delay);
  const countdown=setInterval(()=>setRemainingMs(Math.max(0,deadline-performance.now())),100);
  const timer=setTimeout(()=>setSample(i=>i+1),delay);return()=>{clearTimeout(timer);clearInterval(countdown);};
 },[playing,reducedMotion,current,sample,speed,playbackMode]);
 function greet(){if(petTimer.current)clearTimeout(petTimer.current);setPet({x:0,y:0,strength:1});petTimer.current=setTimeout(()=>setPet(null),4000);}
 function releasePointer(event:ReactPointerEvent<HTMLCanvasElement>){pointers.current.delete(event.pointerId);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);if(event.type==='pointerup'&&pointers.current.size===0){const rect=event.currentTarget.getBoundingClientRect();setPet(bodyPetAt(event.clientX-rect.left,event.clientY-rect.top,rect.width,rect.height,view.zoom));}}
 function dragPointer(event:ReactPointerEvent<HTMLCanvasElement>){
  const before=pointers.current.get(event.pointerId);if(!before){if(event.pointerType==='mouse'){const rect=event.currentTarget.getBoundingClientRect();setPet(bodyPetAt(event.clientX-rect.left,event.clientY-rect.top,rect.width,rect.height,view.zoom));}return;}
  const other=[...pointers.current.entries()].find(([id])=>id!==event.pointerId)?.[1];
  if(other){const from=Math.hypot(before.x-other.x,before.y-other.y),to=Math.hypot(event.clientX-other.x,event.clientY-other.y);if(from>0)setView(v=>zoomBody(v,to/from));}
  else setView(v=>orbitBody(v,event.clientX-before.x,event.clientY-before.y));
  pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
 }
 useEffect(()=>{
  const element=canvas.current;if(!element)return;
  const wheel=(event:WheelEvent)=>{event.preventDefault();const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?element.clientHeight:1);setView(v=>zoomBody(v,Math.exp(-Math.max(-200,Math.min(200,delta))*.002)));};
  element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel);
 },[]);
 function moveSample(next:number){setPlaying(false);setSample(Math.max(0,Math.min((current?.readings.length??1)-1,next)));}

 useEffect(()=>{
  const element=canvas.current;if(!element)return;
  let frame=0;
  const draw=(now:number)=>{const rect=element.getBoundingClientRect(),ratio=Math.min(2,window.devicePixelRatio||1),ctx=element.getContext('2d');if(!ctx)return;
   const width=Math.round(rect.width*ratio),height=Math.round(rect.height*ratio);if(element.width!==width||element.height!==height){element.width=width;element.height=height;}
   ctx.setTransform(ratio,0,0,ratio,0,0);drawBodyCompanion(ctx,rect.width,rect.height,bpm,tempo,view.yaw+(reducedMotion?0:(pet?.x??0)*.08),{pitch:view.pitch+(reducedMotion?0:(pet?.y??0)*.06),zoom:view.zoom,inspectEvidence:inspect,pet,face,shape,palette,wireframe,history,fieldScale:bodyFieldScale(now/1000,fieldTempo,fieldDepth,playing&&fieldMotion,reducedMotion),audioBands:rhythmActive?(reducedMotion?Array(8).fill(0):rhythm.current?.levels()):undefined});
  };
  const tick=(now:number)=>{draw(now);frame=requestAnimationFrame(tick);};
  draw(performance.now());if(((playing&&fieldMotion)||rhythmActive)&&!reducedMotion)frame=requestAnimationFrame(tick);
  const resize=new ResizeObserver(()=>draw(performance.now()));resize.observe(element);return()=>{resize.disconnect();cancelAnimationFrame(frame);};
 },[bpm,tempo,view,inspect,pet,face,shape,history,playing,fieldMotion,fieldTempo,fieldDepth,reducedMotion,rhythmActive,palette,wireframe]);
 return <section className={css.panel} aria-label="BODY spherical companion">
  <p className={css.kicker}>BODY / SPHERICAL STUDY / {incoming?'TEMPORARY INCOMING WATCH PREVIEW':privateWindows?'PRIVATE HEALTH EVIDENCE':'FICTIONAL EVIDENCE'}</p>
  <h3>{incoming?'Here with you.':privateWindows?'Your measurements, in their own time.':'A companion for two distinct rhythms.'}</h3>
  <p>{incoming?'The latest available Watch reading shapes this pose. Its age and delivery status appear above. Older poses are last-known, not current; no beats are invented.':privateWindows?'Private playback of accepted HealthKit evidence. No values are interpolated between measurements. This view does not create a capture, interpretation or canonical memory.':'Play timestamped heart-rate samples beside a fictional rhythm field. The companion changes at each measurement; it does not invent heartbeats between samples.'} Spotify is disconnected.</p>
  {!privateWindows&&!designOnly&&<button aria-pressed={designSample} onClick={()=>{setPlaying(false);setDesignSample(v=>!v);setSelected('');setSample(0);}}>{designSample?'Return to saved rehearsal evidence':'Show fictional design sample'}</button>}
  <p>{incoming?'Temporary private display · not saved or accepted by this feed.':privateWindows?'Selected encrypted Vault batch · visible only in this private review.':designSample?'Design sample · generated by the same Pydantic workflow. No saved state, Author decision or source deletion is changed.':'Saved fictional rehearsal · deleted evidence stays removed.'}</p>
  <div className={css.playback}>
   {!privateWindows&&<label className={css.motionToggle}><input type="checkbox" checked={fieldMotion} disabled={reducedMotion} onChange={e=>setFieldMotion(e.target.checked)}/> Animate field while BODY plays</label>}
   {!incoming&&onGoLive&&<button className={css.liveButton} disabled={liveConnecting} onClick={onGoLive}>{liveConnecting?'Connecting live…':'DANGER ZONE · Go live'}</button>}
   {!incoming&&<><button disabled={!current?.readings.length||reducedMotion} onClick={()=>{if(!playing&&sample>=current!.readings.length-1)setSample(0);setPlaying(v=>!v);}}>{playing?'Pause BODY evolution':'Play BODY evolution'}</button>
   <button disabled={!current?.readings.length} onClick={()=>moveSample(0)}>Rewind</button>
   <button disabled={!current||sample>=current.readings.length-1} onClick={()=>moveSample(sample+1)}>Next measurement</button>
   <label>Playback timing <select value={playbackMode} onChange={e=>setPlaybackMode(e.target.value as BodyPlaybackMode)}><option value="preview">Quick preview · 2 seconds per measurement</option><option value="measured">Original measurement gaps</option></select></label>
   <label>Event-time speed <select disabled={playbackMode==='preview'} value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[1,5,20].map(v=><option key={v} value={v}>{v}×</option>)}</select></label>
   </>}<label>Companion form <select value={shape} onChange={e=>setShape(e.target.value as 'orb'|'companion')}><option value="companion">Fin companion</option><option value="orb">Orb</option></select></label>
   <label>Colour study <select value={palette} onChange={e=>setPalette(e.target.value as typeof palette)}><option value="lilac">Lilac dusk</option><option value="lagoon">Tidal glass</option><option value="ember">Warm mineral</option></select></label>
   <label>Face expression <select value={faceMode} onChange={e=>setFaceMode(e.target.value as typeof faceMode)}><option value="reading">Follow selected BPM · artistic</option><option value="neutral">Neutral</option><option value="crescent">Crescent</option><option value="arc">Soft arc</option><option value="round">Round</option><option value="wide">Wide</option></select></label>
   <label>Surface <select value={wireframe?'wire':'soft'} onChange={e=>setWireframe(e.target.value==='wire')}><option value="soft">Soft shell</option><option value="wire">Wire study</option></select></label>
  </div>
  {!incoming&&<><p>{playbackMode==='preview'?'Quick preview compresses the gaps: each recorded measurement appears for two seconds, in measured-time order. Original timestamps and values stay unchanged; no measurements are invented.':'Original measurement gaps preserve the elapsed time between readings at the selected speed. Long gaps can take minutes to play.'} BODY playback is silent; choose Play original rhythm below to add sound and animate the gold points.</p>
  <p role="status">{reducedMotion?'Reduced motion: automatic playback and field motion are off. Use Next measurement or the slider.':playing?'Playing selected window in measured-time order.':current?.readings.length&&sample>=current.readings.length-1?'End of window · Play to replay.':'Paused · choose a window and Play, or step manually.'} {current?.readings.length?`Sample ${Math.min(sample+1,current.readings.length)} of ${current.readings.length}.`:''}</p>
  {playing&&<p aria-live="off">Next measurement in {Math.ceil(remainingMs/1000)} seconds.</p>}</>}
  <button aria-pressed={inspect} onClick={()=>setInspect(v=>!v)}>{inspect?'Return to artistic view':'Inspect evidence'}</button>
  <div className={`${css.layout} ${inspect?'':css.artistic}`}><div>
   <p>Move near its face to pet it · drag to rotate · scroll or pinch to zoom · arrow keys to turn · + / − to zoom · Home to reset.</p>
   <canvas tabIndex={0} onPointerDown={e=>{if(e.pointerType==='mouse'&&e.button!==0)return;setPet(null);e.currentTarget.focus({preventScroll:true});pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});e.currentTarget.setPointerCapture(e.pointerId);}} onPointerEnter={dragPointer} onPointerMove={dragPointer} onPointerLeave={()=>setPet(null)} onBlur={()=>{pointers.current.clear();setPet(null);}} onPointerUp={releasePointer} onPointerCancel={releasePointer} onLostPointerCapture={e=>pointers.current.delete(e.pointerId)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')setView(v=>orbitBody(v,-25,0));if(e.key==='ArrowRight')setView(v=>orbitBody(v,25,0));if(e.key==='ArrowUp')setView(v=>orbitBody(v,0,-25));if(e.key==='ArrowDown')setView(v=>orbitBody(v,0,25));if(e.key==='+'||e.key==='=')setView(v=>zoomBody(v,1.1));if(e.key==='-')setView(v=>zoomBody(v,1/1.1));if(e.key==='Home')setView(defaultBodyView);}} ref={canvas} className={css.canvas} role="img" aria-label={inspect?`Spherical companion. Heart rate ${displayBpm} bpm; musical tempo ${tempo??'unknown or ambiguous'} BPM. Artistic face: ${face}.`:`Interactive companion. Artistic face: ${face}. Drag to rotate, scroll to zoom, or use the controls below.`} aria-describedby={inspect?description:undefined}/>
   {privateWindows&&reading&&<p className={css.lastRegistered} aria-live="off"><span>{incoming?'Last registered':'Selected reading'}</span> <strong>{displayBpm} bpm</strong><span>·</span><time dateTime={reading.event_start}>{new Date(reading.event_start).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time>{current?.stale&&<span>· last-known</span>}</p>}
   <div className={css.controls}><button onClick={()=>setView(v=>orbitBody(v,-25,0))}>Turn left</button><button onClick={()=>setView(v=>orbitBody(v,25,0))}>Turn right</button><button onClick={()=>setView(v=>orbitBody(v,0,-25))}>Tilt up</button><button onClick={()=>setView(v=>orbitBody(v,0,25))}>Tilt down</button><button disabled={view.zoom<=.65} onClick={()=>setView(v=>zoomBody(v,1/1.1))}>Zoom out</button><button disabled={view.zoom>=1.6} onClick={()=>setView(v=>zoomBody(v,1.1))}>Zoom in</button><button onClick={()=>{setView(defaultBodyView);setPet(null);}}>Reset view</button><button onClick={greet}>Pet companion</button></div>
   <p aria-live="off">View: {Math.round(view.yaw*180/Math.PI)}° turn · {Math.round(view.pitch*180/Math.PI)}° tilt · {Math.round(view.zoom*100)}% zoom. Artistic face: {face}. {pet?pet.strength>.65?'Pet response · soft eyes':'Following your pointer':'Move the pointer close to greet it.'}</p>
   <details><summary>Facial expression mapping</summary><p>Authored visual ranges: below 80 bpm → crescent eyes; 80–119 → soft arc; 120–159 → round mouth; 160 and above → wide eyes. Missing readings use a neutral face. These are character poses, not relaxation, anxiety, workout or danger classifications. Select a fixed expression to override the mapping. It changes no source evidence. Petting temporarily softens the pose and adds a warm cheek glow; moving away restores the selected expression.</p></details>
   <p id={description} hidden={!inspect}>Solid inner ring: heart rate, 0–200 bpm. Dashed outer ring: musical tempo, 0–400 BPM. Ring angles are scaled values, not a synchronisation score. Sphere size stays constant; colour is your design choice. Fin reach scales with the selected rate (0–200 bpm); eight small dots retain recent samples. These are visual encodings, not a health or personality score. Heart-rate labels are rounded to whole BPM; the source table retains original precision. The eight outer antennae rest when sound is off. In gold, their extension represents generated audio rather than body readings.</p>
   <BodyRhythmControls selectedBpm={bpm} onEngine={onRhythm}/>
   {!privateWindows&&<fieldset className={css.persona}><legend>Fictional rhythm palette · manual design</legend>
    <p>This is not your Spotify persona or extracted bass. Shape a slow, silent field with your own settings.</p>
    <label>Rhythm seed · {fieldTempo} BPM <input type="range" min="40" max="160" value={fieldTempo} onChange={e=>setFieldTempo(Number(e.target.value))}/></label>
    <label>Field bounce · {Math.round(fieldDepth*100)}% <input type="range" min="0" max="4" value={Math.round(fieldDepth*100)} onChange={e=>setFieldDepth(Number(e.target.value)/100)}/></label>
    <p>The field breathes once per four fictional beats, at real-time speed even during fast-forward. No flashing, audio or pulse-per-heartbeat motion. Pause freezes playback and settles the field.</p>
   </fieldset>}
  </div>{inspect&&<div>
   {!privateWindows&&<><div className={css.controls}><label>Place grouping <select value={level} onChange={e=>setLevel(e.target.value as 'city'|'country')}><option value="city">City</option><option value="country">Country</option></select></label><label>Maximum gap <select value={gap} onChange={e=>setGap(Number(e.target.value))}><option value={300}>5 minutes</option><option value={3600}>1 hour</option><option value={86400}>24 hours</option></select></label></div>
   <p>Same explicit place label + consecutive windows within the selected gap. No distance clustering without coordinates. Stale or ambiguous places remain separate.</p>
   {clusters.map((cluster,i)=><div key={i} className={css.cluster}><h4>{cluster.label}</h4><p>{cluster.coveredSeconds}s of captured context, overlapping intervals counted once. This is not measured dwell time.</p>{cluster.windows.map(w=><button key={w.id} aria-pressed={current?.id===w.id} onClick={()=>{setPlaying(false);setSelected(w.id);setSample(0);}}>Window {windows.indexOf(w)+1} · {w.relationship} · {w.support}</button>)}</div>)}
   </>}
   {!current&&<p>No captured windows. Use Play or Step in the fictional scenario to create one.</p>}
   {privateWindows&&<p>Activity, location and listening context are unknown. No place or music connection is inferred.</p>}
   {current&&<><h4>{incoming?'Incoming preview · not accepted evidence':`Selected evidence · revision ${current.revision}`}</h4><p>{current.start} → {current.end}</p>
    {current.readings.length>0?<><label>Measured sample <input type="range" min="0" max={current.readings.length-1} value={Math.min(sample,current.readings.length-1)} onChange={e=>moveSample(Number(e.target.value))}/></label><p role="status"><strong>{displayBpm} bpm</strong> · measured {reading.event_start}<br/>Received {reading.received_at}</p></>:<p>BODY source unavailable or deleted. No value is retained by this composition.</p>}
    <p>{!reading?'No BODY measurement available for a temporal comparison.':cues.length===0?'No listening marker overlaps this measurement.':cues.map(o=>o.payload.kind==='listening'?`${o.payload.label}: ${o.payload.tempo_bpm??'unknown'} BPM (fictional tempo)`:null).join(' · ')}{cues.length>1?' Multiple markers: no single tempo selected.':''}</p>
    <p>{current.locations.map(o=>o.payload.kind==='location'?`${o.payload.label} · ±${o.payload.accuracy_m}m`:null).join(' · ')||'Location unknown'}{current.stale?' · stale / uncertain':''}</p>
    {!designSample&&onInspect&&<button onClick={()=>onInspect(current.id)}>Open evidence chamber and Author decisions</button>}
    <details><summary>2D reading table and source references</summary><div className={css.table}><table><thead><tr><th>Measured</th><th>Received</th><th>bpm</th><th>Source reference</th></tr></thead><tbody>{current.readings.map(o=><tr key={o.id}><td>{o.event_start}</td><td>{o.received_at}</td><td>{o.payload.kind==='heart_rate'?o.payload.value:''}</td><td>{o.source_id} / {o.id}</td></tr>)}</tbody></table></div></details>
   </>}
  </div>}</div>
  {!privateWindows&&<p>At most three capture windows, within the existing twelve-cue budget. A connection means temporal context only. MEMORY relationships follow retained Author decisions; this view grants no approval.</p>}
 </section>;
}
