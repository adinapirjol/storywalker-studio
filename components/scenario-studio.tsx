"use client";

import { FormEvent, useMemo, useState } from "react";
import { emptyConstellation, normaliseAtlasLaneSelections, sourceIdsForLaneSelections, toggleAtlasLaneSelection, type ScenarioConnection, type ScenarioConstellation, type ScenarioPathway } from "@/lib/scenario-studio";

type Atlas = { lanes: Array<{ id: string; title: string; evidenceCount: number; sourceRecordIds: string[]; matchedTerms: string[]; status: "evidence-window" | "working-thread"; note: string }>; caveat: string };
type EditableConstellation = Omit<ScenarioConstellation, "savedAt">;

function pathwayId() { return `pathway-${crypto.randomUUID()}`; }
function connectionId() { return `connection-${crypto.randomUUID()}`; }

export function ScenarioStudio() {
  const [atlas, setAtlas] = useState<Atlas>();
  const [constellation, setConstellation] = useState<EditableConstellation>(emptyConstellation());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Scenario Studio is private planning space. Start with several possibilities; it will not ask you to crown one as the answer.");

  const selectedEvidenceCount = constellation.atlasSourceRecordIds.length;
  const hasPathways = constellation.pathways.length > 0;
  const connectionPairs = useMemo(() => constellation.connections.filter((connection) => connection.pathwayIds.length >= 2), [constellation.connections]);

  async function open(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch("/api/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "scenario-studio" }) });
      const result = await response.json() as { error?: string; atlas?: Atlas; scenario?: ScenarioConstellation | null };
      if (!response.ok || result.error || !result.atlas) throw new Error(result.error ?? "Scenario Studio could not be opened.");
      setAtlas(result.atlas);
      if (result.scenario) { const saved = Object.fromEntries(Object.entries(result.scenario).filter(([key]) => key !== "savedAt")) as EditableConstellation; const evidenceLanes = result.atlas.lanes.filter((lane) => lane.status === "evidence-window"); const atlasLaneSelections = normaliseAtlasLaneSelections(evidenceLanes, saved.atlasSourceRecordIds, saved.atlasLaneSelections); setConstellation({ ...saved, atlasLaneSelections, atlasSourceRecordIds: sourceIdsForLaneSelections(atlasLaneSelections) }); setMessage("Opened your private constellation and its current Atlas evidence drawer. Nothing was changed."); }
      else setMessage("Opened a blank private constellation with current Atlas evidence. Add every possibility that matters; you do not need to choose a first route.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Scenario Studio could not be opened."); } finally { setBusy(false); }
  }

  function addPathway() { setConstellation((current) => ({ ...current, pathways: [...current.pathways, { id: pathwayId(), title: "", timing: "", currentCondition: "", connectedPathwayIds: [] }] })); }
  function updatePathway(id: string, field: "title" | "timing" | "currentCondition", value: string) { setConstellation((current) => ({ ...current, pathways: current.pathways.map((pathway) => pathway.id === id ? { ...pathway, [field]: value } : pathway) })); }
  function removePathway(id: string) { setConstellation((current) => ({ ...current, pathways: current.pathways.filter((pathway) => pathway.id !== id).map((pathway) => ({ ...pathway, connectedPathwayIds: pathway.connectedPathwayIds.filter((other) => other !== id) })), connections: current.connections.filter((connection) => !connection.pathwayIds.includes(id)) })); }
  function togglePathwayConnection(id: string, otherId: string) { setConstellation((current) => ({ ...current, pathways: current.pathways.map((pathway) => pathway.id !== id ? pathway : { ...pathway, connectedPathwayIds: pathway.connectedPathwayIds.includes(otherId) ? pathway.connectedPathwayIds.filter((item) => item !== otherId) : [...pathway.connectedPathwayIds, otherId] }) })); }
  function addConnection() { setConstellation((current) => ({ ...current, connections: [...current.connections, { id: connectionId(), pathwayIds: [], note: "Describe the overlap, dependency, question, or time relation." }] })); }
  function updateConnection(id: string, update: Partial<ScenarioConnection>) { setConstellation((current) => ({ ...current, connections: current.connections.map((connection) => connection.id === id ? { ...connection, ...update } : connection) })); }
  function removeConnection(id: string) { setConstellation((current) => ({ ...current, connections: current.connections.filter((connection) => connection.id !== id) })); }
  function toggleEvidence(lane: Atlas["lanes"][number]) { setConstellation((current) => ({ ...current, ...toggleAtlasLaneSelection(normaliseAtlasLaneSelections(atlas?.lanes.filter((item) => item.status === "evidence-window") ?? [], current.atlasSourceRecordIds, current.atlasLaneSelections), lane) })); }

  async function save() {
    if (constellation.pathways.length < 2) { setMessage("Keep at least two possibilities in the constellation before saving it. A single route belongs in a different planning tool."); return; }
    if (constellation.pathways.some((pathway) => !pathway.title.trim() || !pathway.timing.trim() || !pathway.currentCondition.trim())) { setMessage("Give each possibility a name, a time signal, and its current condition before saving. These can remain uncertain."); return; }
    setBusy(true);
    try {
      const evidenceLanes = atlas?.lanes.filter((lane) => lane.status === "evidence-window") ?? [];
      const atlasLaneSelections = normaliseAtlasLaneSelections(evidenceLanes, constellation.atlasSourceRecordIds, constellation.atlasLaneSelections);
      const scenario = { ...constellation, atlasLaneSelections, atlasSourceRecordIds: sourceIdsForLaneSelections(atlasLaneSelections) };
      const response = await fetch("/api/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save-scenario-studio", scenario }) });
      const result = await response.json() as { error?: string; scenario?: ScenarioConstellation };
      if (!response.ok || result.error || !result.scenario) throw new Error(result.error ?? "The constellation could not be saved.");
      setConstellation(scenario);
      setMessage(`Saved ${result.scenario.pathways.length} possible routes and ${result.scenario.connections.length} explicit connections as a private, revisable constellation. No route was ranked or promoted.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "The constellation could not be saved."); } finally { setBusy(false); }
  }

  return <main className="research-main private-review-main scenario-main">
    <section className="experiment-hero"><p className="eyebrow"><span /> Scenario Studio · private beta</p><h1>Keep the routes entangled until time makes a difference.</h1><p>This is a constellation of possible routes, not a funnel. Name the paths that matter, mark dates and conditions, then make explicit the overlaps that are useful to you.</p></section>
    <p className="live-notice" role="status">{message}</p>
    <section className="notebook-card vault-card"><p className="section-kicker">Open the private constellation</p><form onSubmit={open} className="vault-form"><button className="primary-button" disabled={busy}>{busy ? "Opening Scenario Studio…" : "Open Scenario Studio"}</button></form><p className="small-note">Uses the active browser-wide Vault session. Unlock once at <a href="/vault">Vault</a>; it expires exactly 15 minutes after unlock. Opening refreshes the local Atlas drawer. It does not save a scenario, create a Moment, Journey, Episode, or public draft.</p></section>
    {atlas ? <>
      <section className="scenario-shell"><div className="scenario-heading"><div><p className="section-kicker">Author-owned planning constellation</p><h2>{constellation.title}</h2><p>{constellation.framing}</p></div><div className="scenario-metrics"><span><b>{constellation.pathways.length}</b> possibilities</span><span><b>{connectionPairs.length}</b> explicit overlaps</span><span><b>{selectedEvidenceCount}</b> Atlas sources</span></div></div>
        <section className="notebook-card scenario-frame"><p className="section-kicker">Constellation frame</p><label>Title<input value={constellation.title} maxLength={160} onChange={(event) => setConstellation((current) => ({ ...current, title: event.target.value }))} /></label><label>How should this constellation be held?<textarea value={constellation.framing} maxLength={1_000} onChange={(event) => setConstellation((current) => ({ ...current, framing: event.target.value }))} /></label><p className="small-note">This is your planning frame, not a conclusion. Keep uncertainty, conditions and competing pulls visible.</p></section>
        <section className="scenario-layout"><div className="scenario-editor"><div className="scenario-section-title"><div><p className="section-kicker">Possible routes</p><h2>All may remain active.</h2></div><button type="button" className="outline-button" onClick={addPathway}>Add possibility</button></div>{hasPathways ? <div className="scenario-pathways">{constellation.pathways.map((pathway) => <PathwayCard key={pathway.id} pathway={pathway} allPathways={constellation.pathways} onUpdate={updatePathway} onRemove={removePathway} onToggleConnection={togglePathwayConnection} />)}</div> : <div className="scenario-empty"><p>No route is assumed. Add every possibility you want to hold at once, then give each a time signal and a current condition.</p><button type="button" className="primary-button" onClick={addPathway}>Add the first possibility</button></div>}</div>
          <aside className="scenario-drawer"><p className="section-kicker">Atlas-backed evidence drawer</p><h2>Choose only evidence you want beside the plan.</h2><p className="small-note">Each lane has its own stable selection. Removing one keeps every other linked lane intact, even where source records overlap.</p>{atlas.lanes.filter((lane) => lane.status === "evidence-window").map((lane) => { const selected = constellation.atlasLaneSelections ? Boolean(constellation.atlasLaneSelections[lane.id]?.length) : lane.sourceRecordIds.length > 0 && lane.sourceRecordIds.every((id) => constellation.atlasSourceRecordIds.includes(id)); return <article key={lane.id} className={`scenario-evidence ${selected ? "selected" : ""}`}><p><b>{lane.title}</b><br /><span>{lane.evidenceCount} linked source records · {lane.matchedTerms.join(" · ") || "explicit source lane"}</span></p><button type="button" className="outline-button" onClick={() => toggleEvidence(lane)} disabled={!lane.sourceRecordIds.length}>{selected ? "Remove lane" : "Link lane"}</button></article>; })}<a className="outline-button" href="/atlas">Inspect full Atlas</a><p className="small-note">{atlas.caveat}</p></aside></section>
        <section className="notebook-card scenario-connections"><div className="scenario-section-title"><div><p className="section-kicker">Explicit overlaps</p><h2>Connections, dependencies, and shared time.</h2></div><button type="button" className="outline-button" onClick={addConnection} disabled={constellation.pathways.length < 2}>Add explicit connection</button></div>{constellation.connections.length ? <div>{constellation.connections.map((connection) => <ConnectionCard key={connection.id} connection={connection} pathways={constellation.pathways} onUpdate={updateConnection} onRemove={removeConnection} />)}</div> : <p className="small-note">A connection can be a shared time window, a condition that unlocks another route, a space/time proximity, a mutual constraint, or an open question. It is never a claim that two things must mean the same thing.</p>}</section>
        <section className="scenario-save"><p>{constellation.boundary}</p><button type="button" className="primary-button" disabled={busy || constellation.pathways.length < 2} onClick={save}>{busy ? "Saving private constellation…" : "Save private constellation"}</button></section>
      </section>
    </> : null}
  </main>;
}

function PathwayCard({ pathway, allPathways, onUpdate, onRemove, onToggleConnection }: { pathway: ScenarioPathway; allPathways: ScenarioPathway[]; onUpdate: (id: string, field: "title" | "timing" | "currentCondition", value: string) => void; onRemove: (id: string) => void; onToggleConnection: (id: string, otherId: string) => void }) {
  return <article className="notebook-card scenario-pathway"><label>Possibility name<input value={pathway.title} maxLength={180} onChange={(event) => onUpdate(pathway.id, "title", event.target.value)} placeholder="Name this possibility" /></label><label>Time signal or horizon<input value={pathway.timing} maxLength={300} onChange={(event) => onUpdate(pathway.id, "timing", event.target.value)} placeholder="Date, time window, waiting condition, or unknown" /></label><label>Current condition<textarea value={pathway.currentCondition} maxLength={1_000} onChange={(event) => onUpdate(pathway.id, "currentCondition", event.target.value)} placeholder="What is known, pending, active, unavailable, or conditional?" /></label>{allPathways.length > 1 ? <fieldset><legend>Directly connected to</legend>{allPathways.filter((other) => other.id !== pathway.id).map((other) => <label key={other.id} className="scenario-check"><input type="checkbox" checked={pathway.connectedPathwayIds.includes(other.id)} onChange={() => onToggleConnection(pathway.id, other.id)} /> {other.title || "Untitled possibility"}</label>)}</fieldset> : null}<button type="button" className="scenario-remove" onClick={() => onRemove(pathway.id)}>Remove this possibility</button></article>;
}

function ConnectionCard({ connection, pathways, onUpdate, onRemove }: { connection: ScenarioConnection; pathways: ScenarioPathway[]; onUpdate: (id: string, update: Partial<ScenarioConnection>) => void; onRemove: (id: string) => void }) {
  return <article className="scenario-connection"><div>{pathways.map((pathway) => <label key={pathway.id} className="scenario-check"><input type="checkbox" checked={connection.pathwayIds.includes(pathway.id)} onChange={() => onUpdate(connection.id, { pathwayIds: connection.pathwayIds.includes(pathway.id) ? connection.pathwayIds.filter((id) => id !== pathway.id) : [...connection.pathwayIds, pathway.id] })} /> {pathway.title || "Untitled possibility"}</label>)}</div><label>What is the connection?<textarea value={connection.note} maxLength={1_000} onChange={(event) => onUpdate(connection.id, { note: event.target.value })} /></label><button type="button" className="scenario-remove" onClick={() => onRemove(connection.id)}>Remove connection</button></article>;
}
