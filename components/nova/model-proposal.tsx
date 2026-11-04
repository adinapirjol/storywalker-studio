"use client";
import { useEffect, useRef, useState } from "react";
import { vaultFetch } from "@/lib/vault/vault-access";
import type { Evidence, Hypothesis, InteractionAction } from "@/lib/nova/contracts";
import type { ModelPreview, ModelSelection } from "@/lib/nova/model-contract";
import type { ResearchSession } from "@/lib/research/research-session";

export function ModelProposal({ h, record, revision, evidence, canPropose, dispatch }: {
  h: Hypothesis; record: { id: string; payload: ResearchSession }; revision: number;
  evidence: Evidence[]; canPropose: boolean; dispatch: (a: InteractionAction) => void;
}) {
  const [observation, setObservation] = useState(record.payload.note);
  const [editorial, setEditorial] = useState("");
  const [includeOriginal, setIncludeOriginal] = useState(true);
  const [ids, setIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<ModelPreview>();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const controller = useRef<AbortController | null>(null);
  const selected = useRef<ModelSelection | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const targetId = record.payload.entries.some(e => e.subject === h.id && e.action === "author-observation") ? h.id : h.readingId === record.id ? h.alternativeTo : undefined;
  const reading = record.payload.entries.find(e => e.subject === targetId && e.action === "editorial-reading")?.wording ?? "";
  const eligible = record.payload.entries.some(e => e.subject === targetId && e.action === "author-observation");
  function invalidate() { setPreview(undefined); setConsent(false); selected.current = null; }
  async function request(send: boolean) {
    if (controller.current) return;
    const abort = new AbortController(); controller.current = abort; setBusy(true); setStatus("");
    try {
      if (send && (!preview || !selected.current || !consent)) return;
      const selection: ModelSelection = send ? selected.current! : { expectedRevision: revision, hypothesisId: targetId!, readingId: record.id, observationExcerpt: observation, editorialExcerpt: editorial, includeOriginal, evidenceIds: ids };
      const body = send ? { action: "generate", selection, requestId: preview!.requestId, snapshotHash: preview!.snapshotHash, requestSignature: preview!.requestSignature, expiresAt: preview!.expiresAt, consent: true } : { action: "preview", selection };
      if (send) setConsent(false);
      const response = await vaultFetch("/api/nova/model", { method: "POST", signal: abort.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unlock the Vault and prepare the request again.");
      if (send) {
        setPreview(undefined); selected.current = null; setStatus(result.message);
        dispatch({ type: "RELOAD_CONNECTION", id: result.hypothesisId, message: result.message });
      } else {
        setPreview(result); selected.current = selection; setConsent(false);
        setStatus(result.configured ? "Preview ready. Nothing has been sent to the model." : "No OpenAI API key is configured. Nothing has been sent.");
      }
    } catch (error) {
      if (!abort.signal.aborted) setStatus(error instanceof Error ? error.message : "Request failed.");
      if (send) invalidate();
    } finally {
      controller.current = null;
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  return <section aria-label="Model interpretation">
    <h3>Ask for a richer interpretation</h3>
    <p>Select what leaves this device. The model can propose a new direction, never approve it. Saving alone sends nothing.</p>
    <label>Observation excerpt to send<textarea disabled={busy} maxLength={4000} value={observation} onChange={e => { setObservation(e.target.value); invalidate(); }} /></label>
    <p>You may shorten this to an exact excerpt. To rewrite the evidence, save a new observation first.</p>
    <label><input type="checkbox" disabled={busy} checked={includeOriginal} onChange={e => { setIncludeOriginal(e.target.checked); invalidate(); }} /> Include the original proposed interpretation</label>
    {reading && <label><input type="checkbox" disabled={busy} checked={!!editorial} onChange={e => { setEditorial(e.target.checked ? reading : ""); invalidate(); }} /> Include my saved CTM editorial reading</label>}
    <details><summary>Optional evidence context · {ids.length} selected</summary>
      <p>Only checked excerpts are included. Entire listening histories and playlists are never sent.</p>
      {evidence.filter(e => e.id !== record.id && (h.refs.some(r => r.id === e.id) || e.sourceType === "spotify-playlist-context")).map(e =>
        <label key={e.id}><input type="checkbox" disabled={busy || (!ids.includes(e.id) && ids.length >= 4)} checked={ids.includes(e.id)} onChange={() => { setIds(old => old.includes(e.id) ? old.filter(id => id !== e.id) : [...old, e.id]); invalidate(); }} /> {e.title}</label>)}
    </details>
    <button disabled={busy || !canPropose || !eligible || !observation.trim()} onClick={() => void request(false)}>Preview model request</button>
    {preview && <div>
      <p><b>Destination:</b> OpenAI API · <b>Model:</b> {preview.model}. Separately billed API request. Response storage is disabled in this request; provider retention policies still apply.</p>
      <h4>Text that will be sent</h4>
      {preview.items.map(item => <article key={item.source}><p><b>{item.kind}</b> · {item.source}</p><p style={{ whiteSpace: "pre-wrap" }}>{item.text}</p></article>)}
      <details><summary>Instructions given to the model</summary><p style={{ whiteSpace: "pre-wrap" }}>{preview.body.instructions}</p></details>
      <details><summary>Exact request body · technical details</summary><pre>{JSON.stringify(preview.body, null, 2)}</pre></details>
      <label><input type="checkbox" disabled={busy || !preview.configured} checked={consent} onChange={e => setConsent(e.target.checked)} /> Send only this preview to OpenAI once and save any grounded result as an unapproved proposal</label>
      <button disabled={busy || !canPropose || !consent || !preview.configured} onClick={() => void request(true)}>Send this preview & propose</button>
      <button disabled={busy} onClick={invalidate}>Discard preview</button>
    </div>}
    {busy && <button onClick={() => { controller.current?.abort(); setBusy(false); invalidate(); setStatus("Stopped waiting. If sending had started, the provider may already have received the preview. Check history before retrying."); }}>Cancel request</button>}
    <p role="status">{status}</p>
  </section>;
}
