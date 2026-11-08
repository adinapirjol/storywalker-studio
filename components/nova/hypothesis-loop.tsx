"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { vaultFetch } from "@/lib/vault/vault-access";
import { browserVaultSession } from "@/lib/vault/vault-auth-client";
import type { Command, InteractionAction, LoopView } from "@/lib/nova/contracts";
import css from "./hypothesis-loop.module.css";
import { SourceCoverage } from "./source-coverage";
import { ConnectionReview } from "./connection-review";

type Input = Command extends infer C ? C extends Command ? Omit<C, "expectedRevision"> : never : never;


export function HypothesisLoop() {
  const [view, setView] = useState<LoopView>();
  const [selected, setSelected] = useState<string[]>([]);
  const [focus, setFocus] = useState<string>();
  const [message, setMessage] = useState("Choose what to explore. Keep, edit or reject the connections you find.");
  const [busy, setBusy] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const hasPrivateView = useRef(false);
  const epoch = useRef(0);
  useEffect(() => {
    const clear = () => { hasPrivateView.current = false; epoch.current++; controller.current?.abort(); setView(undefined); setSelected([]); setFocus(undefined); setBusy(false); busyRef.current = false; setMessage("Your private view was cleared. Open your evidence to continue."); };
    const visibility = () => { if (document.hidden) clear(); };
    const timer = setInterval(() => {
      if (!hasPrivateView.current) return;
      void browserVaultSession().then(session => { if (!session.active) clear(); }).catch(clear);
    }, 15000);
    document.addEventListener("visibilitychange", visibility);
    return () => { epoch.current++; controller.current?.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  async function request(command?: Input, focusId?: string, statusMessage?: string) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    const ticket = ++epoch.current;
    const abort = new AbortController(); controller.current = abort;
    try {
      const response = await vaultFetch("/api/nova", { method: command ? "POST" : "GET", cache: "no-store", credentials: "same-origin", signal: abort.signal, ...(command ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...command, expectedRevision: view?.state.revision ?? 0 }) } : {}) });
      const result = await response.json();
      if (ticket !== epoch.current || abort.signal.aborted) return;
      if (!response.ok) { if (response.status === 401) { hasPrivateView.current = false; setView(undefined); setSelected([]); setFocus(undefined); } throw new Error(result.error ?? "Unlock the Vault to continue."); }
      hasPrivateView.current = true; setView(result); setSelected(result.state.sourceIds);
      setMessage(statusMessage ?? (command ? result.message : "Choose evidence to explore, or continue reviewing your connections."));
      setFocus(previous => focusId && result.state.hypotheses.some((h: LoopView["state"]["hypotheses"][number]) => h.id === focusId) ? focusId : (command?.action === "propose-reading" || command?.action === "reconsider-reading") ? result.state.hypotheses.find((h: LoopView["state"]["hypotheses"][number]) => h.alternativeTo === command.hypothesisId && h.readingId === command.readingId)?.id : result.state.hypotheses.some((h: LoopView["state"]["hypotheses"][number]) => h.id === previous && ["proposed", "approved", "modified"].includes(h.status)) ? previous : result.state.hypotheses.find((h: LoopView["state"]["hypotheses"][number]) => h.status === "proposed")?.id);
    } catch (error) { if (ticket === epoch.current && !abort.signal.aborted) setMessage(error instanceof Error ? error.message : "Request failed. Reload before retrying."); }
    finally { if (ticket === epoch.current) { setBusy(false); busyRef.current = false; } }
  }
  function dispatch(action: InteractionAction) {
    if (action.type === "RELOAD_CONNECTION") { void request(undefined, action.id, action.message); return; }
    if (action.type === "INSPECT_CONNECTION") setFocus(action.id);
    else if ("command" in action) void request(action.command);
  }
  const hypotheses = view?.state.hypotheses ?? [];
  const current = hypotheses.filter(h => ["proposed", "approved", "modified"].includes(h.status));
  const inspected = hypotheses.find(h => h.id === focus);
  const linked = new Set(current.flatMap(h => h.refs.map(r => r.id)));
  const available = view?.evidence ?? [];
  const nodes = [...available.filter(e => linked.has(e.id)), ...available.filter(e => !linked.has(e.id))].slice(0, 32);
  const coordinates = new Map(nodes.map((e, i) => [e.id, { x: 290 + 230 * Math.cos(i * 2 * Math.PI / Math.max(1, nodes.length)), y: 180 + 140 * Math.sin(i * 2 * Math.PI / Math.max(1, nodes.length)) }]));
  return <main className={`research-main ${css.main}`}>
    <header><p className="eyebrow">HYPOTHESIS HYPERLOOP / PRIVATE EVIDENCE / v0.1</p><h1>What might connect?</h1><p>Suggested connections. Your interpretation.</p><nav><Link href="/atlas">Atlas of Now</Link> · <Link href="/director">Director</Link> · <Link href="/vault">Vault</Link></nav></header>
    <p role="status" aria-live="polite" className={css.notice}>{message}</p>
    <div className={css.actions}><button disabled={busy} onClick={() => void request()}>{busy ? "Working…" : view ? "Refresh" : "Open my evidence"}</button>{view?.state.enabled && <button disabled={busy} onClick={() => void request({ action: "pause", paused: !view.state.paused })}>{view.state.paused ? "Resume" : "Pause"}</button>}</div>
    {view && <>
      <details className={css.card} open={!view.state.enabled || !current.length}><summary className={css.sectionTitle}>Your evidence · {selected.length} selected</summary><p>Choose up to eight sources. Explore lets Hyperloop analyze these records and their updates locally. Nothing is sent to an external model.</p>
        {view.inventory.filter(s => s.supported).map(source => <div className={css.sourceChoice} key={source.id}>
          <label className={css.option}><input type="checkbox" aria-label={source.title} aria-describedby={`description-${source.id}`} checked={selected.includes(source.id)} disabled={busy || !selected.includes(source.id) && selected.length >= 8} onChange={e => setSelected(ids => e.target.checked ? [...ids, source.id] : ids.filter(id => id !== source.id))} /><span><strong>{source.title}</strong><small id={`description-${source.id}`}>{source.description}</small></span></label>
        </div>)}
        {!view.inventory.some(s => s.supported) && <p>No supported sources found. Add an Author capture or explicitly import listening observations through the Vault.</p>}
        <div className={css.actions}><button disabled={busy || !selected.length} onClick={() => void request({ action: "configure", sourceIds: selected, consent: true, analyze: true })}>{busy ? "Exploring…" : "Explore selected evidence"}</button></div>
        <details><summary>Source references</summary>{view.inventory.filter(s => s.supported).map(source => <p key={source.id}>{source.title}<br/><code>{source.id}</code></p>)}</details>
      </details>
      {view.state.paused && <p className={css.notice}>Paused. Resume when you want to continue.</p>}
      {current.length > 0 && <nav className={css.actions} aria-label="Browse connections"><button disabled={current.findIndex(h => h.id === focus) <= 0} onClick={() => setFocus(current[current.findIndex(h => h.id === focus) - 1]?.id)}>Previous</button><span>Connection {Math.max(1, current.findIndex(h => h.id === focus) + 1)} of {current.length}</span><button disabled={current.findIndex(h => h.id === focus) >= current.length - 1} onClick={() => setFocus(current[current.findIndex(h => h.id === focus) + 1]?.id)}>Next</button></nav>}
      {inspected && <ConnectionReview key={`${inspected.id}:${view.state.revision}`} h={inspected} view={view} busy={busy || view.state.paused || !view.state.enabled} dispatch={dispatch} />}
      {!current.length && view.state.enabled && <p>No connections to review yet. Explore a selection, or check what is missing below.</p>}
      <details className={css.card}><summary className={css.sectionTitle}>Evidence map</summary><p>Dashed lines are suggestions. Solid lines are connections you have kept or edited. Positions are a diagram, not geography.</p>
        <svg viewBox="0 0 580 360" className={css.graph} role="img" aria-label="Current evidence connections. Use the numbered connection buttons below to inspect and review.">
          {current.map(h => { const a = coordinates.get(h.refs[0].id), b = coordinates.get(h.refs[1]?.id ?? h.refs[0].id); return a && b ? <line key={h.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={h.status === "proposed" ? "#7e9cba" : "#bde6b3"} strokeDasharray={h.status === "proposed" ? "5 6" : undefined} /> : null; })}
          {nodes.map((e, i) => { const p = coordinates.get(e.id)!; return <g key={e.id}><title>{e.title}</title><circle cx={p.x} cy={p.y} r="15" fill="#1a2c37" stroke="#c8ddd8"/><text x={p.x} y={p.y + 4} textAnchor="middle" fill="white" fontSize="11">{i + 1}</text></g>; })}
        </svg><p>{nodes.length} evidence nodes shown (diagram limit 32). All normalized evidence remains inspectable below. Rejected and stale edges leave this active graph; their history remains.</p>
      </details>
      <details className={css.card}><summary className={css.sectionTitle}>Evidence details & gaps</summary><p>{view.evidence.filter(e => !e.timestamp).length} missing timestamps · {view.evidence.filter(e => !e.location).length} missing locations · {view.evidence.filter(e => !e.provenance).length} missing provenance · {hypotheses.filter(h => h.status === "invalidated").length} stale interpretations</p><p>Time coverage: {view.evidence.map(e => e.timestamp).filter(Boolean).sort()[0] ?? "unknown"} → {view.evidence.map(e => e.timestamp).filter(Boolean).sort().at(-1) ?? "unknown"}. Domains: {[...new Set(view.evidence.map(e => e.sourceType))].join(", ") || "none selected"}.</p>
        <ul>{view.gaps.map((gap, i) => <li key={i}>{gap}</li>)}</ul>
        <SourceCoverage inventory={view.inventory} />
        <details><summary>Inspect normalized evidence and provenance</summary>{view.evidence.map(e => <article key={e.id} className={css.evidence}><h3>{e.title}</h3><p>{e.authority} · {e.sourceType} · {e.timestamp ?? "time unknown"} ({e.temporalPrecision})</p><p>{e.caveat}</p>{e.excerpt && <p>Evidence excerpt (up to 500 characters): {e.excerpt}</p>}<p>Source: {e.sourceId}<br/>Evidence: {e.id}<br/>Revision: {e.revision}<br/>Provenance: {e.provenance ?? "missing"}</p><p>{e.gaps.join("; ")}</p></article>)}</details>
        <h3>Optional evidence tasks</h3><ul><li>Correct ambiguous capture dates in the source before reconsideration.</li><li>Inspect exact artist labels before treating them as the same entity.</li><li>Add provenance to incomplete source records; do not fill gaps from a guess.</li></ul>
      </details>
      <details className={css.card}><summary className={css.sectionTitle}>Connection history · {hypotheses.length}</summary><p>{view.state.decisions.length} decisions · review revision {view.state.revision}. Approval recognizes a connection; it never rewrites its source.</p>
        {hypotheses.map(h => <details key={h.id}><summary>{h.relationship} · {h.status} · {h.createdAt}</summary><p>{h.interpretation}</p><p>ID: {h.id}<br/>Supersedes: {h.supersedes ?? "none"}<br/>Alternative to: {h.alternativeTo ?? "none"}</p>{view.state.decisions.filter(d => d.hypothesisId === h.id).map(d => <p key={d.id}>{d.at} · {d.action} · {d.reason ?? ""} · {d.note}</p>)}<button onClick={() => dispatch({ type: "INSPECT_CONNECTION", id: h.id })}>Inspect historical connection</button></details>)}
      </details>
      <details className={css.card}><summary className={css.sectionTitle}>Model request history · {view.state.modelAttempts.length}</summary><p>One-request consent only. The most recent 50 attempts stay encrypted here; deleting Hyperloop derived data clears this history. Cancellation cannot retract content already sent.</p>{view.state.modelAttempts.map(a => <p key={a.id}>{a.at} · {a.status === "outcome-unknown" ? "outcome unknown" : a.status}{a.summary ? ` · ${a.summary}` : ""}<br/><small>Packet: {a.packetHash}</small></p>)}</details>
      <details className={css.card}><summary className={css.sectionTitle}>Privacy & research settings</summary><p>Analysis happens only when you ask. To stop using all selected sources, turn it off here. Your decision history stays available.</p><button disabled={busy || !view.state.enabled} onClick={() => void request({ action: "disable" })}>Turn off and clear source access</button><h3>Optional research counters</h3><p>Opt-in aggregate counters live encrypted in this Vault. They contain no excerpts or webcam data. Time to decision measures wall-clock time since generation, not attention. Acceptance rate alone is not quality.</p><button disabled={busy} onClick={() => void request({ action: "metrics", enabled: !view.state.metricsEnabled })}>{view.state.metricsEnabled ? "Stop research counters" : "Opt in to local research counters"}</button><pre>{JSON.stringify(view.state.metrics, null, 2)}</pre><button disabled={busy} onClick={() => void request({ action: "delete-metrics" })}>Delete counters and opt out</button>
        <hr/><label className={css.option}><input type="checkbox" checked={deleteConfirmed} onChange={e => setDeleteConfirmed(e.target.checked)} />Erase Hyperloop decisions, revisions, boundaries and metrics. Older Nova-linked Author notes are kept, but copied model wording is removed; forgotten boundaries cannot constrain future analyses.</label><button disabled={busy || !deleteConfirmed} onClick={() => { setDeleteConfirmed(false); void request({ action: "delete-derived" }); }}>Delete Hyperloop history and derived data</button>
      </details>
    </>}
  </main>;
}
