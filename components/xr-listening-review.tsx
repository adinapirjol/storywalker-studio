import type { ListeningAnalysis } from "@/lib/xr-listening";
export function XRListeningReview({ analysis }: { analysis: ListeningAnalysis }) {
  const a = analysis;
  return <section aria-label="Last.fm deterministic evidence review">
    <h2>Listening evidence, before selection</h2>
    <p>{a.from} → {a.to} · {a.timeZone} · {a.total} available scrobbles · {a.duplicatesRemoved} duplicate rows removed.</p>
    <p>Observed first: {a.first ?? "none"}. Observed last: {a.last ?? "none"}. Source imported: {a.importedAt}.</p>
    <p><strong>Coverage:</strong> {a.coverage}</p>
    {!!a.completedDeltaReads?.length && <details open><summary>Verified delta reads</summary><ul>{a.completedDeltaReads.map(window => <li key={`${window.from}:${window.to}`}>{window.from} → {window.to} · {window.pagesRead} pages · {window.complete ? "completed" : "unverified"}</li>)}</ul><p>These reads certify only their listed intervals, not earlier history or later plays today.</p></details>}
    <details><summary>Method and thresholds</summary>{Object.entries(a.rules).map(([name, rule]) => <p key={name}><b>{name}:</b> {rule}</p>)}</details>
    <details open><summary>Candidate musical nodes ({a.candidates.length})</summary><p>These are count-based candidates, not selected representatives. Review their pending cards below.</p><ul>{a.candidates.map(c => <li key={`${c.kind}:${c.key}`}><b>{c.label}</b> · {c.kind} · {c.reason}</li>)}</ul></details>
    <details><summary>Listening windows / provisional eras ({a.eras.length})</summary><ul>{a.eras.map(e => <li key={e.from}>{e.from}–{e.to}: {e.label} · {e.count} scrobbles</li>)}</ul></details>
    <details><summary>Bursts ({a.bursts.length}) and concentration ({a.concentrations.length})</summary><h3>Bursts</h3><ul>{a.bursts.map(d => <li key={d.date}>{d.date}: {d.count} scrobbles</li>)}</ul><h3>Concentrated days</h3><ul>{a.concentrations.map(d => <li key={d.date}>{d.date}: {d.topArtist} · {(d.topShare * 100).toFixed(1)}% of {d.count} plays</li>)}</ul></details>
    <details><summary>Transitions ({a.transitions.length}) and observed absences ({a.absences.length})</summary><ul>{a.transitions.map(t => <li key={t.from}>Week {t.previousFrom} → {t.from}: {t.previousTop} → {t.currentTop}; distribution change {t.distributionChange.toFixed(2)}</li>)}</ul><p>“Disappearance” means absence from the available records only.</p><ul>{a.absences.map(t => <li key={t.key}>{t.label}: {t.count} total plays, last observed {t.last}, {t.observedDaysSinceLast} days before the latest observed day.</li>)}</ul></details>
    {(["artists", "tracks", "albums"] as const).map(kind => <details key={kind}><summary>Recurring {kind} (top 20 of {a[kind].length})</summary><ol>{a[kind].slice(0, 20).map(t => <li key={t.key}>{t.label}: {t.count} plays / {t.activeDays} days / {t.activeWeeks} weeks</li>)}</ol></details>)}
  </section>;
}
