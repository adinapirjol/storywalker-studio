"use client";

import { useEffect, useRef, useState } from "react";
import type { Evidence, Hypothesis, InteractionAction } from "@/lib/nova/contracts";
import { ModelProposal } from "./model-proposal";
import { connectionEditorial } from "@/lib/nova/editorial";
import { vaultFetch } from "@/lib/vault/vault-access";
import type { ResearchSession } from "@/lib/research/research-session";

export function ConnectionEditorial({ h, revision, canPropose, evidence, dispatch }: { h: Hypothesis; revision: number; canPropose: boolean; evidence: Evidence[]; dispatch: (a: InteractionAction) => void }) {
  const [observation, setObservation] = useState("");
  const [reading, setReading] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposeOnSave, setProposeOnSave] = useState(false);
  const [proposal, setProposal] = useState("");
  const [experiment, setExperiment] = useState("");
  const [records, setRecords] = useState<Array<{ id: string; payload: ResearchSession }>>([]);
  const pending = useRef<{ signature: string; id: string; session: ResearchSession } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function request(save: boolean) {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    try {
      let savedId: string | undefined;
      if (save) {
        const signature = JSON.stringify({ h, observation, reading });
        if (pending.current?.signature !== signature) {
          pending.current = { signature, id: crypto.randomUUID(), session: connectionEditorial(h, observation, reading, new Date().toISOString()) };
        }
        const response = await vaultFetch("/api/vault", {
          method: "POST", signal: abort.signal, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save-research-session", researchSnapshotId: pending.current.id, researchSession: pending.current.session }),
        });
        if (!response.ok) throw new Error("Could not confirm the save. Unlock the Vault and retry the same reading.");
        savedId = (await response.json()).id;
        setStatus("Saved to the encrypted Vault. Checking the persisted snapshot…");
      }
      const response = await vaultFetch("/api/vault", {
        method: "POST", signal: abort.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list-research-sessions" }),
      });
      if (!response.ok) throw new Error(save ? "Save succeeded; reload saved readings to verify it." : "Unlock the Vault to load saved readings.");
      const data = await response.json();
      const matching = (data.records as Array<{ id: string; payload: ResearchSession }>).filter(r =>
        r.payload.mode === "live" && (r.id === h.readingId || r.payload.entries.some(e => e.subject === h.id)));
      setRecords(matching);
      if (save && !matching.some(r => r.id === savedId && r.payload.note === observation &&
        (!reading.trim() || r.payload.entries.some(e => e.action === "editorial-reading" && e.wording === reading)))) {
        throw new Error("The save response arrived, but the reading could not be verified. Reload saved readings.");
      }
      setStatus(save ? "Your observation is verified in the encrypted Vault. The hypothesis verdict is unchanged." : `${matching.length} saved readings for this connection.`);
      if (save && savedId && proposeOnSave && canPropose && !abort.signal.aborted) {
        setStatus("Observation saved and verified. Preparing one local proposal; any failure leaves your observation saved.");
        dispatch({ type: "MODIFY_CONNECTION", command: { action: "reconsider-reading", expectedRevision: revision, hypothesisId: h.id, readingId: savedId, consent: true } });
      }
    } catch (error) {
      if (!abort.signal.aborted) setStatus(error instanceof Error ? error.message : "Could not complete the request.");
    } finally {
      controller.current = null;
      if (!abort.signal.aborted) setBusy(false);
    }
  }

  return <details>
    <summary>My observation · CTM editorial reading</summary>
    <p>Your recollection can differ from a platform record. Keep your own meaning here, without approving the proposed connection.</p>
    <label>My observation<textarea disabled={busy} maxLength={4000} value={observation} onChange={e => setObservation(e.target.value)} /></label>
    <details><summary>Add a separate CTM reading (optional)</summary><label>My editorial reading<textarea disabled={busy} maxLength={4000} value={reading} onChange={e => setReading(e.target.value)} /></label></details>
    <p>One private Vault snapshot preserves your words, this proposal and its source references. It records a present reading, not a historical event or permission to publish.</p>
    <label><input type="checkbox" checked={proposeOnSave} disabled={!canPropose || busy} onChange={e => setProposeOnSave(e.target.checked)} /> Use a simple local reflection prompt instead (no model)</label>
    <p>{canPropose ? "Save first, then review the exact model request below. Nothing leaves this device without your separate one-request consent." : "Proposals are paused or disabled. You can still save your observation."}</p>
    <button disabled={busy || !observation.trim()} onClick={() => void request(true)}>{proposeOnSave && canPropose ? "Save & create local prompt" : "Save observation"}</button>{" "}
    <button disabled={busy} onClick={() => void request(false)}>Load saved readings</button>
    <p role="status">{status}</p>
    {records.map(r => <article key={r.id}><p><b>Saved observation:</b> {r.payload.note}</p>
      {r.payload.entries.filter(e => e.action === "editorial-reading").map((e, i) => <p key={i}><b>CTM reading:</b> {e.wording}</p>)}
      <small>{r.id}</small>
      <ModelProposal h={h} record={r} revision={revision} evidence={evidence} canPropose={canPropose && !busy} dispatch={dispatch} />
      <details><summary>Optional local reflection prompt · no model</summary><button disabled={busy || !canPropose || !r.payload.entries.some(e => e.subject === h.id && e.action === "author-observation")} onClick={() => dispatch({ type: "MODIFY_CONNECTION", command: { action: "reconsider-reading", expectedRevision: revision, hypothesisId: h.id, readingId: r.id, consent: true } })}>Create local reflection prompt</button></details>
      {!h.readingId && <details><summary>Advanced: save a direction composed in conversation</summary>
        <p>Use this saved response as evidence for a conversation-assisted proposal. It stays unapproved; the original stays in history.</p>
        <label>New proposal<textarea maxLength={2000} value={proposal} onChange={e => setProposal(e.target.value)} /></label>
        <label>How to explore it<textarea maxLength={2000} value={experiment} onChange={e => setExperiment(e.target.value)} /></label>
        <button disabled={busy || !proposal.trim() || !experiment.trim()} onClick={() => { setStatus("Sending your proposal for review…"); dispatch({ type: "MODIFY_CONNECTION", command: { action: "propose-reading", expectedRevision: revision, hypothesisId: h.id, readingId: r.id, consent: true, interpretation: proposal, experiment } }); }}>Use this reading & propose</button>
      </details>}
      </article>)}
  </details>;
}
