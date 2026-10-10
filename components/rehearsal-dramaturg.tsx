"use client";
import {useEffect,useRef,useState} from "react";
import {dramaturgResultSchema,dramaturgReviewSchema,appendReview,type RehearsalScore,type ReviewEvent} from "@/lib/rehearsal-dramaturg";
import styles from "./xr-lab.module.css";
import panel from "./rehearsal-dramaturg.module.css";

export function RehearsalDramaturg({onLoad,onInvalidate}:{onLoad:(score:RehearsalScore)=>void;onInvalidate:(id:string)=>void}){
  const [direction,setDirection]=useState("Make this fictional coastline feel suspended between departure and arrival.");
  const [scores,setScores]=useState<RehearsalScore[]>([]);
  const [archive,setArchive]=useState<RehearsalScore[]>([]);
  const [history,setHistory]=useState<ReviewEvent[]>([]);
  const [status,setStatus]=useState("Local fictional rehearsal. No Vault sources are sent.");
  const [busy,setBusy]=useState(false);
  const [ready,setReady]=useState(false);
  const socket=useRef<WebSocket|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{socket.current?.close();if(timer.current)clearTimeout(timer.current);},[]);
  function cancel(){socket.current?.close();socket.current=null;if(timer.current)clearTimeout(timer.current);setBusy(false);setStatus("Cancelled. Previous reviews retained.");}
  function compose(){
    cancel();setBusy(true);setStatus("Connecting to the local dramaturg…");
    const ws=new WebSocket("ws://127.0.0.1:8765/rehearse");socket.current=ws;
    timer.current=setTimeout(()=>{if(socket.current===ws){cancel();setStatus("Timed out. Check that the local service is running.");}},30000);
    ws.onopen=()=>ws.send(JSON.stringify({direction,scene:"fictional-coast"}));
    ws.onmessage=event=>{if(socket.current!==ws)return;try{
      const message=JSON.parse(event.data);
      if(message.type==="progress")setStatus(`Dramaturg: ${message.stage}…`);
      if(message.type==="result"){
        const result=dramaturgResultSchema.parse(message.result);
        setScores(result.scores);setArchive(a=>[...a,...result.scores]);setReady(true);setStatus(`Three fictional proposals · ${result.model}. Review before loading.`);
      }
      if(message.type==="error")setStatus(message.message);
    }catch{setStatus("The service returned an invalid score. Nothing loaded.");}};
    ws.onerror=()=>{if(socket.current===ws)setStatus("Start the local Python service on port 8765, then try again.");};
    ws.onclose=()=>{if(socket.current===ws){setBusy(false);socket.current=null;if(timer.current)clearTimeout(timer.current);}};
  }
  function review(score:RehearsalScore,action:ReviewEvent["action"]){if(action!=="accepted")onInvalidate(score.id);setHistory(h=>appendReview(h,score.id,action));}
  async function restore(file?:File){if(!file)return;if(file.size>2_000_000){setStatus("Choose a review smaller than 2 MB.");return;}try{const review=dramaturgReviewSchema.parse(JSON.parse(await file.text()));cancel();setArchive(review.scores);setScores(review.scores.slice(-3));setHistory(review.history);setReady(false);setStatus("Review history restored for inspection. Generate fresh proposals before loading; activation remains off.");}catch{setStatus("Invalid dramaturg review. Existing decisions retained.");}}
  function exportReview(){const url=URL.createObjectURL(new Blob([JSON.stringify({format:"storywalker-dramaturg-review",version:1,scores:archive,history,canonical:false,activated:false},null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="fictional-dramaturg-review.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section className={`${styles.sources} ${panel.panel}`} aria-label="The Rehearsal Dramaturg">
    <h2>The Rehearsal Dramaturg</h2><p>Compose a fictional room from three synthetic tones. Interpretations remain proposals.</p>
    <label>Creative direction <textarea maxLength={500} value={direction} onChange={e=>{setDirection(e.target.value);setReady(false);}} rows={3}/></label>
    <button disabled={busy||direction.trim().length<3} onClick={compose}>Propose three scores</button>{busy&&<button onClick={cancel}>Cancel</button>}
    <label>Restore a saved review <input type="file" accept="application/json,.json" onChange={e=>{void restore(e.target.files?.[0]);e.target.value="";}}/></label>
    <p role="status">{status}</p>
    <div className={panel.grid}>{scores.map(score=>{const last=[...history].reverse().find(h=>h.scoreId===score.id);return <article key={score.id}>
      <h3>{score.title}</h3><p>{score.rationale}</p><p>{score.uncertainty}</p>
      <ul>{score.scene.cues.map(c=><li key={c.id}>{c.title}: {c.provenance}</li>)}</ul>
      <p>Score: {score.timing.map(b=>`${b.cue_id} at ${b.start_seconds}s for ${b.duration_seconds}s`).join(" · ")}</p>
      <p>Author review: {last?.action??"pending"}</p>
      <button disabled={!ready||busy} onClick={()=>review(score,"accepted")}>Accept proposal</button>{" "}
      <button onClick={()=>review(score,"refused")}>Refuse</button>{" "}<button onClick={()=>{review(score,"reconsidered");setReady(false);setStatus("Edit the direction above and propose again. Earlier decisions stay in history.");}}>Revise direction</button>{" "}
      <button disabled={!ready||busy||last?.action!=="accepted"} onClick={()=>onLoad(score)}>Load accepted score into rehearsal</button>
    </article>;})}</div>
    {!!history.length&&<><p>{history.length} Author decisions retained for this session. Download before leaving.</p><button onClick={exportReview}>Download proposals and review history</button></>}
  </section>;
}
