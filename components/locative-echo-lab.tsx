"use client";

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
  const [session, setSession] = useState<LocativeSession>(createLocativeSession);
  const [mode, setMode] = useState<"simulation" | "live">("simulation");
  const [consent, setConsent] = useState(false);
  const [locationState, setLocationState] = useState("GPS has not been requested.");
  const [accuracy, setAccuracy] = useState<number>();
  const watcher = useRef<number | undefined>(undefined);

  function locationError(error: GeolocationPositionError, stage: "initial" | "refinement") {
    if (error.code === error.PERMISSION_DENIED) return "Location permission was denied. Enable it for this browser/app, then try again.";
    if (error.code === error.TIMEOUT) return stage === "initial" ? "No location fix arrived within 30 seconds. This often happens indoors or on desktop; try again near a window, or use simulation." : "A more precise update did not arrive, but the first location remains available in this session.";
    return `Location could not be read: ${error.message || "unknown browser error"}.`;
  }

  const stopLocation = () => {
    if (watcher.current !== undefined && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watcher.current);
    watcher.current = undefined;
    setLocationState("GPS watcher stopped. No coordinate history was saved.");
  };
  useEffect(() => () => stopLocation(), []);
  function applyPosition(position: Coordinate, origin: string) {
    setSession((current) => processLocativePosition(FICTIONAL_ECHOES, position, current));
    setAccuracy(position.accuracyMeters);
    setLocationState(`${origin}. Current position is processed only in memory; no route history is retained.`);
  }
  function startLocation() {
    if (!canStartLocation(consent, typeof navigator !== "undefined" && "geolocation" in navigator)) return;
    stopLocation();
    setLocationState("Looking for an initial location fix. Nothing is recorded or uploaded.");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyPosition({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy }, `Initial location with ±${Math.round(position.coords.accuracy)} m accuracy`);
        watcher.current = navigator.geolocation.watchPosition(
          (refined) => applyPosition({ latitude: refined.coords.latitude, longitude: refined.coords.longitude, accuracyMeters: refined.coords.accuracy }, `Refined location with ±${Math.round(refined.coords.accuracy)} m accuracy`),
          (error) => setLocationState(locationError(error, "refinement")),
          { enableHighAccuracy: true, maximumAge: 10_000, timeout: 60_000 },
        );
      },
      (error) => setLocationState(locationError(error, "initial")),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 30_000 },
    );
  }
  function reset() { stopLocation(); setSession(resetLocativeSession()); setAccuracy(undefined); }

  return (
    <main className="research-main">
      <header className="site-header"><Link className="wordmark" href="/research"><span className="wordmark-mark">S</span><span>Storywalker <i>Research Lab</i></span></Link><Link className="quiet-button" href="/">Studio</Link></header>
      <section className="experiment-hero"><p className="eyebrow"><span /> Experiment 02 · independent locative-audio study</p><h1>Movement may trigger sound; it does not settle meaning.</h1><p>How does physical movement change authorship and interpretation of a music-memory narrative?</p></section>
      <section className="locative-layout">
        <article className="notebook-card echo-diagram-card">
          <p className="section-kicker">Fictional circular geofences · no map service</p>
          <svg viewBox="0 0 520 250" role="img" aria-label="Abstract diagram of two fictional circular geofences">
            <path d="M40 180 C150 60, 315 235, 480 65" className="walk-line" />
            <circle cx="195" cy="135" r="72" className="zone-one" /><circle cx="325" cy="115" r="72" className="zone-two" />
            <text x="150" y="140">Threshold</text><text x="282" y="120">Return</text>
          </svg>
          <p className="small-note">The diagram uses fictional coordinates. A circle represents a rough trigger zone, not a real place or a precise boundary.</p>
          <div className="distance-readout">{FICTIONAL_ECHOES.map((echo) => <span key={echo.id}>{echo.title}: {session.lastEvents.find((event) => event.echoId === echo.id) ? `${Math.round(session.lastEvents.find((event) => event.echoId === echo.id)!.distanceMeters)} m` : "awaiting position"}</span>)}</div>
        </article>
        <aside className="notebook-card echo-controls">
          <h2>Operate the study</h2>
          <div className="mode-tabs"><button type="button" aria-pressed={mode === "simulation"} onClick={() => { stopLocation(); setMode("simulation"); }}>Simulation</button><button type="button" aria-pressed={mode === "live"} onClick={() => setMode("live")}>Live location</button></div>
          {mode === "simulation" ? <div className="simulation-controls"><p>Desktop-ready simulated movement:</p>{SIMULATION_POSITIONS.map(({ label, position }) => <button key={label} type="button" onClick={() => applyPosition(position, `Simulation: ${label}`)}>{label}</button>)}</div> : <div className="live-location-controls"><p>Live location is opt-in. It is used only to evaluate these fictional zones in memory, is never persisted or uploaded, and can be stopped at any time. This experiment is not a Storywalker Field Trace.</p><label><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I understand this use of location.</label><button type="button" onClick={startLocation} disabled={!canStartLocation(consent, typeof navigator !== "undefined" && "geolocation" in navigator)}>Request location fix</button><button type="button" onClick={stopLocation}>Pause / leave location</button></div>}
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
          return <article className="notebook-card echo-card" key={echo.id}><p className="section-kicker">{echo.triggerPolicy} · {event?.kind ?? "not evaluated"}</p><h2>{echo.title}</h2><p>{echo.transcript}</p><p className="small-note"><b>Uncertainty:</b> {echo.uncertainty}</p><p className="small-note"><b>Provenance:</b> {echo.provenance}</p><p className="small-note"><b>Audio alternative:</b> read this transcript or use off-site/manual playback; audio and GPS are not required to understand the experiment.</p>{active ? <button type="button" onClick={() => setSession((current) => refuseActivatedEcho(current, echo.id))} disabled={refused}>{refused ? "Echo refused" : "Refuse activated Echo"}</button> : null}</article>;
        })}
      </section>
      <aside className="safety-note"><b>Pedestrian safety:</b> do not use this while crossing roads, cycling, driving, or in any situation where attending to the device is unsafe. Pause or leave at any time.</aside>
      <footer><span>Independent study, not an Echoes clone</span><span>Inspired by general locative-audio practice and public descriptions of map geofences triggering sound</span></footer>
    </main>
  );
}
