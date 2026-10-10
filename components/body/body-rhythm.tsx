'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {BodyRhythm,musicalBrief,rhythmPalettes,rhythmTempo,type RhythmPalette} from '@/lib/body/body-rhythm';
import css from './body-composition.module.css';

export function BodyRhythmControls({selectedBpm,onEngine}:{selectedBpm:number|null;onEngine:(engine:BodyRhythm|null)=>void}){
 const engine=useRef<BodyRhythm|null>(null),generation=useRef(0);
 const [active,setActive]=useState(false),[starting,setStarting]=useState(false),[tempo,setTempo]=useState(96),[volume,setVolume]=useState(12);
 const [palette,setPalette]=useState<RhythmPalette>('warm'),[groove,setGroove]=useState<'steady'|'broken'>('steady'),[atmosphere,setAtmosphere]=useState<'spacious'|'intimate'|'restless'>('spacious');
 const [message,setMessage]=useState('Original synth loop · sound off. Choose Play original rhythm to listen.');
 const stop=useCallback(()=>{generation.current++;engine.current?.stop();engine.current=null;setActive(false);setStarting(false);onEngine(null);},[onEngine]);
 useEffect(()=>{const hide=()=>{if(document.hidden){stop();setMessage('Sound stopped when the page was hidden.');}};document.addEventListener('visibilitychange',hide);return()=>{document.removeEventListener('visibilitychange',hide);generation.current++;engine.current?.stop();onEngine(null);};},[stop,onEngine]);
 useEffect(()=>{engine.current?.configure(tempo,volume/100,palette,groove);},[tempo,volume,palette,groove]);
 async function play(){
  if(engine.current)return;const ticket=++generation.current;setStarting(true);
  try{
   const next=new BodyRhythm();engine.current=next;next.configure(tempo,volume/100,palette,groove);await next.start();
   if(ticket!==generation.current){next.stop();return;}setActive(true);onEngine(next);setMessage('Playing original local rhythm. The eight gold points respond to its audio bands.');
  }catch{stop();setMessage('Audio could not start. Try Play again in an active browser tab.');}finally{if(ticket===generation.current)setStarting(false);}
 }
 const brief=musicalBrief(palette,groove,atmosphere);
 const canUse=selectedBpm!==null&&Number.isFinite(selectedBpm)&&selectedBpm>=30&&selectedBpm<=240;
 return <fieldset className={css.persona}><legend>Original rhythm · eight-point audio field</legend>
  <p>A locally synthesized bass, kick and pluck loop. No Spotify audio, microphone or external service. Music uses real time; BODY’s playback speed only changes the evidence timeline.</p>
  <div className={css.controls}><button disabled={starting} onClick={()=>{if(active){stop();setMessage('Original rhythm stopped.');}else void play();}}>{starting?'Starting sound…':active?'Stop original rhythm':'Play original rhythm'}</button>
   <label>Sound palette<select value={palette} onChange={e=>setPalette(e.target.value as RhythmPalette)}>{Object.entries(rhythmPalettes).map(([id,p])=><option value={id} key={id}>{p.label}</option>)}</select></label>
   <label>Groove<select value={groove} onChange={e=>setGroove(e.target.value as typeof groove)}><option value="steady">Steady</option><option value="broken">Broken</option></select></label>
  </div>
  <label>Original rhythm tempo · {tempo} BPM<input type="range" min="30" max="240" value={tempo} onChange={e=>setTempo(Number(e.target.value))}/></label>
  <button disabled={!canUse} onClick={()=>{if(canUse){setTempo(rhythmTempo(selectedBpm!));setMessage('Tempo copied once from the selected reading. It stays fixed until you change it; this is an artistic mapping.');}}}>Use selected reading as musical tempo</button>
  <label>Sound level · {volume}%<input type="range" min="0" max="30" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></label>
  <p role="status">{message}</p>
  <p>The gold points show low-to-high audio bands, with gentle displacement and no flashing. Pale points retain your recent heart-rate samples. Reduced-motion settings keep the gold points still. Sound has its own Stop control.</p>
  <details><summary>Make a musical brief for other software</summary>
   <p>Choose your own direction. This brief contains no listening history, track names, HealthKit values or tempo copied from a reading. These starting choices are a design preset, not an inferred persona.</p>
   <label>Atmosphere<select value={atmosphere} onChange={e=>setAtmosphere(e.target.value as typeof atmosphere)}><option value="spacious">Spacious</option><option value="intimate">Intimate</option><option value="restless">Restless</option></select></label>
   <label>Portable musical brief<textarea readOnly rows={6} value={brief}/></label>
   <button onClick={()=>{const url=URL.createObjectURL(new Blob([brief+'\n'],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download='storywalker-musical-brief.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Download musical brief</button>
  </details>
  <details><summary>Free audio and visual resources</summary>
   <p><a href="https://tonejs.github.io/" target="_blank" rel="noreferrer">Tone.js</a> · MIT-licensed synthesis and sequencing; <a href="https://threejs.org/" target="_blank" rel="noreferrer">Three.js</a> · MIT-licensed 3D rendering.</p>
   <p><a href="https://freesound.org/help/faq/#licenses" target="_blank" rel="noreferrer">Freesound</a> · filter samples by CC0, or retain attribution for CC BY. Licences vary per file. <a href="https://polyhaven.com/license" target="_blank" rel="noreferrer">Poly Haven</a> · CC0 materials, lighting and models.</p>
   <p>No third-party assets are downloaded by this page. The loop above is generated locally from oscillators.</p>
  </details>
 </fieldset>;
}
