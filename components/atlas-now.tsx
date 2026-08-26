"use client";

import { FormEvent, useState } from "react";

type Atlas = {
  derivedAt: string;
  sourceRecordCount: number;
  imports: Array<{ id: string; source: string; importedAt: string; retained: number }>;
  lanes: Array<{ id: string; title: string; evidenceCount: number; sourceRecordIds: string[]; matchedTerms: string[]; status: "evidence-window" | "working-thread"; note: string }>;
  whatChanged: Array<{ id: string; title: string; detail: string; sourceRecordIds: string[] }>;
  convergences: Array<{ id: string; title: string; detail: string; evidenceLayers: string[]; sourceRecordIds: string[] }>;
  needsYou: Array<{ id: string; title: string; detail: string; sourceRecordIds: string[] }>;
  placeCoverage: { timelineWindows: number; windowsWithCandidates: number; directTimelineLabels: number };
  placeReadings: Array<{ id: string; when: string; kind: "visit" | "route"; resolution: "unresolved" | "one-candidate" | "competing-candidates"; caveat: string; candidates: Array<{ label: string; sourceRecordId: string; evidence: "timeline-label" | "nearby-saved-place" | "same-time-calendar" | "same-day-moment"; score: number; reason: string }> }>;
  caveat: string;
};

export function AtlasNow() {
  const [atlas, setAtlas] = useState<Atlas>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Atlas is a private, rebuildable orientation map. It groups explicit evidence; it does not decide what your life means.");
  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch("/api/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "atlas-now" }) });
      const result = await response.json() as { error?: string; atlas?: Atlas };
      if (!response.ok || result.error || !result.atlas) throw new Error(result.error ?? "Atlas could not be opened.");
      setAtlas(result.atlas); setMessage(`Atlas refreshed from ${result.atlas.sourceRecordCount} private records. It remains a map of available evidence, not a narrative or an Episode.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Atlas could not be opened."); } finally { setBusy(false); }
  }
  return <main className="research-main private-review-main">
    <section className="experiment-hero"><p className="eyebrow"><span /> Atlas of Now · private beta</p><h1>See the parallel work without forcing it into one story.</h1><p>Atlas refreshes after each local import or capture. It keeps source records, working Threads and explicit terms visible together, then leaves interpretation with you and NOVA.</p></section>
    <p className="live-notice" role="status">{message}</p>
    <section className="notebook-card vault-card"><p className="section-kicker">Open the encrypted map</p><form onSubmit={load} className="vault-form"><button className="primary-button" disabled={busy}>{busy ? "Refreshing Atlas…" : "Open Atlas of Now"}</button></form><p className="small-note">Uses the active browser-wide Vault session. Unlock once at <a href="/vault">Vault</a>; it expires exactly 15 minutes after unlock. A successful future import refreshes the encrypted Atlas and retrieval index automatically. It does not create a Moment, Journey, Episode or public draft.</p></section>
    {atlas ? <>
      <section className="notebook-card vault-card"><p className="section-kicker">Current coverage</p><h2>{atlas.sourceRecordCount} private source records in view</h2><p className="small-note">Last refreshed {new Date(atlas.derivedAt).toLocaleString()}. Imported sources: {atlas.imports.map((item) => `${item.source} (${item.retained})`).join(" · ") || "none yet"}.</p></section>
      <section className="atlas-grid" aria-label="Atlas orientation updates">
        <article className="notebook-card atlas-card"><p className="section-kicker">What changed</p><h2>Since the prior Atlas</h2>{atlas.whatChanged.length ? <ul>{atlas.whatChanged.map((item) => <li key={item.id}><b>{item.title}</b><br />{item.detail}</li>)}</ul> : <p className="small-note">No new or count-changed source import since the last Atlas refresh.</p>}</article>
        <article className="notebook-card atlas-card"><p className="section-kicker">What converges</p><h2>Explicit overlap, held lightly</h2>{atlas.convergences.length ? <ul>{atlas.convergences.map((item) => <li key={item.id}><b>{item.title}</b><br />{item.detail}<br /><span className="small-note">Layers: {item.evidenceLayers.join(" · ")}</span></li>)}</ul> : <p className="small-note">No cross-layer wording overlap is currently visible. That is not a verdict about whether anything belongs together.</p>}</article>
        <article className="notebook-card atlas-card"><p className="section-kicker">What needs you</p><h2>Only decisions you own</h2>{atlas.needsYou.length ? <ul>{atlas.needsYou.map((item) => <li key={item.id}><b>{item.title}</b><br />{item.detail}</li>)}</ul> : <p className="small-note">Nothing is asking for a decision right now. Bring a question when one becomes useful.</p>}</article>
      </section>
      <section className="atlas-grid" aria-label="Atlas evidence lanes">{atlas.lanes.map((lane) => <article className="notebook-card atlas-card" key={lane.id}><p className="section-kicker">{lane.status === "working-thread" ? "Working Thread" : "Evidence lane"}</p><h2>{lane.title}</h2><p><b>{lane.evidenceCount}</b> linked source record{lane.evidenceCount === 1 ? "" : "s"}</p>{lane.matchedTerms.length ? <p className="small-note">Explicit terms: {lane.matchedTerms.join(" · ")}</p> : null}<p className="small-note">{lane.note}</p>{lane.sourceRecordIds.length ? <details><summary>See source IDs</summary><ul>{lane.sourceRecordIds.map((id) => <li key={id}>{id}</li>)}</ul></details> : null}</article>)}</section>
      {atlas.placeCoverage.timelineWindows ? <section className="notebook-card vault-card"><p className="section-kicker">Timeline place readings · private, derived</p><h2>Make location evidence legible without turning it into a claim.</h2><p className="small-note">{atlas.placeCoverage.windowsWithCandidates} of {atlas.placeCoverage.timelineWindows} Timeline windows have an evidence-linked place candidate; {atlas.placeCoverage.directTimelineLabels} have a label directly supplied by Timeline. Ranked candidates can come from direct Timeline labels, nearby saved Maps places, same-time Calendar events, or same-day Storywalker Moments. They are not confirmed venues, cities, countries, visits, or facts.</p>{atlas.placeReadings.length ? <div className="atlas-grid">{atlas.placeReadings.map((reading) => <article className="notebook-card atlas-card" key={reading.id}><p className="section-kicker">{reading.kind} · {reading.resolution === "competing-candidates" ? "competing readings" : "one source-linked reading"}</p><h2>{new Date(reading.when).toLocaleString()}</h2><ol>{reading.candidates.map((candidate) => <li key={`${candidate.sourceRecordId}:${candidate.label}`}><b>{candidate.label}</b><br /><span className="small-note">{candidate.reason} Source: {candidate.sourceRecordId}</span></li>)}</ol><p className="small-note">{reading.caveat}</p></article>)}</div> : <p className="small-note">Timeline windows are present, but none currently overlap a retained location label. That is a gap in labels, not evidence of nowhere.</p>}</section> : null}
      <section className="notebook-card vault-card"><p className="section-kicker">Boundary</p><p>{atlas.caveat}</p><div className="experiment-actions"><a className="outline-button" href="/scenario-studio">Take several lanes to Scenario Studio</a><a className="outline-button" href="/director">Take one evidence lane to NOVA Director</a></div></section>
    </> : null}
  </main>;
}
