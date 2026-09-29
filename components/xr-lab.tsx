"use client";
import {vaultFetch} from '@/lib/vault-access';
import {VaultUnlockButton} from './vault-access';
import Link from "next/link";
import { XRJourneyRoom } from "./xr-journey-room";
import { useEffect, useRef, useState } from "react";
import { cueGain, movementFeedback, parseSceneFile, DEMO_XR_SCENE, reviewExport, xrSceneSchema, type Decision, type XRScene } from "@/lib/xr-scene";
import { XRSceneDownload } from "./xr-scene-download";
import { XRListeningReview } from "./xr-listening-review";
import type { ListeningAnalysis } from "@/lib/xr-listening";
import styles from "./xr-lab.module.css";

type Voice = { oscillator: OscillatorNode; gain: GainNode; panner: PannerNode };
export function XRLab() {
  const [scene, setScene] = useState<XRScene>(DEMO_XR_SCENE);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [position, setPosition] = useState({ x: 0, z: 0 });
  const [heading, setHeading] = useState(0);
  const [budget, setBudget] = useState(15);
  const [playing, setPlaying] = useState(false);
  const [analysis, setAnalysis] = useState<ListeningAnalysis>();
  const [activated, setActivated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deltaUsername, setDeltaUsername] = useState("");
  const [projecting, setProjecting] = useState(false);
  const projection = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("Accept a cue, then enable sound. Headphones reveal its direction.");
  const engine = useRef<{ context: AudioContext; voices: Voice[] } | null>(null);
  const generation = useRef(0);
  function stop() {
    generation.current++;
    const current = engine.current;
    engine.current = null;
    if (current) { current.voices.forEach(voice => voice.oscillator.stop()); void current.context.close(); }
    setPlaying(false);
    setMessage("Sound stopped. You can continue the visual rehearsal.");
  }
  useEffect(() => {
    const pause = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", pause);
    return () => { document.removeEventListener("visibilitychange", pause); generation.current++; const current = engine.current; engine.current = null; if (current) void current.context.close(); };
  }, []);
  useEffect(() => {
    const current = engine.current;
    if (!current) return;
    const angle = heading * Math.PI / 180;
    current.voices.forEach((voice, index) => {
      const cue = scene.cues[index];
      const dx = cue.x - position.x, dz = cue.z - position.z;
      voice.panner.positionX.value = dx * Math.cos(angle) + dz * Math.sin(angle);
      voice.panner.positionZ.value = -dx * Math.sin(angle) + dz * Math.cos(angle);
      voice.gain.gain.setTargetAtTime((scene.draft && !activated || cue.treatment === "silent") ? 0 : cueGain(cue, position.x, position.z, decisions[cue.id] ?? "pending", budget), current.context.currentTime, 0.08);
    });
  }, [position, heading, decisions, budget, scene, playing, activated]);
  async function project() {
    setProjecting(true);
    try { await projection.current?.requestFullscreen(); } catch { setMessage("Fullscreen is unavailable; the projection preview is still open below."); }
  }
  async function start() {
    if (scene.draft && !activated) return;
    stop();
    const token = generation.current;
    try {
      const context = new AudioContext();
      engine.current = { context, voices: [] };
      await context.resume();
      if (generation.current !== token) return;
      const voices = scene.cues.map(cue => {
        const oscillator = context.createOscillator(), gain = context.createGain(), panner = context.createPanner();
        oscillator.frequency.value = cue.frequency;
        gain.gain.value = 0;
        panner.panningModel = "HRTF";
        panner.rolloffFactor = 0;
        oscillator.connect(gain).connect(panner).connect(context.destination);
        oscillator.start();
        return { oscillator, gain, panner };
      });
      engine.current = { context, voices };
      setPlaying(true); setMessage("Sound enabled. Only accepted cues within range and your time budget can sound.");
    } catch { stop(); setMessage("Audio could not start in this browser. The visual scene and review controls still work."); }
  }
  async function importScene(file?: File) {
    if (!file) return;
    stop();
    if (file.size > 10_000_000) { setMessage("Choose a selected scene JSON smaller than 10 MB, not a raw account export."); return; }
    try {
      const parsed = parseSceneFile(JSON.parse(await file.text()));
      setActivated(false); setAnalysis(undefined); setProjecting(false); setScene(parsed.scene); setDecisions(parsed.decisions); setPosition({ x: 0, z: 0 });
      setMessage("Scene loaded with its saved decisions and positions. Activation and sound remain off. Nothing was uploaded.");
    } catch { setMessage("This file is not a valid Storywalker XR scene. Use a current-scene download or a plain scene template; raw account exports and full analysis reports are not scene files."); }
  }
  async function vaultDraft(save = false) {
    stop(); setActivated(false); setProjecting(false); setBusy(true);
    try {
      const response = await vaultFetch("/api/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(save ? { action: "save-xr-review", xrReview: { scene, decisions } } : { action: "prepare-xr-draft" }) });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error ?? "The draft could not be loaded.");
      const parsed = xrSceneSchema.parse(result.xrDraft.scene);
      setScene(parsed); setDecisions(result.xrDraft.decisions ?? {}); setAnalysis(result.xrDraft.analysis); setPosition({ x: 0, z: 0 });
      setMessage(save ? "Review saved in the encrypted Vault. Activation remains off." : "Private draft loaded with its saved selections. Inspect the mapping; activation remains off.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not reach the local Vault."); }
    finally { setBusy(false); }
  }
  async function ground(contextOnly = false, archive = false) {
    stop(); setActivated(false); setProjecting(false); setBusy(true);
    try {
      const response = await vaultFetch("/api/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: archive ? "enrich-xr-evidence" : contextOnly ? "enrich-xr-context" : "ground-xr-journey", xrReview: { scene, decisions } }) });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error ?? "Geographic grounding failed.");
      setScene(xrSceneSchema.parse(result.xrDraft.scene)); setDecisions(result.xrDraft.decisions);
      setMessage(archive ? "Vault evidence scanned and saved encrypted. Strong matches attached; ambiguous candidates await your review in the evidence inventory. Geography, listening and Author moves are unchanged." : contextOnly ? "Calendar context attached with source links. Positions and accepted selections are unchanged; saved encrypted." : "Geographic revision saved encrypted. Selections preserved; previous scene archived. WORLD and MEMORY start identical. Activation remains off.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not ground the journey."); }
    finally { setBusy(false); }
  }
  async function syncDelta() {
    stop(); setActivated(false); setProjecting(false); setBusy(true);
    try {
      const response = await vaultFetch("/api/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync-lastfm-delta", deltaUsername }) });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error ?? "Delta read failed; no merge was made.");
      if (result.xrDraft) { setScene(xrSceneSchema.parse(result.xrDraft.scene)); setDecisions(result.xrDraft.decisions); setAnalysis(result.xrDraft.analysis); }
      setDeltaUsername("");
      setMessage(result.delta.message ?? `Merged ${result.delta.added} new scrobbles; ${result.delta.overlap} overlapping rows removed; ${result.delta.total} total source records. Read ${result.delta.pagesRead}/${result.delta.totalPages} pages through ${result.delta.to}. Previous source and draft archived encrypted; new revision is pending and inactive.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Delta read failed."); }
    finally { setBusy(false); }
  }
  function reviseCue(id: string, patch: Partial<XRScene["cues"][number]>) {
    stop(); setActivated(false);
    setScene(current => ({ ...current, cues: current.cues.map(cue => cue.id === id ? { ...cue, ...patch } : cue) }));
    setDecisions(current => ({ ...current, [id]: "pending" }));
  }
  function decide(id: string, value: Decision) {
    if (scene.draft) { stop(); setActivated(false); }
    setDecisions(current => ({ ...current, [id]: value }));
  }
  function moveHere(cue: XRScene["cues"][number]) {
    setPosition({ x: cue.x, z: cue.z });
    setMessage(movementFeedback(cue, decisions[cue.id] ?? "pending", !scene.draft || activated, playing, budget));
    const stage = document.getElementById("xr-spatial-stage");
    stage?.scrollIntoView({ behavior: "instant", block: "start" });
    stage?.focus({ preventScroll: true });
  }
  function download(value: unknown, name: string) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className={styles.main}>
    <header className={styles.header}><Link href="/research">Storywalker / Research</Link><span>03 — Installation rehearsal</span></header>
    <section className={styles.hero}><p>XR SKETCHBOOK · ROOM-SCALE AUDIOVISUAL STUDY</p><h1>{scene.draft ? scene.title : <>A room for<br /><em>possible departures.</em></>}</h1><p>Bring a sound, a place, an afterimage. Decide what belongs around you.</p><small>{scene.journeyLayout ? "WORLD / TIME / MEMORY · walkable episode spaces · no headset tracking" : "Installation rehearsal · synthetic tones · manually positioned listener · no headset tracking"}</small></section>
    <section className={styles.sources}>
      <button disabled={busy} onClick={() => void vaultDraft()}>Load private draft / analyse existing Last.fm</button>{" "}<VaultUnlockButton />
      <p role="status">{busy ? "Reading the existing local source…" : message}</p>
      {scene.draft && !scene.journeyLayout && <div className={styles.actions}><label>Last.fm username for delta read <input value={deltaUsername} onChange={event => setDeltaUsername(event.target.value)} autoComplete="off" maxLength={64} /></label><button disabled={busy || !deltaUsername.trim()} onClick={() => void syncDelta()}>Fetch missing Last.fm interval and merge</button></div>}
      {scene.draft && <><h2>Proposed mapping · activation {activated ? "on" : "off"}</h2><p>{scene.draft.assemblyReason}</p><p><b>Author-authored labels:</b> {scene.draft.authorLabels.join(" · ")}</p><p><b>Provenance:</b> {scene.draft.sourceRequest}</p><p>{scene.journeyLayout ? "WORLD positions derive from geographic evidence. MEMORY moves are separate Author decisions. The accepted selections are preserved independently of placement." : "Current cue positions are arbitrary proposals. Ground the journey to replace them with geographic episodes."}</p>
        {scene.journeyLayout && <button disabled={busy} onClick={() => void ground(false,true)}>Enrich all source windows from Vault</button>}
        {scene.journeyLayout && <button disabled={busy} onClick={() => void ground(true)}>Refresh stop context from Vault Calendar</button>}
        {!scene.journeyLayout && <button disabled={busy} onClick={() => void ground()}>Ground journey using existing Timeline + Last.fm</button>}
        <button disabled={!scene.cues.some(cue => decisions[cue.id] === "accepted")} onClick={() => setActivated(true)}>Activate accepted mapping</button>{" "}
        <button onClick={() => { stop(); setActivated(false); }}>Return to draft</button>{" "}
        <button disabled={busy} onClick={() => void vaultDraft(true)}>Save review to Vault</button>
        <XRSceneDownload scene={scene} decisions={decisions} />
      </>}
      {analysis && (scene.journeyLayout ? <details><summary>Full-period listening baseline and original candidate analysis</summary><XRListeningReview analysis={analysis} /></details> : <XRListeningReview analysis={analysis} />)}
    </section>
    <div ref={projection} className={`${styles.projection} ${projecting ? styles.projectionOpen : ""}`} aria-label="Installation projection preview">
      {projecting && <><svg viewBox="0 0 1000 600" role="img" aria-label="Slow abstract fields follow accepted cues and listener proximity. Refused cues disappear.">
        <defs><filter id="xr-soft" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="28" /></filter></defs>
        <rect width="1000" height="600" fill="#080f14" />
        {scene.cues.map((cue, index) => {
          const strength = (scene.draft && !activated) ? 0 : cueGain(cue, position.x, position.z, decisions[cue.id] ?? "pending", budget) / .08;
          return <g key={cue.id} opacity={strength} className={styles.field} style={{ animationDelay: `${index * -3}s` }}>
            <ellipse cx={500 + cue.x * 18} cy={300 + cue.z * 9} rx={80 + strength * 140} ry={60 + strength * 100} fill={cue.colour ?? ["#b6a1e3", "#a2e5b0", "#e9b987"][index % 3]} filter="url(#xr-soft)" />
            <ellipse cx={500 + cue.x * 18} cy={300 + cue.z * 9} rx={100 + strength * 140} ry={80 + strength * 100} fill="none" stroke="#ffffff70" strokeWidth=".6" />
          </g>;
        })}
      </svg><div className={styles.projectionBar}><span>Spatial score / {playing ? "sound enabled" : "silent visual rehearsal"}</span><button onClick={() => { setProjecting(false); if (document.fullscreenElement) void document.exitFullscreen(); }}>Close projection</button></div></>}
    </div>
    <div className={scene.journeyLayout ? styles.experienceLayout : styles.layout}>
      <section id="xr-spatial-stage" tabIndex={-1} className={styles.stage} aria-label="Spatial scene">
        <div className={styles.stageTitle}><span>{scene.title}</span><span>{scene.journeyLayout ? "WORLD / TIME / MEMORY" : "40 × 40 virtual metres"}</span></div>
        {scene.journeyLayout ? <XRJourneyRoom activated={activated} scene={scene} decisions={decisions} onChange={next => { stop(); setActivated(false); setScene(next); }} /> : <>
        <p aria-live="polite">Listener · X {position.x} · Z {position.z} · heading {heading}°</p>
        <svg viewBox="-24 -24 48 48" role="img" aria-label="Top-down spatial scene. Your position and cue ranges are adjustable with the controls below.">
          <defs><pattern id="xr-grid" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M 4 0 L 0 0 0 4" fill="none" stroke="#ffffff12" strokeWidth=".1" /></pattern></defs>
          <rect x="-24" y="-24" width="48" height="48" fill="url(#xr-grid)" />
          {scene.cues.map((cue, index) => <g key={cue.id} opacity={decisions[cue.id] === "refused" ? .2 : 1}><circle cx={cue.x} cy={cue.z} r={cue.radius} fill="none" stroke={decisions[cue.id] === "accepted" ? "#bcffab" : "#a6a0e5"} strokeWidth=".15" strokeDasharray=".5 .6" /><circle cx={cue.x} cy={cue.z} r=".7" fill="#c9c0ff" /><text x={cue.x + 1.3} y={cue.z + .6} fontSize="1.4" fill="#eee">0{index + 1}</text></g>)}
          <g transform={`translate(${position.x} ${position.z}) rotate(${heading})`}><circle r="1" fill="#bcffab" /><path d="M -.8 -1.6 L 0 -3 L .8 -1.6" fill="none" stroke="#bcffab" strokeWidth=".3" /></g>
        </svg>
        <div className={styles.controls}>
          <label>Move east / west <input type="range" min="-20" max="20" step=".5" value={position.x} onChange={event => setPosition({ ...position, x: +event.target.value })} /></label>
          <label>Move north / south <input type="range" min="-20" max="20" step=".5" value={position.z} onChange={event => setPosition({ ...position, z: +event.target.value })} /></label>
          <label>Turn · {heading}° <input type="range" min="0" max="360" value={heading} onChange={event => setHeading(+event.target.value)} /></label>
          <label>Time available · {budget} min <input type="range" min="5" max="60" step="5" value={budget} onChange={event => setBudget(+event.target.value)} /></label>
        </div>
        <button disabled={!!scene.draft && !activated} onClick={() => void project()}>Open projection</button>{" "}
        <button disabled={!!scene.draft && !activated} className={styles.primary} onClick={() => playing ? stop() : void start()}>{playing ? "Stop sound" : "Enable spatial sound"}</button>
        <p role="status">{message}</p></>}
      </section>
      <aside className={styles.cues}><details open={!scene.journeyLayout}><summary>Selection desk · accepted fragments and review decisions</summary><h2>{scene.journeyLayout ? "Your selected fragments" : "The proposed score"}</h2>{scene.journeyLayout && <p>Musical selections now appear as fields around episodes with matching observations. Author fragments retain their narrative roles; undated or unconfirmed locations remain unplaced.</p>}<p>Accepting selects a cue. Private drafts require a separate activation step; silent cues remain visual only. It does not confirm a memory or make it canon.</p>
        {scene.cues.map((cue, index) => <article key={cue.id}><small>0{index + 1} / {cue.source} / {cue.minutes} MIN</small><h3>{cue.title}</h3><p>{scene.journeyLayout ? cue.source === "lastfm" ? "Selected musical reference. Its observed episode fields replace the former arbitrary node position." : "Author-selected fragment. Narrative role and viewing context are preserved; geographic and temporal placement await separate evidence." : cue.note}</p><small>{cue.provenance}</small>{cue.evidence && <details><summary>Evidence / authorship</summary><p>{cue.evidence.kind} · {cue.evidence.sourceId}</p><ul>{cue.evidence.facts.map(fact => <li key={fact}>{fact}</li>)}</ul><p>Author labels: {cue.evidence.authorLabels.join(" · ") || "None"}</p><p>Interpretation: {cue.evidence.interpretation}</p></details>}
        {!scene.journeyLayout && <details><summary>Reposition / revise treatment</summary><div className={styles.controls}>
          <label>Node X · {cue.x}<input type="range" min="-20" max="20" step=".5" value={cue.x} onChange={event => reviseCue(cue.id, { x: +event.target.value })} /></label>
          <label>Node Z · {cue.z}<input type="range" min="-20" max="20" step=".5" value={cue.z} onChange={event => reviseCue(cue.id, { z: +event.target.value })} /></label>
          <label>Radius · {cue.radius}<input type="range" min="1" max="20" value={cue.radius} onChange={event => reviseCue(cue.id, { radius: +event.target.value })} /></label>
          <label>Tone · {cue.frequency} Hz<input type="range" min="80" max="1200" value={cue.frequency} onChange={event => reviseCue(cue.id, { frequency: +event.target.value })} /></label>
          <label>Colour<input type="color" value={cue.colour ?? "#b6a1e3"} onChange={event => reviseCue(cue.id, { colour: event.target.value })} /></label>
          <label>Sound<select value={cue.treatment ?? "synthetic-tone"} onChange={event => reviseCue(cue.id, { treatment: event.target.value as "silent" | "synthetic-tone" })}><option value="silent">Silent</option><option value="synthetic-tone">Synthetic marker only</option></select></label>
        </div><p>Revisions return this cue to pending and disable draft activation.</p></details>}<p className={styles.state}>{decisions[cue.id] ?? "pending"} · {scene.journeyLayout ? "selection independent of placement" : cue.minutes > budget ? "outside time budget" : Math.hypot(cue.x - position.x, cue.z - position.z) < cue.radius ? "within range" : "out of range"}</p><div className={styles.actions}>{(["accepted", "pending", "refused"] as Decision[]).map((value, i) => <button key={value} aria-pressed={(decisions[cue.id] ?? "pending") === value} onClick={() => decide(cue.id, value)}>{["Accept", "Reconsider", "Refuse"][i]}</button>)}{!scene.journeyLayout && <button onClick={() => moveHere(cue)}>Move here</button>}</div></article>)}
      </details></aside>
    </div>
    <section className={styles.sources}><h2>Your installation, deliberately composed.</h2><p>Rehearse a room with headphones and a screen or projector. Accept one cue and move toward it, then turn: its direction changes while its visual field grows with proximity. Refusal removes both. Projection uses the same score as the audio; it is not audio-waveform analysis. The coordinate grid is a virtual score, not a measured floor plan.</p><p>Music history can provide references; Maps can provide chosen places; a film diary can provide motifs; your calendar can provide a time window. Episode spaces are deterministic presentation containers. Save review to Vault preserves your composition encrypted; downloading preserves a portable private copy. Unsaved changes remain only in this tab.</p>
      <div className={styles.actions}><XRSceneDownload scene={scene} decisions={decisions} /><button onClick={() => download(DEMO_XR_SCENE, "storywalker-xr-template.json")}>Download blank demo template</button><label className={styles.file}>Load selected scene<input type="file" accept="application/json,.json" onChange={event => { void importScene(event.target.files?.[0]); event.target.value = ""; }} /></label><button onClick={() => download({ ...reviewExport(scene, decisions), ...(analysis ? { analysis } : {}) }, "storywalker-xr-local-review.json")}>Download full analysis report</button><button onClick={() => { stop(); setAnalysis(undefined); setActivated(false); setProjecting(false); setScene(DEMO_XR_SCENE); setDecisions({}); setPosition({ x: 0, z: 0 }); setHeading(0); setBudget(15); setMessage("Demo restored. Imported scene cleared from this study."); }}>Clear / restore demo</button></div>
      <p><small>The saved review includes your selected scene and refusals. Keep it private. Vault data is read only by the explicit private-draft action; no model is running.</small></p>
      {!scene.draft && <div className={styles.next}><div><h3>An optional outdoor edition</h3><p>Echoes supports geofenced audio walks. This scene uses relative positions; choosing real sites and preparing cleared audio comes before manual authoring there.</p><a href="https://echoes.xyz/" target="_blank" rel="noreferrer">Explore Echoes ↗</a></div><div><h3>A model that listens</h3><p>LAION CLAP is a candidate for matching your own recordings to text prompts. Its similarities would remain suggestions. Spotify content stays outside model inputs.</p><a href="https://huggingface.co/laion/larger_clap_music_and_speech" target="_blank" rel="noreferrer">Read the model card ↗</a></div><div><h3>Keep building</h3><p>Choose three fragments, test their positions, then record what you accepted, changed or refused. A small repeatable study can become installation research.</p><Link href="/research/echo-lab">Open the geolocation study →</Link></div></div>}
    </section>
  </main>;
}
