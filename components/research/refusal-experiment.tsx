"use client";

import { ResearchNotebook } from "./research-notebook";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  applyEditorialAction,
  createEditorialExperiment,
  editorialTranscript,
  type EditorialAction,
  type EditorialExperiment,
  FICTIONAL_LISTENING_EVIDENCE,
} from "@/lib/research/editorial-experiment";
import { releaseObjectUrl, replaceObjectUrl } from "@/lib/music/local-audio";

function useSyntheticMotif() {
  const context = useRef<AudioContext | undefined>(undefined);
  const gain = useRef<GainNode | undefined>(undefined);
  const [status, setStatus] = useState<"stopped" | "playing" | "paused">("stopped");
  const [volume, setVolume] = useState(0.15);

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
    let active: AudioContext;
    try { active = new AudioContext(); } catch { return; }
    const level = active.createGain();
    level.gain.value = volume * 0.2;
    level.connect(active.destination);
    const now = active.currentTime;
    const notes = kind === "motif-repeats" ? [220, 330, 220, 330] : [220, 294, 247, 392];
    notes.forEach((frequency, index) => {
      const oscillator = active.createOscillator();
      oscillator.type = kind === "motif-repeats" ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      const envelope = active.createGain();
      const pan = active.createStereoPanner();
      pan.pan.value = index % 2 ? 0.65 : -0.65;
      const start = now + index * 0.22;
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(1, start + 0.02);
      envelope.gain.linearRampToValueAtTime(0, start + 0.16);
      oscillator.connect(envelope);
      envelope.connect(pan);
      pan.connect(level);
      oscillator.start(now + index * 0.22);
      oscillator.stop(now + index * 0.22 + 0.16);
      if (index === notes.length - 1) oscillator.onended = () => { if (context.current === active) stop(); };
    });
    context.current = active;
    gain.current = level;
    setStatus("playing");

  };
  const pause = () => { if (context.current) { void context.current.suspend(); setStatus("paused"); } };
  const resume = () => { if (context.current) { void context.current.resume(); setStatus("playing"); } };
  useEffect(() => { if (gain.current) gain.current.gain.value = volume * 0.2; }, [volume]);
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
    let next: EditorialExperiment;
    try { next = applyEditorialAction(experiment, action, revision); } catch (error) { setNotice(error instanceof Error ? error.message : "Decision could not be recorded."); return; }
    setExperiment(next);
    motif.stop();
    stopLocal();
    setNotice(`${action === "refuse" ? "Refusal" : action[0].toUpperCase() + action.slice(1)} recorded in this page’s session history, not yet saved to the Vault. ${editorialTranscript(next)}`);
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
      <section className="experiment-hero"><p className="eyebrow"><span /> Listening Again · fictional Aurora Coast study</p><h1>Who gets to process?</h1><p>One encounter. Separate sources. Dated readings that can disagree. A rejectable edit.</p><p>Refusal becomes part of the archive: a visible gap, retained wording and a recorded editorial boundary. The response tells us how to handle a proposal; it does not tell us what a life meant.</p></section>
      <section className="experiment-layout">
        <article className={`proposal-stage ${experiment.visualConsequence}`} aria-describedby="consequence-transcript">
          <p className="section-kicker">Illustrative research stimulus · written with Codex, not inferred by a listening model</p>
          <div className="trace-diagram listening-diagram" aria-hidden="true"><span className="trace-origin">encounter</span><i /><span>present voice</span><i /><span className="trace-target">playlist</span></div>
          <details><summary>WORLD / TIME · inspect source evidence and limits</summary><p>{experiment.evidence.encounter}</p><p>{experiment.evidence.platform}</p><p>Selection context: {experiment.evidence.selectionContext}. {experiment.evidence.occurredAt}. {experiment.evidence.recordedAt}.</p></details>
          <p className="proposal-words"><b>Editor proposal:</b> {experiment.originalWording}</p>
          {experiment.decision === "revised" && experiment.revisedWording ? <p className="revised-words"><b>Edited wording:</b> {experiment.revisedWording}</p> : null}
          <p className="decision-label">State: {experiment.decision} · audit entries: {experiment.audit.length} · canonical journey: no</p>
        </article>
        <aside className="notebook-card experiment-controls">
          <h2>Author response</h2>
          <label htmlFor="revision">Author response / revised wording</label>
          <textarea maxLength={4000} id="revision" value={revision} onChange={(event) => setRevision(event.target.value)} placeholder="Edit the proposed wording without erasing its original." />
          <p className="small-note">Accept keeps the proposal and records your response separately. Revise changes its wording. Refuse retains your response and the rejected proposal. None confirms the fictional event.</p><div className="experiment-actions"><button onClick={() => decide("accept")} type="button">Accept</button><button onClick={() => decide("revise")} type="button">Revise</button><button onClick={() => decide("refuse")} type="button">Refuse</button><button onClick={() => decide("unresolved")} type="button">Leave unresolved</button></div>
          <div className="audio-controls"><p role="status"><b>Original synthetic sound</b> · optional stereo preview · {motif.status}</p><button type="button" onClick={() => motif.play(experiment.audioConsequence)} disabled={experiment.audioConsequence === "waiting" || experiment.audioConsequence === "intentional-silence"}>Play</button><button type="button" onClick={motif.pause} disabled={motif.status !== "playing"}>Pause</button><button type="button" onClick={motif.resume} disabled={motif.status !== "paused"}>Resume</button><button type="button" onClick={motif.stop}>Stop</button><label>Volume <input aria-label="Synthetic audio volume" type="range" min="0" max="1" step="0.05" value={motif.volume} onChange={(event) => motif.setVolume(Number(event.target.value))} /></label></div>
          <p id="consequence-transcript" className="transcript"><b>Textual equivalent:</b> {editorialTranscript(experiment)}</p>
        </aside>
      </section>
      <section className="private-audio-card notebook-card"><h2>MEMORY · present and earlier readings</h2><p>Return to this Moment: does the connection mean the same thing now? Each action adds a dated reading; disagreement does not erase earlier wording. Dates below record review time, not encounter time. Keep responses private by leaving them unsaved or saving only to the encrypted Vault.</p><ol>{experiment.audit.map((entry, index) => <li key={index}>{entry.at} · {entry.action}{entry.wording ? ` — ${entry.wording}` : " — no wording disclosed"}</li>)}</ol></section>
      <ResearchNotebook sourceContext={`Fictional Aurora Coast proposal: ${experiment.originalWording}. Evidence: ${JSON.stringify(FICTIONAL_LISTENING_EVIDENCE)}` } study="refusal" entries={experiment.audit.map(e=>({...e,subject:experiment.proposalId}))}/>
      <section className="private-audio-card notebook-card">
        <p className="section-kicker">Optional local-only sound layer</p>
        <p>Choose only original or appropriately licensed sound. Metadata grants no recording rights. A file is not proof of a live encounter or a Spotify match. Selecting a file makes an object URL in this browser session only. It is never uploaded or written to local storage; leaving this page releases it.</p>
        <input aria-label="Choose a local audio file" type="file" accept="audio/*" onChange={(event) => chooseLocalFile(event.target.files?.[0])} />
        {localUrl ? <><audio ref={localPlayer} controls src={localUrl} /><button type="button" className="outline-button" onClick={stopLocal}>Stop local audio</button></> : null}
      </section>
      <p className="live-notice" role="status">{notice}</p>
      <footer><span>Fictional experiment only</span><span>Accept, revise and refuse stay outside canonical export</span></footer>
    </main>
  );
}
