"use client";

import { ResearchNotebook } from "./research-notebook";
import type {ResearchSession} from "@/lib/research-session";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  canStartLocation,
  createLocativeSession,
  FICTIONAL_ECHOES,
  processLocativePosition,
  refuseActivatedEcho,
  resetLocativeSession,
  type Coordinate,
  type LocativeSession,
} from "@/lib/locative";

const SIMULATION_POSITIONS: Array<{ label: string; position: Coordinate }> = [
  { label: "Outside both zones", position: { latitude: 0, longitude: -0.003 } },
  { label: "Enter Threshold", position: { latitude: 0, longitude: 0 } },
  { label: "Remain at Threshold", position: { latitude: 0, longitude: 0 } },
  { label: "Leave zones", position: { latitude: 0, longitude: 0.004 } },
  { label: "Enter Return", position: { latitude: 0, longitude: 0.002 } },
];

export function LocativeEchoLab() {
  const [entries,setEntries]=useState<ResearchSession["entries"]>([]);
  const origin=useRef<Coordinate|null>(null),generation=useRef(0);
  const [waiting,setWaiting]=useState(false);
  const [session, setSession] = useState<LocativeSession>(createLocativeSession);
  const [mode, setMode] = useState<"simulation" | "live">("simulation");
  const [consent, setConsent] = useState(false);
  const [locationState, setLocationState] = useState("GPS has not been requested.");
  const [accuracy, setAccuracy] = useState<number>();
  const watcher = useRef<number | undefined>(undefined);

  function record(action:string,subject:string){setEntries(old=>[...old,{action,subject,at:new Date().toISOString()}].slice(-500));}
  function clearLocation(){generation.current++;if(watcher.current!==undefined)navigator.geolocation.clearWatch(watcher.current);watcher.current=undefined;}
  const stopLocation=()=>{clearLocation();setWaiting(false);setLocationState("Location stopped. No coordinates or route history were saved.");};
  useEffect(()=>{const pause=()=>{if(document.hidden)stopLocation();};document.addEventListener('visibilitychange',pause);return()=>{clearLocation();document.removeEventListener('visibilitychange',pause);};},[]);
  function applyPosition(position:Coordinate,label:string,live=false){
    if(live&&!origin.current)origin.current=position;
    const anchor=origin.current;
    const echoes=live&&anchor?FICTIONAL_ECHOES.map((echo,i)=>({...echo,centre:{latitude:anchor.latitude,longitude:anchor.longitude+i*220/(111320*Math.max(.01,Math.cos(anchor.latitude*Math.PI/180)))}})):FICTIONAL_ECHOES;
    setSession(current=>processLocativePosition(echoes,position,current));setAccuracy(position.accuracyMeters);
    setLocationState(`${label}. ${live?'Temporary test zones are anchored around the first fix; these are not recorded places.':'Fictional movement only.'}`);
    record(live?'live-fix':'simulation-step',live?'A location fix was processed; coordinates excluded.':label);
  }
  function startLocation(){
    if(!canStartLocation(consent,typeof navigator!=="undefined"&&"geolocation" in navigator))return;
    clearLocation();const token=generation.current;setWaiting(true);setLocationState('Asking the browser for a fix (up to 12 seconds). You can continue in simulation at any time.');
    navigator.geolocation.getCurrentPosition(position=>{
      if(token!==generation.current)return;setWaiting(false);
      applyPosition({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracyMeters:position.coords.accuracy},`Live fix · ±${Math.round(position.coords.accuracy)} m`,true);
      watcher.current=navigator.geolocation.watchPosition(p=>{if(token===generation.current)applyPosition({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracyMeters:p.coords.accuracy},'Updated live fix',true);},()=>{if(token===generation.current)setLocationState('No refined fix available. The earlier fix remains in this session only.');},{enableHighAccuracy:false,maximumAge:15000,timeout:15000});
    },error=>{if(token!==generation.current)return;setWaiting(false);const reason=error.code===1?'The browser denied location access.':error.code===3?'The browser supplied no location within 12 seconds.':'The browser location provider is unavailable.';setLocationState(`${reason} No position was invented. Use Simulation here, or open this same page in a browser/device with location access and retry.`);record('location-unavailable',reason);},{enableHighAccuracy:false,maximumAge:60000,timeout:12000});
  }
  function reset() { stopLocation(); origin.current=null; setSession(resetLocativeSession()); setAccuracy(undefined); record("reset","Trigger state reset; earlier research actions retained."); }

  return (
    <main className="research-main">
      <header className="site-header"><Link className="wordmark" href="/research"><span className="wordmark-mark">S</span><span>Storywalker <i>Research Lab</i></span></Link><Link className="quiet-button" href="/">Studio</Link></header>
      <section className="experiment-hero"><p className="eyebrow"><span /> Experiment 02 · independent locative-audio study</p><h1>Movement may trigger sound; it does not settle meaning.</h1><p>How does physical movement change authorship and interpretation of a music-memory narrative?</p></section>
      <section className="locative-layout">
        <article className="notebook-card echo-diagram-card">
          <p className="section-kicker">{mode==="live"?"Temporary local test zones · not place evidence":"Fictional circular geofences · no map service"}</p>
          <svg viewBox="0 0 520 250" role="img" aria-label="Abstract diagram of two fictional circular geofences">
            <path d="M40 180 C150 60, 315 235, 480 65" className="walk-line" />
            <circle cx="195" cy="135" r="72" className="zone-one" /><circle cx="325" cy="115" r="72" className="zone-two" />
            <text x="150" y="140">Threshold</text><text x="282" y="120">Return</text>
          </svg>
          <p className="small-note">The diagram is schematic. Simulation uses fictional coordinates; live mode anchors temporary zones to the first fix. Neither creates a recorded place.</p>
          <div className="distance-readout">{FICTIONAL_ECHOES.map((echo) => <span key={echo.id}>{echo.title}: {session.lastEvents.find((event) => event.echoId === echo.id) ? `${Math.round(session.lastEvents.find((event) => event.echoId === echo.id)!.distanceMeters)} m` : "awaiting position"}</span>)}</div>
        </article>
        <aside className="notebook-card echo-controls">
          <h2>Operate the study</h2>
          <div className="mode-tabs"><button type="button" aria-pressed={mode === "simulation"} onClick={() => { stopLocation(); origin.current=null; setSession(createLocativeSession()); setMode("simulation"); }}>Simulation</button><button type="button" aria-pressed={mode === "live"} onClick={() => {stopLocation();origin.current=null;setSession(createLocativeSession());setMode("live");}}>Live location</button></div>
          {mode === "simulation" ? <div className="simulation-controls"><p>Desktop-ready simulated movement:</p>{SIMULATION_POSITIONS.map(({ label, position }) => <button key={label} type="button" onClick={() => applyPosition(position, `Simulation: ${label}`)}>{label}</button>)}</div> : <div className="live-location-controls"><p>Live mode places two temporary test zones around your first fix, 220 metres apart. The zones and coordinates stay in memory. A research snapshot can save actions and your reflection, but never this location. For a deliberately saved location use Field Trace.</p><label><input type="checkbox" checked={consent} onChange={(event) => {setConsent(event.target.checked);if(!event.target.checked)stopLocation();}} /> I understand this use of location.</label><button type="button" onClick={startLocation} disabled={waiting||!canStartLocation(consent, typeof navigator !== "undefined" && "geolocation" in navigator)}>{waiting?"Waiting for browser…":"Request location fix"}</button><button type="button" onClick={stopLocation}>Pause / leave location</button></div>}
          <button type="button" className="outline-button" onClick={reset}>Reset session</button>
          <p className="gps-state" role="status">{locationState}{accuracy !== undefined ? ` Accuracy: ±${Math.round(accuracy)} m.` : ""}</p>
          <p className="small-note">If GPS accuracy is wider than half a zone’s radius, the result is marked uncertain and will not claim a precise trigger.</p>
        </aside>
      </section>
      <section className="echo-list" aria-label="Fictional Echoes">
        {FICTIONAL_ECHOES.map((echo) => {
          const event = session.lastEvents.find((candidate) => candidate.echoId === echo.id);
          const refused = session.refusedEchoIds.includes(echo.id);
          const active = session.triggeredEchoIds.includes(echo.id);
          return <article className="notebook-card echo-card" key={echo.id}><p className="section-kicker">{echo.triggerPolicy} · {event?.kind ?? "not evaluated"}</p><h2>{echo.title}</h2><p>{echo.transcript}</p><p className="small-note"><b>Uncertainty:</b> {echo.uncertainty}</p><p className="small-note"><b>Provenance:</b> {echo.provenance}</p><p className="small-note"><b>Audio alternative:</b> read this transcript or use off-site/manual playback; audio and GPS are not required to understand the experiment.</p>{active ? <button type="button" onClick={() => {setSession((current) => refuseActivatedEcho(current, echo.id));record("refuse",echo.id);}} disabled={refused}>{refused ? "Echo refused" : "Refuse activated Echo"}</button> : null}</article>;
        })}
      </section>
      <ResearchNotebook sourceContext="Fictional Threshold / Return zones; live mode uses temporary local test zones. Not an attendance or travel record." study="echo" entries={[...entries.slice(-490),...session.lastEvents.map(e=>({action:`zone-${e.kind}`,subject:e.echoId,wording:`Triggered: ${e.triggered}; refused: ${session.refusedEchoIds.includes(e.echoId)}. Temporary test zone only.`}))]} mode={mode}/>
      <aside className="safety-note"><b>Pedestrian safety:</b> do not use this while crossing roads, cycling, driving, or in any situation where attending to the device is unsafe. Pause or leave at any time.</aside>
      <footer><span>Independent study, not an Echoes clone</span><span>Inspired by general locative-audio practice and public descriptions of map geofences triggering sound</span></footer>
    </main>
  );
}
