"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  applyEditorialAction,
  createEditorialExperiment,
  editorialTranscript,
  type EditorialAction,
  type EditorialExperiment,
} from "@/lib/editorial-experiment";
import { releaseObjectUrl, replaceObjectUrl } from "@/lib/local-audio";

function useSyntheticMotif() {
  const context = useRef<AudioContext | undefined>(undefined);
  const gain = useRef<GainNode | undefined>(undefined);
  const [status, setStatus] = useState<"stopped" | "playing" | "paused">("stopped");
  const [volume, setVolume] = useState(0.35);

  const stop = () => {
    const active = context.current;
    context.current = undefined;
    gain.current = undefined;
    if (active) void active.close();
    setStatus("stopped");
  };
  const play = (kind: EditorialExperiment["audioConsequence"]) => {
    stop();
    if (kind === "waiting" || kind === "intentional-silence") return;
    const active = new AudioContext();
    const level = active.createGain();
    level.gain.value = volume;
    level.connect(active.destination);
    const now = active.currentTime;
    const notes = kind === "motif-repeats" ? [220, 330, 220, 330] : [220, 294, 247, 392];
    notes.forEach((frequency, index) => {
      const oscillator = active.createOscillator();
      oscillator.type = kind === "motif-repeats" ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      oscillator.connect(level);
      oscillator.start(now + index * 0.22);
      oscillator.stop(now + index * 0.22 + 0.16);
    });
    context.current = active;
    gain.current = level;
    setStatus("playing");
    window.setTimeout(stop, 1100);
  };
  const pause = () => { if (context.current) { void context.current.suspend(); setStatus("paused"); } };
  const resume = () => { if (context.current) { void context.current.resume(); setStatus("playing"); } };
  useEffect(() => { if (gain.current) gain.current.gain.value = volume; }, [volume]);
  useEffect(() => () => stop(), []);
  return { status, volume, setVolume, play, pause, resume, stop };
}

export function RefusalExperiment() {
  const [experiment, setExperiment] = useState(createEditorialExperiment);
  const [revision, setRevision] = useState("");
  const [notice, setNotice] = useState("Choose an action. Nothing here changes the Aurora Coast journey export.");
  const [localUrl, setLocalUrl] = useState<string>();
  const localPlayer = useRef<HTMLAudioElement>(null);
  const motif = useSyntheticMotif();
  useEffect(() => () => releaseObjectUrl(localUrl), [localUrl]);

  function decide(action: EditorialAction) {
    const next = applyEditorialAction(experiment, action, revision);
    setExperiment(next);
    motif.play(next.audioConsequence);
    setNotice(`${action === "refuse" ? "Refusal" : action[0].toUpperCase() + action.slice(1)} recorded in this experiment’s local audit. ${editorialTranscript(next)}`);
  }
  function chooseLocalFile(file?: File) {
    if (!file) return;
    setLocalUrl((current) => replaceObjectUrl(current, file));
    setNotice("Local audio selected in this browser only. It is not uploaded, stored, or added to a journey export.");
  }
  function stopLocal() { if (localPlayer.current) { localPlayer.current.pause(); localPlayer.current.currentTime = 0; } }

  return (
    <main className="research-main">
      <header className="site-header"><Link className="wordmark" href="/research"><span className="wordmark-mark">S</span><span>Storywalker <i>Research Lab</i></span></Link><Link className="quiet-button" href="/">Studio</Link></header>
      <section className="experiment-hero"><p className="eyebrow"><span /> Experiment 01 · fictional Aurora Coast data</p><h1>Refusal is an editorial act.</h1><p>What must change when a proposed interpretation is accepted, revised, or refused?</p></section>
      <section className="experiment-layout">
        <article className={`proposal-stage ${experiment.visualConsequence}`} aria-describedby="consequence-transcript">
          <p className="section-kicker">One fictional proposal · non-canonical experiment</p>
          <div className="trace-diagram" aria-hidden="true"><span className="trace-origin">music trace</span><i /><i /><span className="trace-target">event note</span></div>
          <p className="proposal-words">{experiment.originalWording}</p>
          {experiment.revisedWording ? <p className="revised-words"><b>Edited wording:</b> {experiment.revisedWording}</p> : null}
          <p className="decision-label">State: {experiment.decision} · audit entries: {experiment.audit.length} · canonical journey: no</p>
        </article>
        <aside className="notebook-card experiment-controls">
          <h2>Author response</h2>
          <label htmlFor="revision">Optional revised wording</label>
          <textarea id="revision" value={revision} onChange={(event) => setRevision(event.target.value)} placeholder="Edit the proposed wording without erasing its original." />
          <div className="experiment-actions"><button onClick={() => decide("accept")} type="button">Accept</button><button onClick={() => decide("revise")} type="button">Revise</button><button onClick={() => decide("refuse")} type="button">Refuse</button></div>
          <div className="audio-controls"><p><b>Synthetic consequence</b> · no autoplay</p><button type="button" onClick={() => motif.play(experiment.audioConsequence)} disabled={experiment.audioConsequence === "waiting" || experiment.audioConsequence === "intentional-silence"}>Play</button><button type="button" onClick={motif.pause} disabled={motif.status !== "playing"}>Pause</button><button type="button" onClick={motif.resume} disabled={motif.status !== "paused"}>Resume</button><button type="button" onClick={motif.stop}>Stop</button><label>Volume <input aria-label="Synthetic audio volume" type="range" min="0" max="1" step="0.05" value={motif.volume} onChange={(event) => motif.setVolume(Number(event.target.value))} /></label></div>
          <p id="consequence-transcript" className="transcript"><b>Textual equivalent:</b> {editorialTranscript(experiment)}</p>
        </aside>
      </section>
      <section className="private-audio-card notebook-card">
        <p className="section-kicker">Optional local-only sound layer</p>
        <p>Selecting a file makes an object URL in this browser session only. It is never uploaded or written to local storage; leaving this page releases it.</p>
        <input aria-label="Choose a local audio file" type="file" accept="audio/*" onChange={(event) => chooseLocalFile(event.target.files?.[0])} />
        {localUrl ? <><audio ref={localPlayer} controls src={localUrl} /><button type="button" className="outline-button" onClick={stopLocal}>Stop local audio</button></> : null}
      </section>
      <p className="live-notice" role="status">{notice}</p>
      <footer><span>Fictional experiment only</span><span>Accept, revise and refuse stay outside canonical export</span></footer>
    </main>
  );
}
