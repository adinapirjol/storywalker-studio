"use client";
import { useState } from "react";
import { XREvidenceReport } from "./xr-evidence-report";
import { XREpisodeExperience } from "./xr-episode-experience";
import { XRJourneyMap } from "./xr-journey-map";
import { journeyAtTime } from "@/lib/journey-basemap";
import { episodeIdentifiers } from "@/lib/journey-identifiers";
import { moveJourneyEpisode } from "@/lib/journey-grounding";
import type { XRScene, Decision } from "@/lib/xr-scene";
import styles from "./xr-lab.module.css";

export function XRJourneyRoom({ scene, decisions, onChange, activated }: { activated: boolean; scene: XRScene; decisions: Record<string, Decision>; onChange: (scene: XRScene) => void }) {
  const [selected, setSelected] = useState(0), [x, setX] = useState(""), [z, setZ] = useState(""), [message, setMessage] = useState("");
  const [calibration, setCalibration] = useState(false), [evidenceOpen, setEvidenceOpen] = useState(false);
  const [asOf, setAsOf] = useState<number | null>(null);
  const episodes = scene.journeyEpisodes ?? [], layout = scene.journeyLayout;
  if (!layout || !episodes.length) return null;
  const index = Math.min(selected, episodes.length - 1), current = episodes[index];
  const point = (episode: typeof current) => layout.mode === "MEMORY" ? episode.memoryPosition! : episode.worldPosition!.position;
  const position = point(current), profile = current.listening;
  const identifiers = episodeIdentifiers(current);
  const selectedPlays = (episode: typeof current) => episode.listening?.selectedCues.filter(item => decisions[item.cueId] === "accepted").reduce((sum, item) => sum + item.count, 0) ?? 0;
  function choose(index: number, preserveTime = false) { setSelected(index); setX(""); setZ(""); setMessage(""); if (!preserveTime) setAsOf(null); }
  function move(reset = false) {
    const target = reset ? current.worldPosition!.position : { x: x === "" ? position.x : Number(x), z: z === "" ? position.z : Number(z) };
    if (![target.x, target.z].every(value => Number.isFinite(value) && Math.abs(value) <= 20)) { setMessage("Choose coordinates between −20 and 20."); return; }
    onChange(moveJourneyEpisode(scene, current.id, target.x, target.z));
    setX(""); setZ(""); setMessage("Author move recorded. Accepted selections are unchanged; activation is off. Save review to Vault to keep this move.");
  }
  return <div className={styles.journey}>
    <XREpisodeExperience scene={scene} decisions={decisions} activated={activated} onChange={onChange} onInspect={i=>{choose(i);setEvidenceOpen(true);requestAnimationFrame(()=>{const desk=document.getElementById("xr-source-desk");desk?.scrollIntoView({block:"start"});desk?.focus();});}} onCalibrate={()=>setCalibration(v=>!v)} />
    {calibration && scene.experience?.regime === "WORLD" && <div><div className={styles.actions}><h3>Temporary geographic calibration</h3><button onClick={()=>setCalibration(false)}>Close calibration map</button></div>
    <XRJourneyMap episodes={episodes} mode="WORLD" layout={{...layout,mode:"WORLD"}} asOf={asOf} selected={index} counts={episodes.map(selectedPlays)} onSelect={index => choose(index, true)}
      onTimeChange={at => { setAsOf(at); if (at !== null) { const latest = journeyAtTime(episodes, at).latest; if (latest >= 0) choose(latest, true); } }}
      onMove={(episodeIndex, target) => {
        onChange(moveJourneyEpisode(scene, episodes[episodeIndex].id, target.x, target.z));
        setX(""); setZ(""); setMessage("Author move recorded. Accepted selections are unchanged; activation is off. Save review to Vault to keep this move.");
      }} />
    </div>}
    <XREvidenceReport scene={scene} onChange={onChange} />
    <details id="xr-source-desk" tabIndex={-1} open={evidenceOpen} onToggle={event=>setEvidenceOpen(event.currentTarget.open)}><summary>Source desk · inspect contained Timeline windows, listening and provenance</summary>
    <p>Green: Timeline evidence · Purple: Author-confirmed geography · Amber fields: accepted musical selections observed in this episode. Field intensity counts selection matches, which can overlap across artist, track and album. Close or repeated places overlap rather than being artificially spread out.</p>
    <div className={styles.actions}><button disabled={index === 0} onClick={() => choose(index - 1)}>Previous episode</button><button disabled={index === episodes.length - 1} onClick={() => choose(index + 1)}>Next episode</button></div>
    <label>Chronological episode <select value={index} onChange={event => choose(Number(event.target.value))}>{episodes.map((episode, i) => <option key={episode.id} value={i}>{i + 1} · {episodeIdentifiers(episode).option}</option>)}</select></label>
    <h3>{index + 1}. {identifiers.title}{current.episodeKind === "transit" ? " · transit only" : ""}</h3>
    {current.reconstructedTiming && <p><b>{current.reconstructedTiming.precision === "approximate" ? "APPROXIMATE / NEEDS PRIMARY-EVIDENCE CHECK" : "Author date reconstruction"}</b> · {current.reconstructedTiming.note} The interval bounds are date envelopes, not measured arrival/departure times. Boundary-day listening remains ambiguous.</p>}
    {current.geographicReference && <p>Map position: {current.geographicReference.label} · {current.geographicReference.precision}. Reference: {current.geographicReference.source}. This is a reference point for the named place, not a measured personal position.</p>}
    {scene.notionContext && <details><summary>Notion context · {scene.notionContext.records.length} source pages</summary>
      <p>Dates come from the pages’ Date properties. A whole-day date can overlap several stops; those matches remain for your review. Page locations are contextual labels, never physical coordinates. Summaries are Editor-written descriptions of the fetched pages.</p>
      {scene.notionContext.records.map(item => <article key={item.evidence.pageId}>
        <h4>{item.evidence.title}</h4><p>{item.evidence.date} · {item.source.databaseLabel} · {item.status === "ATTACHED" ? "One matching episode — context attached" : item.status === "HUMAN_REVIEW" ? "Several possible stops or changed content — Author review needed" : "No recorded episode overlaps this date"}</p>
        <p>{item.evidence.contentSummary}</p>{item.evidence.locationLabel && <p>Page location label: {item.evidence.locationLabel} (context only).</p>}
        <div className={styles.actions}>{item.episodeIds.map(id => { const i = episodes.findIndex(episode => episode.id === id); return <button key={id} onClick={() => choose(i)}>Inspect stop {i + 1}</button>; })}</div>
        <details><summary>Source provenance</summary><p>Page ID: {item.evidence.pageId} · Database: {item.evidence.sourceDatabase}</p><p>{item.source.dateBasis} · Page last edited: {item.source.lastEditedAt} · Retrieved: {scene.notionContext!.retrievedAt}</p><p>Notion verification: {item.source.verification} · Selected evidence fingerprint: {item.source.fingerprint}</p></details>
      </article>)}
    </details>}
    <div className={styles.stopMarkers} aria-label="Three stop identifiers">
      <section><h4>01 · PLACE</h4><p>{identifiers.place.text}</p><small>{identifiers.place.certainty} · {identifiers.stableId}</small><details><summary>Place source</summary>{identifiers.place.sourceId}</details></section>
      <section><h4>02 · TIME</h4><p>{identifiers.time.text}</p><small>{identifiers.time.timeZone} · {current.reconstructedTiming ? "Author date envelope" : "recorded window"}</small><details><summary>Time source</summary>{identifiers.time.sourceId}<p>{current.start} → {current.end}</p></details></section>
      <section><h4>03 · CONTEXT</h4><p><b>Listening:</b> {identifiers.context.music}</p>{identifiers.context.track && <p><b>Track:</b> {identifiers.context.track}</p>}<details><summary>Listening source</summary>{identifiers.context.musicSourceId ?? "No source"}<p>Timestamp overlap only; no meaning inferred. Top track uses count then exact text to break ties.</p></details>
      <p><b>Calendar:</b> {identifiers.context.calendar.length ? `${identifiers.context.calendar.length} contextual matches` : "No matching entries in the attached Calendar evidence"}</p>
      {identifiers.context.calendar.map(item => <details key={item.sourceId}><summary>{item.title} · {item.match === "timestamp-overlap" ? "time overlap" : "same day only"}</summary><p>{item.startsWhen}{item.endsWhen ? ` → ${item.endsWhen}` : ""}</p>{item.locationLabel && <p>Calendar location label: {item.locationLabel} (context only)</p>}<small>{item.sourceId} · source snapshot {item.sourceFingerprint.slice(0, 12)}</small></details>)}<small>Calendar entries do not establish attendance or physical presence.</small></section>
    </div>
    <p>WORLD: {current.worldPosition!.position.x.toFixed(2)}, {current.worldPosition!.position.z.toFixed(2)} · MEMORY: {current.memoryPosition!.x.toFixed(2)}, {current.memoryPosition!.z.toFixed(2)} · Displacement: {Math.hypot(current.memoryPosition!.x - current.worldPosition!.position.x, current.memoryPosition!.z - current.worldPosition!.position.z).toFixed(2)} room units.</p>
    {layout.mode === "MEMORY" && <div className={styles.actions}><label>Memory X <input type="number" min={-20} max={20} step="0.1" value={x} placeholder={position.x.toFixed(2)} onChange={event => setX(event.target.value)} /></label><label>Memory Z <input type="number" min={-20} max={20} step="0.1" value={z} placeholder={position.z.toFixed(2)} onChange={event => setZ(event.target.value)} /></label><button onClick={() => move()}>Record Author move</button><button onClick={() => move(true)}>Return to WORLD position</button></div>}
    <p role="status">{message}</p>
    {profile && <><h3>Listening in this recorded window · {profile.count} plays</h3><p>Dominant artist: {profile.dominantArtist ?? "Threshold not met"}. Recurrent artists (≥2 plays): {profile.recurrentArtists.join(" · ") || "None"}.</p>
      {(["artists", "tracks", "albums"] as const).map(kind => <details key={kind}><summary>{kind} · {profile[kind].length} observed</summary><ol>{profile[kind].map(item => <li key={item.key}>{item.label} · {item.count} plays · {(item.share * 100).toFixed(1)}% here / {(item.baselineShare * 100).toFixed(1)}% full baseline · {item.lift.toFixed(1)}× concentration</li>)}</ol></details>)}
      <p>First observed in baseline: {profile.arrivals.join(" · ") || "None"}.</p><p>Last observed before ≥14 days of absence in available records: {profile.disappearances.join(" · ") || "None"}.</p>
      <p>Bursts: {profile.bursts.map(item => `${item.day}: ${item.count} plays (threshold ${item.baselineThreshold})`).join(" · ") || "None"}.</p>
      <p>Unusual concentration: {profile.concentrations.map(item => `${item.label} (${item.kind}, ${item.lift.toFixed(1)}× baseline)`).join(" · ") || "Threshold not met"}.</p>
      <p>Existing musical selections observed here: {profile.selectedCues.map(item => `${scene.cues.find(cue => cue.id === item.cueId)?.title} (${item.count}; ${decisions[item.cueId] ?? "pending"})`).join(" · ") || "None"}.</p></>}
    <details><summary>Episode provenance and Author moves</summary><pre className={styles.evidenceText}>{JSON.stringify({ provenance: current.provenance, notionEvidence: current.notionEvidence, calendarEvidence: current.calendarEvidence, context: current.context, memoryDecisions: current.memoryDecisions }, null, 2)}</pre></details>
    <details><summary>Coverage and deterministic method</summary><p>{layout.coverage.visits} Timeline stops; {layout.coverage.matchedPlays} uniquely matched / {layout.coverage.baselinePlays} baseline plays. {layout.coverage.ambiguousPlays} ambiguous; {layout.coverage.unmatchedPlays} unassigned. Routes excluded: {layout.coverage.excludedRoutes}; invalid visits: {layout.coverage.invalidVisits}; duplicate visits/plays removed: {layout.coverage.duplicateVisits}/{layout.coverage.duplicatePlays}.</p><p>Timeline stop coverage: {layout.coverage.timelineStart} → {layout.coverage.timelineEnd}. {episodes.some(episode => episode.reconstructedTiming) ? "Later stops use the separate Author reconstruction. Date envelopes and unresolved return boundaries remain explicit." : "The 27 August–28 September itinerary is still awaiting Author input."} Gaps within existing coverage remain unknown.</p><p>Projection: {layout.projection.method}; origin {layout.projection.originLatitude.toFixed(4)}°, {layout.projection.originLongitude.toFixed(4)}°; {layout.projection.metresPerUnit.toFixed(2)} geographic metres per room unit. No chronology-based axis or position jitter.</p><ul>{layout.rules.map(rule => <li key={rule}>{rule}</li>)}</ul></details>
    </details>
    <p>Episode spaces are a revisable representation. Source windows, geography, listening and acceptance remain independent. Save review to Vault to keep Author moves and fragment placements.</p>
  </div>;
}
