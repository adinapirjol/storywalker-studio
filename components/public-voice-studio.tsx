"use client";

import { FormEvent, useState } from "react";

type SearchResult = { id: string; kind: string; score: number; matchedTerms: string[]; snippet: string };
type DraftFormat = "note" | "medium" | "substack" | "portfolio";
type PublicDraft = { id: string; capturedAt: string; payload: { title: string; body: string; format: DraftFormat; sourceRecordIds: string[]; publicationStatus: "draft" } };

async function request(payload: Record<string, unknown>) {
  const response = await fetch("/api/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json() as { error?: string; results?: SearchResult[]; drafts?: PublicDraft[] };
  if (!response.ok || result.error) throw new Error(result.error ?? "The Vault did not accept that request.");
  return result;
}

export function PublicVoiceStudio() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [format, setFormat] = useState<DraftFormat>("note");
  const [drafts, setDrafts] = useState<PublicDraft[]>([]);
  const [notice, setNotice] = useState("Public drafts stay in your encrypted Vault until you export or publish them yourself.");
  const [busy, setBusy] = useState(false);

  async function findEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try { const result = await request({ action: "search", query }); setResults(result.results ?? []); setSelected([]); setNotice(`${result.results?.length ?? 0} private record(s) found. Select only the evidence you want to promote into this draft.`); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Search could not run."); }
    finally { setBusy(false); }
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      await request({ action: "create-public-draft", publicDraft: { title, body, format, sourceRecordIds: selected } });
      setTitle(""); setBody(""); setSelected([]); setNotice("Draft saved as an author-approved public candidate. It has not been published anywhere.");
      await loadDrafts();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Draft could not be saved."); }
    finally { setBusy(false); }
  }

  async function loadDrafts() {
    try { const result = await request({ action: "list-public-drafts" }); setDrafts(result.drafts ?? []); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Drafts could not be opened."); }
  }

  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 8 ? [...current, id] : current); }
  function exportDraft(draft: PublicDraft) {
    const markdown = `# ${draft.payload.title}\n\n${draft.payload.body}\n\n<!-- Storywalker draft: ${draft.id}; evidence references retained privately -->\n`;
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" })); link.download = `${draft.payload.title.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/(^-|-$)/gu, "") || "storywalker-draft"}.md`; link.click(); URL.revokeObjectURL(link.href);
  }

  return <main className="research-main private-review-main voice-main">
    <section className="experiment-hero"><p className="eyebrow"><span /> Public voice studio</p><h1>Make something shareable without exposing the notebook behind it.</h1><p>A public draft is a deliberate promotion, not an automated reading of your private life. Its evidence references remain encrypted and local.</p></section>
    <p className="live-notice" role="status">{notice}</p>
    <section className="voice-split">
      <section className="notebook-card vault-card"><p className="section-kicker">01 · Select evidence</p><h2>Unlock once, then search privately</h2><form className="vault-form" onSubmit={findEvidence}><label>Search the private notebook<input value={query} minLength={3} onChange={(event) => setQuery(event.target.value)} placeholder="festival, job, place, project…" required /></label><button className="primary-button" type="submit" disabled={busy || query.trim().length < 3}>Find private evidence</button></form><p className="small-note">Uses the active browser-wide Vault session. Unlock once at <a href="/vault">Vault</a>; it expires exactly 15 minutes after unlock.</p>
        {results.length ? <ol className="voice-evidence">{results.map((result) => <li key={result.id}><label><input type="checkbox" checked={selected.includes(result.id)} onChange={() => toggle(result.id)} /> <span><b>{result.kind}</b><small>{result.id} · {result.matchedTerms.join(", ")}</small><em>{result.snippet}</em></span></label></li>)}</ol> : <p className="small-note">Nothing is visible here until you unlock the Vault and run a local search.</p>}
      </section>
      <section className="notebook-card vault-card"><p className="section-kicker">02 · Write a public candidate</p><h2>Your words, your decision</h2><form className="vault-form" onSubmit={saveDraft}><label>Working title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required placeholder="A story worth taking forward" /></label><label>Intended home<select value={format} onChange={(event) => setFormat(event.target.value as DraftFormat)}><option value="note">Private-to-public note</option><option value="medium">Medium draft</option><option value="substack">Substack draft</option><option value="portfolio">Portfolio idea</option></select></label><label>Draft<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={10_000} required placeholder="Write it yourself, or bring an edited draft here. Storywalker will retain the evidence references—not publish for you." /></label><p className="small-note">{selected.length}/8 evidence record(s) intentionally attached. This does not copy private source material into the export.</p><button className="primary-button" type="submit" disabled={busy || !title.trim() || !body.trim() || !selected.length}>Save public candidate</button></form></section>
    </section>
    <section className="notebook-card vault-card voice-draft-list"><div><p className="section-kicker">Your draft shelf</p><h2>Nothing is published automatically</h2></div><button type="button" className="outline-button" disabled={busy} onClick={loadDrafts}>Open local drafts</button>{drafts.length ? <ol>{drafts.map((draft) => <li key={draft.id}><div><b>{draft.payload.title}</b><small>{draft.payload.format} · {draft.payload.sourceRecordIds.length} selected evidence records · draft only</small></div><button className="outline-button" type="button" onClick={() => exportDraft(draft)}>Export Markdown</button></li>)}</ol> : <p className="small-note">Exports are local Markdown files; direct Medium or Substack publishing is deliberately not connected yet.</p>}</section>
  </main>;
}
