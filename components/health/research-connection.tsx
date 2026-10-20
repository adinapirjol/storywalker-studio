"use client";
import { useEffect, useRef, useState } from "react";
import { CycleContextForm } from "./cycle-context";
import type { CycleContext } from "@/lib/health/cycle-context";
import { ResearchEvidence } from "./research-evidence";
import { vaultFetch } from "@/lib/vault/vault-access";
import { ALL_SLEEP_SOURCES, type ResearchView } from "@/lib/health/research-journal";

export function ResearchConnection({ onView }: { onView: (view: ResearchView | null) => void }) {
  const [view, setView] = useState<ResearchView | null>(null);
  const [message, setMessage] = useState("Unlock to load saved research notes or connect your companion.");
  const [hypothesisDraft, setHypothesisDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const callback = useRef(onView);
  const generation = useRef(0);
  const reading = useRef(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => { callback.current = onView; }, [onView]);
  useEffect(() => { if (!view) setHypothesisDraft(""); }, [view]);
  useEffect(() => {
    const controller = new AbortController();
    async function read() {
      if (document.visibilityState === "hidden" || pending.current || reading.current) return;
      reading.current = true;
      const epoch = generation.current;
      try {
        // Automatic reads never summon an unlock dialog and never create notes.
        const response = await fetch("/api/health-research", { cache: "no-store", signal: controller.signal });
        if (epoch !== generation.current || controller.signal.aborted) return;
        if (!response.ok) { setView(null); callback.current(null); setMessage("Saved research is unavailable or locked. Unlock / reload to check its current state."); return; }
        const next = await response.json() as ResearchView;
        if (!controller.signal.aborted && epoch === generation.current) { setView(next); callback.current(next); }
      } catch { if (!controller.signal.aborted && epoch === generation.current) { setView(null); callback.current(null); setMessage("Connection unavailable. Saved research was not refreshed."); } }
      finally { reading.current = false; }
    }
    void read();
    const timer = setInterval(() => void read(), 15000);
    return () => { controller.abort(); pending.current?.abort(); clearInterval(timer); };
  }, []);
  async function action(action: string, source?: string, hypothesis?: string, cycleContext?: CycleContext | null) {
    if (pending.current) return;
    const replacesHistory = view?.journal && view.journal.history.length > 0 && (
      (action === "example" && view.journal.mode !== "synthetic") ||
      (action === "connect" && view.journal.mode !== "healthkit")
    );
    if (replacesHistory && !window.confirm("This starts a new research history and removes the current saved analyses from this journal. Accepted source records and separate backups remain. Continue?")) return;
    generation.current++;
    const controller = new AbortController(); pending.current = controller; setBusy(true);
    try {
      const response = await vaultFetch("/api/health-research", { method: "POST", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...(source ? { source } : {}), ...(hypothesis !== undefined ? { hypothesis } : {}), ...(cycleContext !== undefined ? { cycleContext } : {}) }) });
      if (!response.ok) throw Error("RESEARCH_ACTION_UNCERTAIN");
      const next = await response.json() as ResearchView;
      if (controller.signal.aborted) return;
      setView(next); callback.current(next);
      setMessage(action === "connect" ? "Private research enabled. Available sleep data has been analysed and saved; new accepted recordings update it automatically." : "Saved research state reloaded from the encrypted Vault.");
    } catch {
      if (!controller.signal.aborted) { setMessage("Could not confirm the action. Reload before retrying; it may already have saved."); setView(null); callback.current(null); }
    } finally { if (pending.current === controller) { pending.current = null; setBusy(false); } }
  }
  return <section aria-labelledby="research-connection">
    <h2 id="research-connection">Private connection & saved notes</h2>
    <p>Combine all accepted sleep sources, or inspect one source. New accepted recordings update research automatically while the Vault is unlocked. Automatic batch acceptance is controlled separately in BODY. This does not enable cloud sharing.</p>
    <button disabled={busy} onClick={() => void action("connect")}>Enable private Watch research</button>
    <button disabled={busy} onClick={() => void action("example")}>Save example research notes</button>
    <button disabled={busy} onClick={() => void action("refresh")}>Unlock / reload saved research</button>
    {view?.journal?.connected && <button disabled={busy} onClick={() => void action("disconnect")}>Pause automatic research</button>}
    <p role="status">{busy ? "Updating encrypted research…" : message}</p>
    {view?.journal && <>
      {view.journal.refreshRequired && <p role="status">Source changes were saved, but calculations need a refresh. Earlier derived notes were cleared. Your hypothesis and optional cycle context remain separate.</p>}
      {view.unavailable && <p>The current analysis limit was reached. Source evidence remains saved and can still be deleted. An unavailable analysis does not mean zero sleep.</p>}
      {!view.unavailable && <p><strong>{view.journal.mode === "synthetic" ? "Saved invented example" : view.journal.connected ? "Private research enabled" : "Private research paused"}</strong> · {view.records.length} usable source intervals · {view.omitted} omitted for uncertain source timing.</p>}
      {view.journal.mode === "healthkit" && !view.journal.source && <p>Choose all sleep sources to combine your recordings, or inspect one source below.</p>}
      {view.journal.mode === "healthkit" && view.sources.length > 0 && <label>Sleep source / device
        <select value={view.journal.source ?? ""} disabled={busy} onChange={e => { if (e.target.value) void action("connect", e.target.value); }}>
          <option value="">Select sleep sources</option><option value={ALL_SLEEP_SOURCES}>All sleep sources · combined history</option>{view.sources.map(s => <option key={s.key} value={s.key}>{s.label} · {s.count} records</option>)}
        </select>
      </label>}
      {view.journal.source === ALL_SLEEP_SOURCES && <p>Combining {view.sources.length} sleep sources. Overlaps count once. Conflicting overlapping coverage is marked uncertain and excluded from comparisons. Originals and their sources are preserved. The view covers up to 90 days; older source records remain saved.</p>}
      {view.journal.mode === "healthkit" && <section aria-label="Personal research hypothesis">
        <h3>Your hypothesis · unverified</h3>
        <p>Retrospective personal explanation, separate from measured findings. It never fills gaps or changes calculations.</p>
        {view.journal.hypothesis && <div><p>{view.journal.hypothesis.text}</p><p>Entered {view.journal.hypothesis.enteredAt} · concerns {view.journal.hypothesis.from || "unspecified dates"} to {view.journal.hypothesis.to || "unspecified dates"}. Retained separately as new analyses arrive.</p></div>}
        <label>Hypothesis to save<textarea maxLength={1200} value={hypothesisDraft} onChange={e => setHypothesisDraft(e.target.value)} /></label>
        <button disabled={busy || !hypothesisDraft.trim()} onClick={() => void action("set-hypothesis", undefined, hypothesisDraft)}>Save personal hypothesis</button>
        {view.journal.hypothesis && <button disabled={busy} onClick={() => void action("set-hypothesis", undefined, "")}>Remove personal hypothesis</button>}
      </section>}
      {view.journal.mode === "healthkit" && <CycleContextForm saved={view.journal.cycleContext} busy={busy} onSave={context => void action("set-cycle-context", undefined, undefined, context)} />}
      <details><summary>Research history · {view.journal.history.length} saved analyses</summary>
        <p>Latest 30 analyses retained. {view.journal.dropped} older analyses expired under this limit. Accepting a native source deletion clears this entire research history conservatively before recalculation. Vault backups remain separate copies.</p>
        {[...view.journal.history].reverse().map(run => <article key={run.id} className="health-insight">
          <h3>{run.at} · {run.algorithm}</h3><p>{run.range?.from || "Date range unavailable"} {run.range?.to && `to ${run.range.to}`} · {run.recordCount ?? "Unknown"} intervals · {run.omitted ?? "Unknown"} omitted</p><p>{run.source === ALL_SLEEP_SOURCES ? "All sleep sources" : run.source ? "Single sleep source" : "Source selection not recorded"} · {run.change}</p>
          {run.notes.length ? run.notes.map(note => <div key={note.id}><strong>{note.title}</strong><ResearchEvidence note={note} /><p>{note.uncertainty}</p></div>) : <p>No qualifying change in this data version.</p>}
        </article>)}
        <button disabled={busy} onClick={() => void action("delete-notes")}>Delete saved research notes, hypothesis & cycle context, and pause</button>
      </details>
    </>}
    <details><summary>Connect the iPhone / Watch companion</summary>
      <ol><li>Use the updated iPhone companion’s Sleep observatory controls to request read-only sleep access and start the selected history.</li><li>In Storywalker Connections & data, configure the private HealthKit receiver and import its pairing file into the phone’s Sleep observatory.</li><li>Start sleep delivery on the phone. Keep the Mac receiver running and Vault unlocked. Arrival timing depends on Apple Health sync and iOS background delivery.</li></ol>
      <p>Sleep data does not supply subjective energy or mood. Those remain unknown in private mode. Research notes are encrypted Vault payloads; the Vault database still exposes record metadata. Notes use a fixed metadata timestamp. No raw health data or notes are sent to an LLM.</p>
    </details>
  </section>;
}
