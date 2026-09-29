'use client';
import {useEffect,useRef,useState} from 'react';
import {rankSounds,SOUND_TAGS} from '@/lib/xr-sound-catalog';
import {composeEpisodeSound,soundForEpisode} from '@/lib/xr-sound';
import type {XRScene} from '@/lib/xr-scene';
import css from './xr-geographic-atlas.module.css';

type Props={scene:XRScene;episodeId:string;label:string;pan:number;activated:boolean;onChange:(scene:XRScene)=>void};
export function XRMemorySound({scene,episodeId,label,pan,activated,onChange}:Props){
 const previous=[...(scene.experience?.soundDecisions??[])].reverse().find(d=>d.episodeId===episodeId);
 const [open,setOpen]=useState(false),[tags,setTags]=useState<string[]>(previous?.tags??[]),[note,setNote]=useState(previous?.note??''),[message,setMessage]=useState(''),[playing,setPlaying]=useState(false),[volume,setVolume]=useState(.12);
 const engine=useRef<{context:AudioContext;gain:GainNode;panner:StereoPannerNode}|null>(null),generation=useRef(0);
 const selected=soundForEpisode(scene,episodeId),candidates=rankSounds(tags);
 function stop(){generation.current++;const old=engine.current;engine.current=null;if(old)void old.context.close();setPlaying(false);}
 async function play(url?:string,loop=false){
  stop();const ticket=generation.current;setMessage('Preparing sound…');
  try{
   const context=new AudioContext(),gain=context.createGain(),panner=context.createStereoPanner();gain.gain.value=volume;panner.pan.value=Math.max(-1,Math.min(1,pan));gain.connect(panner).connect(context.destination);engine.current={context,gain,panner};await context.resume();
   if(ticket!==generation.current)return;
   if(url){const response=await fetch(url);if(!response.ok)throw Error('Sample unavailable');const bytes=await response.arrayBuffer();if(ticket!==generation.current)return;const buffer=await context.decodeAudioData(bytes);if(ticket!==generation.current)return;const source=context.createBufferSource();source.buffer=buffer;source.loop=loop;source.connect(gain);source.onended=()=>{if(ticket===generation.current)stop();};source.start();}
   else{const oscillator=context.createOscillator();oscillator.frequency.value=174;oscillator.connect(gain);gain.gain.setValueAtTime(0,context.currentTime);gain.gain.linearRampToValueAtTime(volume*.3,context.currentTime+.1);gain.gain.linearRampToValueAtTime(0,context.currentTime+1.5);oscillator.start();oscillator.stop(context.currentTime+1.6);oscillator.onended=()=>{if(ticket===generation.current)stop();};}
   setPlaying(true);setMessage(loop?'Playing the sound you attached. Stop sound ends playback.':'Preview only. Nothing attached; scene activation is unchanged.');
  }catch{if(ticket===generation.current){stop();setMessage('Sound could not start. Try Preview again; your selection is preserved.');}}
 }
 useEffect(()=>{const audio=engine.current;if(audio)audio.panner.pan.setTargetAtTime(Math.max(-1,Math.min(1,pan)),audio.context.currentTime,.08);},[pan]);
 useEffect(()=>{const audio=engine.current;if(audio)audio.gain.gain.setTargetAtTime(volume,audio.context.currentTime,.08);},[volume]);
 useEffect(()=>{const silence=()=>{generation.current++;const old=engine.current;engine.current=null;if(old)void old.context.close();setPlaying(false);};const visibility=()=>{if(document.hidden)silence();};window.addEventListener('blur',silence);document.addEventListener('visibilitychange',visibility);return()=>{generation.current++;const old=engine.current;engine.current=null;if(old)void old.context.close();window.removeEventListener('blur',silence);document.removeEventListener('visibilitychange',visibility);};},[]);
 useEffect(()=>{if(!activated){generation.current++;const old=engine.current;engine.current=null;if(old)void old.context.close();}},[activated]);
 function attach(id:string|null){stop();onChange(composeEpisodeSound(scene,episodeId,id,tags,note));setMessage(id?'Author sound choice recorded. Save review to Vault to retain it.':'Sound removed from this episode; the earlier decision remains in the ledger. Save review to retain this change.');}
 return <><button onClick={()=>setOpen(v=>!v)} aria-expanded={open}>Sound & samples</button>{playing&&<button onClick={stop}>Stop sound</button>}{open&&<aside className={`${css.evidence} ${css.sound}`} aria-label="Episode sound studio"><button onClick={()=>setOpen(false)}>Close sound studio</button><h3>Sound for {label}</h3><p>Choose the texture you want to give this space. This is your composition, separate from what you listened to then.</p>
 <p>{selected?`Attached: ${selected.title}`:'No sound attached.'}</p><button onClick={()=>void play()}>Preview synthetic tone</button><button disabled={!selected||!activated} onClick={()=>void play(selected?.url,true)}>Play attached sound</button><button disabled={!playing} onClick={stop}>Stop sound</button>{!activated&&<p>Previews are available now. Activate the reviewed scene to play an attached sound as a loop.</p>}
 <label>Volume <input aria-label="Sample volume" type="range" min="0" max="0.25" step="0.01" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></label>
 <fieldset><legend>Your texture tags</legend>{SOUND_TAGS.map(tag=><button key={tag} aria-pressed={tags.includes(tag)} onClick={()=>setTags(old=>old.includes(tag)?old.filter(t=>t!==tag):[...old,tag])}>{tag}</button>)}</fieldset>
 <label>Your vibe / composition note <textarea aria-label="Author sound composition note" maxLength={500} value={note} onChange={e=>setNote(e.target.value)} placeholder="What sound would you choose to place here?"/></label>
 <p>Suggestions rank by exact overlap with your chosen tags. Tags describe this small sample palette; no artist resemblance, emotion or memory is inferred. Your note is retained as Author wording.</p>
 {candidates.map(({sound,matched})=><article key={sound.id}><h4>{sound.title}</h4><p>{sound.tags.join(' · ')}<br/>{matched.length?`Matched your tags: ${matched.join(', ')}`:tags.length?'No matching tags; available for audition.':'Choose tags to rank this candidate.'}</p><p><a href={sound.source.page} target="_blank" rel="noreferrer">{sound.source.creator} / {sound.source.collection}</a> · <a href={sound.source.licenseUrl} target="_blank" rel="noreferrer">CC0</a></p><button onClick={()=>void play(sound.url)}>Preview {sound.title}</button><button onClick={()=>attach(sound.id)}>Attach {sound.title}</button></article>)}
 <button disabled={!selected} onClick={()=>attach(null)}>Remove attached sound</button><p>Samples play from this app. No Spotify audio, private-history upload or live sound-service connection. Stereo placement follows the node’s horizontal screen position. Playback stops when you leave this episode or view.</p><p role="status">{message}</p></aside>}</>;
}
