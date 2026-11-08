"use client";

import { useState } from "react";
import type { Hypothesis, InteractionAction, LoopView, Rejection, Relationship } from "@/lib/nova/contracts";
import css from "./hypothesis-loop.module.css";
import { ConnectionEditorial } from "./connection-editorial";
const reasons: Array<[Rejection, string]> = [["does-not-fit", "Doesn’t fit"], ["incorrect-evidence", "The evidence is wrong"], ["insufficient-evidence", "Not enough evidence"], ["not-now", "Not relevant now"], ["never-again", "Never connect these sources again"], ["other", "Other"]];
const feedback: Record<Rejection, string> = {
  "does-not-fit": "This suggestion will not repeat. At most one different alternative may appear.",
  "incorrect-evidence": "Connections using these evidence versions will be set aside until the source is corrected.",
  "insufficient-evidence": "This pair will wait for changed evidence. No immediate alternative.",
  "not-now": "This evidence pair will be set aside. No immediate alternative.",
  "never-again": "Blocks every connection between these source containers, including future updates—not just these two records.",
  other: "Your explanation stays with the decision. At most one different alternative may appear.",
};
export function ConnectionReview({ h, view, busy, dispatch }: { h: Hypothesis; view: LoopView; busy: boolean; dispatch: (a: InteractionAction) => void }) {
  const [panel, setPanel] = useState<"edit" | "reject" | null>(null);
  const [interpretation, setInterpretation] = useState(h.interpretation);
  const [relationship, setRelationship] = useState<Relationship>(h.relationship);
  const [ids, setIds] = useState(h.refs.map(r => r.id));
  const [reason, setReason] = useState<Rejection>("does-not-fit");
  const [note, setNote] = useState("");
  const disabled = busy || !["proposed", "approved", "modified"].includes(h.status);
  return <section className={css.card} aria-label="Connection review">
    <p className={css.status}>{h.status === "approved" ? "Kept by you" : h.status === "modified" ? "Edited by you" : h.status === "proposed" ? "A possible connection" : h.status}</p>
    {h.modelVersion === "local-reflection-v1" && h.status === "proposed" ? <>
      <h2>What changes when your observation leads?</h2>
      <p>Local reflection prompt · generated from your wording</p>
      <p style={{ whiteSpace: "pre-wrap" }}>{h.interpretation}</p>
    </> : <h2>{h.interpretation}</h2>}
    <p>{h.observation}</p>
    <ul>{h.refs.map(r => { const e = view.evidence.find(item => item.id === r.id && item.revision === r.revision); return <li key={r.id}><strong>{e?.title ?? "Source unavailable or changed"}</strong> · {e?.timestamp ?? "date unknown"}</li>; })}</ul>
    <p className={css.caveat}>A suggestion to consider, not a fact about what this meant to you.</p>
    <div className={css.actions}>
      <button disabled={disabled || h.status === "approved"} onClick={() => dispatch({ type: "APPROVE_CONNECTION", command: { action: "approve", expectedRevision: view.state.revision, hypothesisId: h.id } })}>{h.status === "approved" ? "Kept" : "Keep this connection"}</button>
      <button disabled={disabled} aria-expanded={panel === "edit"} onClick={() => setPanel(panel === "edit" ? null : "edit")}>Edit</button>
      <button disabled={disabled} aria-expanded={panel === "reject"} onClick={() => setPanel(panel === "reject" ? null : "reject")}>Reject</button>
    </div>
    {panel === "edit" && <div>
      <label>What does the connection mean to you?<textarea maxLength={2000} value={interpretation} onChange={e => setInterpretation(e.target.value)} /></label>
      <details><summary>Change the relationship or supporting records</summary>
        <label>Relationship<select value={relationship} onChange={e => setRelationship(e.target.value as Relationship)}>{["same-day", "same-track", "same-artist", "author-association"].map(r => <option key={r}>{r}</option>)}</select></label>
        <label>Evidence (select {relationship === "author-association" ? "1–8" : "2–8"})<select multiple size={8} value={ids} onChange={e => setIds(Array.from(e.target.selectedOptions, o => o.value))}>{view.evidence.map(e => <option key={e.id} value={e.id}>{e.title} · {e.timestamp ?? "date unknown"}</option>)}</select></label>
      </details>
      <button disabled={disabled || !interpretation.trim() || ids.length < (relationship === "author-association" ? 1 : 2) || ids.length > 8} onClick={() => dispatch({ type: "MODIFY_CONNECTION", command: { action: "modify", expectedRevision: view.state.revision, hypothesisId: h.id, interpretation, relationship, evidenceIds: ids } })}>Save my version</button>
    </div>}
    {panel === "reject" && <div>
      <label>Why doesn’t it fit?<select value={reason} onChange={e => setReason(e.target.value as Rejection)}>{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <p>{feedback[reason]}</p>
      <details><summary>Add an explanation (optional)</summary><label>Your note<textarea value={note} maxLength={2000} onChange={e => setNote(e.target.value)} /></label></details>
      <button disabled={disabled} onClick={() => dispatch({ type: "REJECT_CONNECTION", command: { action: "reject", expectedRevision: view.state.revision, hypothesisId: h.id, reason, note } })}>Reject connection</button>
    </div>}
    {h.alternativeTo && <p>Reconsidered from an earlier connection. <button onClick={() => dispatch({ type: "INSPECT_CONNECTION", id: h.alternativeTo! })}>Inspect original connection</button></p>}
    <ConnectionEditorial key={h.id} h={h} revision={view.state.revision} evidence={view.evidence} canPropose={view.state.enabled && !view.state.paused && !busy} dispatch={dispatch} />
    {h.modelReceipt && <details><summary>Model provenance & cited excerpts</summary><p>{h.modelReceipt.provider} · {h.modelReceipt.model} · unapproved interpretation until you decide</p>
      {h.modelReceipt.grounds.map((g, i) => <p key={i}><b>{g.source}:</b> {g.quote}</p>)}
      {h.modelReceipt.sources.map(s => <p key={s.alias}><small>{s.alias} → {s.id} · revision {s.revision}</small></p>)}
      <small>Request fingerprint: {h.modelReceipt.packetHash}</small></details>}
    <details><summary>Why this connection? Evidence & uncertainty</summary>
      <p><b>Why now:</b> {h.reason}</p><p><b>Uncertainty:</b> {h.uncertainty}</p><p><b>How to check:</b> {h.validation}</p>
      <p>Confidence is uncalibrated. Contradictions have not been automatically assessed.</p>
      {h.refs.map(r => { const e = view.evidence.find(item => item.id === r.id && item.revision === r.revision); return <article key={r.id} className={css.evidence}><h3>{e?.title ?? "Source unavailable or changed"}</h3>{e?.excerpt && <p>Evidence excerpt: {e.excerpt}</p>}<p>{e?.provenance ?? "Provenance unavailable"}</p><p>Reference: {r.id}<br/>Revision: {r.revision}</p></article>; })}
    </details>
  </section>;
}
