"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { applyLinzDecision, getLinzProposals, LINZ_PUBLIC_RECORDS, locativeManifest, type LinzDecision } from "@/lib/linz-experiment";
import type { LinzProposal } from "@/lib/linz-experiment";

const initial = getLinzProposals();

function saveManifest(records: LinzProposal[]) {
  const content = JSON.stringify(locativeManifest(records), null, 2);
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "locative-echo.public-synthetic.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function LinzEchoExperiment() {
  const [records, setRecords] = useState(initial);
  const [selectedId, setSelectedId] = useState(initial[0].id);
  const [revision, setRevision] = useState("");
  const selected = useMemo(() => records.find((record) => record.id === selectedId)!, [records, selectedId]);
  const festival = LINZ_PUBLIC_RECORDS.find((record) => record.id === selected.eventId)!;
  const city = LINZ_PUBLIC_RECORDS.find((record) => record.id === selected.cityFragmentId)!;

  function decide(decision: LinzDecision) {
    setRecords((current) => current.map((record) => record.id === selected.id ? applyLinzDecision(record, decision, revision) : record));
    if (decision === "revised") setRevision("");
  }

  return <main className="research-main">
    <header className="site-header"><Link className="wordmark" href="/research"><span className="wordmark-mark">S</span><span>Storywalker <i>Research Lab</i></span></Link><Link className="quiet-button" href="/">Studio</Link></header>
    <section className="experiment-hero"><p className="eyebrow"><span /> Storywalker Prototype 1 · Linz adapter</p><h1>Public City, Private Echoes</h1><p>A city can record what happened where. Platforms can record traces. This deterministic experiment proposes a relationship, then leaves its meaning open to the Author.</p><p className="small-note">Working demo combines public programme records with three versioned City of Linz fragments. Private cards are clearly marked synthetic until Author-selected local traces are loaded. No live GPS or AI service is required.</p></section>
    <section className="linz-workflow" aria-label="Locative interaction sequence"><span>Public place</span><i>→</i><span>Private trace</span><i>→</i><span>Proposed meaning</span><i>→</i><span>Human negotiation</span><i>→</i><span>Locative echo</span></section>
    <section className="linz-picker" aria-label="Simulated Linz locations">{records.map((record) => <button key={record.id} type="button" aria-pressed={selectedId === record.id} onClick={() => { setSelectedId(record.id); setRevision(""); }}><b>{record.location}</b><small>{record.ledger.authorDecision}</small></button>)}</section>
    <section className="linz-layout">
      <article className={`notebook-card linz-proposal state-${selected.ledger.authorDecision}`}>
        <p className="section-kicker">Simulated location · {selected.location} · precision: {selected.ledger.location.precision}</p>
        <h2>{festival.title}</h2>
        <div className="source-fragment"><b>Recorded · Festival event</b><p>{festival.fragment} Source: {festival.sourceLabel} ({festival.sourceId}).</p></div>
        <div className="source-fragment"><b>Recorded · City fragment</b><p>{city.fragment} Source: {city.sourceLabel} ({city.sourceId}).</p></div>
        <div className="source-fragment private-fragment"><b>Private trace · synthetic demo only</b><p>{selected.privateTrace.note} Track: {selected.privateTrace.song}. Local private traces are deliberately absent from this public bundle.</p></div>
        <div className="inference"><b>Inferred · proposal</b><p>{selected.proposal}</p></div>
        <p className="decision-label">Current state: {selected.ledger.authorDecision} · relationship: {selected.ledger.relationship} · certainty: {selected.ledger.certainty}</p>
        {selected.ledger.authorDecision === "refused" ? <p className="refusal-output">These records overlap, but the proposed story is not mine.</p> : null}
      </article>
      <aside className="notebook-card linz-controls">
        <h2>Author negotiation</h2>
        <p>Accept makes this wording authored. Revise replaces only the wording and preserves its ledger. Refuse keeps the correlation visible as a rejected interpretation.</p>
        <label htmlFor="linz-revision">Revision</label><textarea id="linz-revision" value={revision} onChange={(event) => setRevision(event.target.value)} placeholder="Write a different relationship, or leave this blank." />
        <div className="experiment-actions"><button type="button" onClick={() => decide("accepted")}>Accept</button><button type="button" onClick={() => decide("revised")}>Revise</button><button type="button" onClick={() => decide("refused")}>Refuse</button></div>
        <button type="button" className="outline-button manifest-button" onClick={() => saveManifest(records)}>Export safe locative manifest</button>
        <p className="small-note">Export contains no private trace, coordinates or audio. Spotify metadata/URIs remain local-only; no copyrighted audio is redistributed.</p>
      </aside>
    </section>
    <section className="linz-ledger notebook-card"><p className="section-kicker">Evidence ledger · visible before decision</p><h2>{selected.location}</h2><dl><div><dt>Source records</dt><dd>{selected.ledger.sourceRecords.map((source) => `${source.source} (${source.id})`).join(" · ")}</dd></div><div><dt>Time / zone</dt><dd>{selected.ledger.timestamps.map((time) => `${time.value} (${time.timezone}; ${time.certainty})`).join(" · ")}</dd></div><div><dt>Location / precision</dt><dd>{selected.ledger.location.label} / {selected.ledger.location.precision}</dd></div><div><dt>Missing information</dt><dd>{selected.ledger.missingInformation.join(" · ")}</dd></div><div><dt>Transformation history</dt><dd>{selected.ledger.transformationHistory.join(" → ")}</dd></div><div><dt>Current Author decision</dt><dd>{selected.ledger.authorDecision}</dd></div></dl></section>
    <aside className="safety-note"><b>Interaction contract:</b> simulation is the default. Live location remains opt-in in the separate Locative Echo Lab, has no background tracking or analytics, shows precision, and can be paused or reset. This demonstration makes no claim of immersive experience: the participant reads source fragments, hears no copyrighted audio, selects a location, and controls acceptance, revision or refusal.</aside>
    <footer><span>Recorded ≠ inferred ≠ authored ≠ refused</span><span>Private traces are local-only; this public demo contains synthetic stand-ins</span></footer>
  </main>;
}
