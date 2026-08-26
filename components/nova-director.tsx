"use client";

import { FormEvent, useState } from "react";

type DirectorEvidence = { id: string; title: string; kind: string; authority: string; matchedTerms: string[]; excerpts: Array<{ text: string; authority: string }> };
type DirectorPreview = { query: string; observations: string[]; evidence: DirectorEvidence[]; readings: Array<{ title: string; reading: string; sourceIds: string[]; caveat: string }>; questions: string[]; sourceIds: string[]; boundary: string };
type DirectorModelProposal = { text: string; sourceIds: string[]; externalModelCalled: true; canonical: false; saved: false };

export function NovaDirector() {
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<DirectorPreview>();
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [threadTitle, setThreadTitle] = useState("");
  const [threadMessage, setThreadMessage] = useState<string>();
  const [modelConsent, setModelConsent] = useState(false);
  const [modelProposal, setModelProposal] = useState<DirectorModelProposal>();
  const [modelError, setModelError] = useState<string>();
  const [message, setMessage] = useState("NOVA Director works from an evidence packet you choose. Unlock once in Vault to use the browser-wide 15-minute private session.");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch("/api/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "director-preview", query }) });
      const result = await response.json() as { error?: string; director?: DirectorPreview };
      if (!response.ok || result.error || !result.director) throw new Error(result.error ?? "NOVA Director could not prepare a reading.");
      setPreview(result.director);
      setSelectedSourceIds(result.director.evidence.filter((item) => item.authority === "author-stated" || item.authority === "source-recorded").map((item) => item.id).slice(0, 6));
      setThreadTitle(result.director.query.toLocaleLowerCase().includes("festival") && result.director.query.toLocaleLowerCase().includes("creative") ? "From festival infrastructure to participatory creative technology" : `Working thread: ${result.director.query}`);
      setThreadMessage(undefined);
      setModelConsent(false); setModelProposal(undefined); setModelError(undefined);
      setMessage("NOVA prepared a local evidence window. Nothing was written to the Vault or sent to a model.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "NOVA Director could not prepare a reading."); } finally { setBusy(false); }
  }

  async function rebuildIndex() {
    setBusy(true);
    try {
      const response = await fetch("/api/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rebuild-retrieval-index" }) });
      const result = await response.json() as { error?: string; retrievalIndex?: { indexedRecords: number; uniqueTerms: number } };
      if (!response.ok || result.error || !result.retrievalIndex) throw new Error(result.error ?? "The local retrieval index could not be rebuilt.");
      setMessage(`Rebuilt the encrypted local retrieval index over ${result.retrievalIndex.indexedRecords} records and ${result.retrievalIndex.uniqueTerms} terms. No external embedding or model was used.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "The local retrieval index could not be rebuilt."); } finally { setBusy(false); }
  }

  async function askModel() {
    if (!preview || !modelConsent || !selectedSourceIds.length) return;
    setBusy(true);
    try {
      const response = await fetch("/api/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "director-model-proposal", query, directorSelection: { sourceIds: selectedSourceIds, consent: true } }) });
      const result = await response.json() as { error?: string; proposal?: DirectorModelProposal };
      if (!response.ok || result.error || !result.proposal) throw new Error(result.error ?? "The Director model could not prepare a proposal.");
      setModelProposal(result.proposal);
      setModelError(undefined);
      setMessage("NOVA returned a model-assisted proposal from only the checked excerpts. It was not saved, promoted, or made canonical.");
    } catch (error) { const nextError = error instanceof Error ? error.message : "The Director model could not prepare a proposal."; setModelError(nextError); setMessage(nextError); } finally { setBusy(false); }
  }

  async function saveWorkingThread() {
    if (!preview || !selectedSourceIds.length || !threadTitle.trim()) return;
    setBusy(true);
    try {
      const response = await fetch("/api/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create-director-thread", directorThread: { title: threadTitle, query: preview.query, sourceRecordIds: selectedSourceIds, localReadings: preview.readings.map((reading) => ({ title: reading.title, reading: reading.reading, caveat: reading.caveat })), tests: preview.questions, consent: true } }) });
      const result = await response.json() as { error?: string; thread?: { id: string; title: string } };
      if (!response.ok || result.error || !result.thread) throw new Error(result.error ?? "NOVA could not save the working Thread.");
      setThreadMessage(`Saved “${result.thread.title}” as a private, pending working Thread. No Episode or public draft was created.`);
    } catch (error) { setThreadMessage(error instanceof Error ? error.message : "NOVA could not save the working Thread."); } finally { setBusy(false); }
  }

  function toggleSource(id: string) {
    setSelectedSourceIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length >= 8 ? current : [...current, id]);
  }

  return <main className="research-main private-review-main">
    <section className="experiment-hero"><p className="eyebrow"><span /> NOVA Director · evidence first</p><h1>Hold the evidence, then ask what it might mean.</h1><p>NOVA shows the material it found before offering any reading. For the default Director path, this page stages the evidence locally and the active ChatGPT/Codex task reads that prepared window only when you ask it to.</p></section>
    <p className="live-notice" role="status">{message}</p>
    <section className="notebook-card vault-card"><p className="section-kicker">Choose a private window</p><form onSubmit={submit} className="vault-form"><label>What should NOVA trace?<input minLength={3} required value={query} onChange={(event) => setQuery(event.target.value)} placeholder="a programme, a place, creative technology…" /></label><div className="experiment-actions"><button type="submit" className="primary-button" disabled={busy || query.trim().length < 3}>{busy ? "Preparing evidence…" : "Prepare evidence window"}</button><button type="button" className="outline-button" disabled={busy} onClick={rebuildIndex}>Rebuild local retrieval index</button></div></form><p className="small-note">Uses the active browser-wide Vault session. Unlock once at <a href="/vault">Vault</a>; it expires exactly 15 minutes after unlock. The index is encrypted, rebuildable keyword/time retrieval—not yet an embedding or vector store. A semantic adapter must be separately consented.</p></section>
    {preview ? <section className="notebook-card vault-card"><p className="section-kicker">Private proposal · not canon</p><h2>“{preview.query}”</h2><h3>Evidence window</h3><p className="small-note">Select no more than eight records for a possible model reading. Unchecked records stay local.</p>{preview.evidence.map((item) => <article key={item.id} className="nova-reading"><label><input type="checkbox" checked={selectedSourceIds.includes(item.id)} onChange={() => toggleSource(item.id)} /> <b>{item.title}</b></label><p className="small-note">{item.authority} · matched {item.matchedTerms.join(", ") || "context"} · {item.id}</p>{item.excerpts.length ? item.excerpts.map((excerpt) => <p key={`${item.id}-${excerpt.text}`}><span className="knowledge-tag">{excerpt.authority}</span> {excerpt.text}</p>) : <p className="small-note">No explicit claim excerpt is available for this record; it is context only.</p>}</article>)}<section className="nova-reading"><p className="section-kicker">NOVA in this ChatGPT task · default</p><p>Keep the useful records checked, then tell NOVA in this conversation: <b>“direct the current window.”</b> The active Codex task will read this prepared browser window and return a cited, revisable proposal here. It does not make an API request or write to your Vault.</p><label>Working Thread title<input value={threadTitle} onChange={(event) => setThreadTitle(event.target.value)} maxLength={180} /></label><button type="button" className="primary-button" disabled={busy || !threadTitle.trim() || !selectedSourceIds.length} onClick={saveWorkingThread}>{busy ? "Saving working Thread…" : "Create private working Thread"}</button>{threadMessage ? <p className="live-notice" role="status">{threadMessage}</p> : null}<p className="small-note">This saves the checked sources, the local reading, counter-reading, and open tests as private pending material. It does not create an Episode or public draft.</p></section><h3>Local reading</h3>{preview.readings.map((reading) => <article key={reading.title} className="nova-reading"><h4>{reading.title}</h4><p>{reading.reading}</p><p className="small-note"><b>Caveat:</b> {reading.caveat}</p><p className="small-note"><b>Sources:</b> {reading.sourceIds.join(" · ") || "none"}</p></article>)}<h3>Questions for the Author</h3><ol>{preview.questions.map((question) => <li key={question}>{question}</li>)}</ol><details className="nova-reading"><summary>Advanced: separate API model</summary><p className="small-note">This path uses a separately billed API key. It is optional and not needed to work with NOVA in this ChatGPT task.</p><label><input type="checkbox" checked={modelConsent} onChange={(event) => setModelConsent(event.target.checked)} /> I consent to send only the {selectedSourceIds.length} checked excerpt{selectedSourceIds.length === 1 ? "" : "s"} to the configured NOVA Director model for one unsaved proposal.</label><button type="button" className="outline-button" disabled={busy || !modelConsent || !selectedSourceIds.length} onClick={askModel}>{busy ? "Preparing proposal…" : "Ask separate API model"}</button>{modelError ? <p className="live-notice" role="alert">{modelError}</p> : null}<p className="small-note">This sends nothing until you check the consent box and press the button. It uses a stateless request and does not create a Vault record.</p></details>{modelProposal ? <article className="nova-reading"><h3>Model-assisted proposal · not canon</h3><p>{modelProposal.text}</p><p className="small-note">Sources sent: {modelProposal.sourceIds.join(" · ")}. This remains unsaved.</p></article> : null}<p className="small-note">{preview.boundary}</p></section> : null}
  </main>;
}
