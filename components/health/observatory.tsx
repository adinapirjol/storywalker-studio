"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { periodComparisons, researchTimeline, rolling, timeline } from "@/lib/health/analysis";
import { exampleExperience, exampleInsights, observatoryInsights } from "@/lib/health/observatory-insights";
import { syntheticImport } from "@/lib/health/fixture";
import { dates, type SleepRecord } from "@/lib/health/model";
import { ResearchConnection } from "./research-connection";
import { ResearchEvidence } from "./research-evidence";
import { cycleContextNote, selectedCycleContext, type CycleContext } from "@/lib/health/cycle-context";
import type { ResearchView } from "@/lib/health/research-journal";
import { ArchiveRehearsal } from "./archive-rehearsal";
import { ImportPanel } from "./import-panel";
import "./study.css";

const exampleRange = { from: "2026-02-01", to: "2026-02-28", offset: 120 };
const hours = (value: number | null) => value === null ? "Unknown" : `${Number(value.toFixed(2))} h`;

export function Observatory() {
  const [records, setRecords] = useState<SleepRecord[]>(() => syntheticImport().records);
  const [range, setRange] = useState(exampleRange);
  const [hidden, setHidden] = useState(false);
  const [privateMode, setPrivateMode] = useState(false);
  const [cycleContext, setCycleContext] = useState<CycleContext>();
  const [tools, setTools] = useState(false);
  useEffect(() => {
    const conceal = () => { if (document.visibilityState === "hidden") setHidden(true); };
    document.addEventListener("visibilitychange", conceal);
    return () => document.removeEventListener("visibilitychange", conceal);
  }, []);
  // Eligible windows support descriptive comparisons, not a clinically stable baseline.
  const nights = useMemo(() => privateMode ? researchTimeline(records, range.from, range.to) : timeline(records, range.from, range.to, range.offset,
    new Set(dates(range.from, range.to))), [records, range, privateMode]);
  const insights = privateMode ? observatoryInsights(nights) : exampleInsights(nights);
  const cycle = privateMode ? selectedCycleContext(cycleContext, range) : undefined;
  const contextNote = cycle ? cycleContextNote(cycle) : undefined;
  const experience = privateMode ? () => null : exampleExperience;
  const comparison = periodComparisons(nights);
  const first = comparison.periods[0] ?? comparison.overall;
  const recent = comparison.periods.at(-1) ?? comparison.overall;
  const change = comparison.periods.length > 1 && first.median !== null && recent.median !== null ? recent.median - first.median : null;
  const recorded = nights.filter(n => n.sleep !== null).length;
  const latest = nights.at(-1);
  const trend = nights.length ? rolling(nights, nights.length - 1) : { value: null, n: 0 };
  function resetExample() { setCycleContext(undefined); setPrivateMode(false); setRecords(syntheticImport().records); setRange(exampleRange); }

  function loadResearch(view: ResearchView | null) {
    if (!view?.journal) { resetExample(); return; }
    setCycleContext(view.journal.cycleContext);
    setPrivateMode(view.journal.mode === "healthkit"); setRecords(view.records); setRange(view.range);
  }
  return <main className="health-study">
    <header>
      <Link href="/research">← Research Lab</Link>
      <p className="health-eyebrow">STUDY 04 / OBSERVATORY</p>
      <h1>Your patterns, at a glance.</h1>
      <p>An automatic research view of sleep, energy, mood and life context.</p>
    </header>
    <aside>
      <strong>{privateMode ? "Private HealthKit data" : "Invented data · example mode"}</strong>
      <p>{privateMode ? "Your selected HealthKit sleep sources are combined without counting overlaps twice. Missing energy, mood and context stay unknown." : "This example loads automatically so you can explore the app. These are not your readings. Sleep, experience and context values are all invented."}</p>
    </aside>
    <div className="health-actions">
      <button onClick={() => setHidden(value => !value)}>{hidden ? "Reveal observatory" : "Hide observatory"}</button>
      {!privateMode && <button onClick={resetExample}>Reset example</button>}
    </div>
    <div hidden={hidden}>
      <ResearchConnection onView={loadResearch} />
      <section aria-labelledby="health-overview">
        <h2 id="health-overview">What’s happening with sleep?</h2>
        <p>{range.from} to {range.to} · {privateMode ? "selected HealthKit recordings" : "invented Watch recordings"}</p>
        <div className="health-stats">
          <p><span>Last recorded window</span><strong>{hours(latest?.sleep ?? null)}</strong>{latest?.uncertain && <span>Uncertain recording</span>}</p>
          <p><span>Recorded sleep · 7-day median</span><strong>{hours(trend.value)}</strong><span>{trend.n} usable recordings</span></p>
          <p><span>Recording coverage</span><strong>{recorded} / {nights.length} nights</strong><span>{nights.length - recorded} nights unknown</span><span>{nights.filter(n => n.uncertain).length} windows uncertain; excluded from comparisons</span></p>
        </div>
        {nights.some(n => n.uncertain) && <details>
          <summary>Why some windows are uncertain</summary>
          <p>These flags describe recording or grouping limitations, not a problem with your sleep. A window can have more than one reason.</p>
          <ul>{[...new Set(nights.flatMap(n => n.uncertaintyReasons ?? []))].map(reason => <li key={reason}>{reason}: {nights.filter(n => n.uncertaintyReasons?.includes(reason)).length} windows</li>)}</ul>
          <p>Source overlap checks are conservative: even a small boundary difference is flagged. Different timezone offsets alone do not exclude duration. Originals remain saved; excluded windows are still shown in the timeline.</p>
        </details>}
        <p className="health-reading">
          {change === null ? "There isn’t enough recorded sleep to compare these periods." :
            change === 0 ? "The first and last periods have the same median recorded sleep duration." :
              `Median recorded sleep is ${hours(Math.abs(change))} ${change < 0 ? "shorter" : "longer"} in the last period compared with the first.`}
          {" "}Missing nights stay unknown; they do not count as zero sleep.
        </p>
        <h3>Across the full displayed period</h3>
        <p>Median of recorded dates: {hours(comparison.overall.median)} · variability (median absolute deviation): {hours(comparison.overall.mad)} · {comparison.overall.count} usable dates.</p>
        <ul aria-label="Sleep period comparisons">{comparison.periods.map(p => <li key={p.from}>{p.from} to {p.to}: recorded-date median {hours(p.median)} · variability {hours(p.mad)} · {p.count}/{p.days} usable dates · {p.missing} missing · {p.excluded} excluded</li>)}</ul>
        <p>Consecutive 30-day periods; the final period may be shorter. Medians require three recorded dates. These medians describe recorded dates, not typical sleep across the whole period. Missing dates may differ systematically from recorded dates; the direction of bias is unknown. Gaps stay unknown and are never filled in.</p>
        <div className="health-chart" role="img" style={{ gridTemplateColumns: `repeat(${Math.max(1, nights.length)}, minmax(12px, 1fr))`, overflowX: "auto" }} aria-label={`${privateMode ? "Recorded" : "Invented"} nightly sleep, ${range.from} to ${range.to}. ${recorded} of ${nights.length} nights recorded. Exact values are in the table below.`}>
          {nights.map(n => <div className="health-chart-day" key={n.day} title={`${n.day}: ${hours(n.sleep)}${n.uncertain ? " · uncertain" : ""}`}>
            <div className="health-chart-track"><span className={n.sleep === null ? "health-chart-gap" : "health-chart-bar"} style={{ height: n.sleep === null ? "4px" : `${Math.min(n.sleep / 12, 1) * 100}%` }} /></div>
            <span>{n.day.slice(-2)}{n.uncertain ? "*" : ""}</span>
          </div>)}
        </div>
        <p>Nightly recorded sleep · * marks uncertain windows. Bar height represents hours, not a score or achievement.</p>
        <details>
          <summary>See daily values and timing</summary>
          <div className="health-table" tabIndex={0} role="region" aria-label={privateMode ? "Recorded sleep timeline" : "Invented sleep timeline"}>
            <table>
              <caption>{privateMode ? "Recorded" : "Invented"} sleep readings; missing periods are unknown.</caption>
              <thead><tr><th scope="col">Date</th><th scope="col">Main sleep</th><th scope="col">Onset → waking</th><th scope="col">Other bouts / total assigned to date</th><th scope="col">Energy / low / elevated / irritable</th><th scope="col">Context / coverage</th></tr></thead>
              <tbody>{nights.map(n => <tr key={n.day}>
                <th scope="row">{n.day}</th><td>{hours(n.sleep)}</td><td>{n.onset ?? "Unknown"} → {n.waking ?? "Unknown"}</td>
                <td>{hours(n.naps)} / {hours(n.total)}</td><td>{experience(n.day) ? `${experience(n.day)!.energy} / ${experience(n.day)!.low} / ${experience(n.day)!.elevated} / ${experience(n.day)!.irritable}` : "Unknown"}</td><td>{experience(n.day)?.context && <p>{experience(n.day)!.context}</p>}{n.sleep === null ? "No recording" : n.uncertain ? n.uncertaintyReasons?.join("; ") || "Timing or recording uncertainty" : privateMode ? "Recorded interval; completeness unknown" : "Invented recording"}{n.timingNotes?.map(note => <p key={note}>{note}</p>)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </details>
        <details>
          <summary>How this view is calculated</summary>
          <p>All displayed dates contribute to consecutive 30-day summaries. Medians and variability require at least three usable dates, with no minimum coverage percentage; counts and gaps are always shown. These are descriptive summaries, not a healthy baseline. The recent trend requires four recordings within seven days.</p>
          <p>{privateMode ? "Overlapping sleep is counted once in elapsed UTC time. Intervals separated by at most 90 minutes form a candidate bout; the whole bout belongs to its source-local waking date, even when it crosses noon or a timezone change. The longest bout on that date is the main-sleep candidate; other bouts are shown separately. Totals assigned to a date are not fixed 24-hour totals. Onset and waking use their original source offsets, so clock times across travel need care. Conflicting source coverage, awake/asleep overlap, or bouts spanning more than 24 hours remain excluded from duration comparisons." : "The invented example uses fixed-offset noon-to-noon windows."} Original records and timestamps are preserved. Missing dates do not prove that no sleep occurred.</p>
        </details>
      </section>
      <section aria-labelledby="health-energy">
        <h2 id="health-energy">How the signals relate</h2>
        <p>{privateMode ? "Subjective energy and mood are unavailable from this sleep connection." : "Invented daily experience values on a 0–4 scale sit alongside the invented Watch readings."} Energy, low mood, elevated mood and irritability remain separate signals. They are not inferred from sleep and are not clinical scores.</p>
        <div className="health-stats">{insights.signals.map(signal => <p key={signal.signal}>
          <span>Sleep & {signal.label}</span>
          <strong>{signal.r === null ? "Not enough information" : Math.abs(signal.r) < 0.3 ? "Weak linear pattern" : signal.r > 0 ? "Move together" : "Move in opposite directions"}</strong>
          <span>{signal.paired} paired days · {signal.missing} excluded{signal.r !== null ? ` · r = ${signal.r.toFixed(2)}` : ""}</span>
        </p>)}</div>
        <p>These are exploratory same-day correlations, not causes or next-day predictions. At least 14 paired days and variation in both signals are required; missing values are never filled in. This minimum is a design choice.</p>
      </section>
      <section aria-labelledby="health-notes">
        <h2 id="health-notes">Observatory notes</h2>
        <p>Generated automatically from the displayed data. Saved research updates when accepted source data changes; earlier versions are available in Research history above.</p>
        {contextNote && <article className="health-insight"><h3>{contextNote.title}</h3><ResearchEvidence note={contextNote} /><p>{contextNote.uncertainty}</p></article>}
        {insights.notes.length ? insights.notes.map(note => <article key={note.id} className="health-insight">
          <h3>{note.title}</h3><ResearchEvidence note={note} /><p><strong>Interpretation limit:</strong> {note.uncertainty}</p>
        </article>) : <p>No qualifying pattern in the selected data. That does not establish that nothing changed.</p>}
      </section>
      <section aria-labelledby="health-source">
        <h2 id="health-source">Data source</h2>
        <p><strong>{privateMode ? "Using your selected private sleep recordings." : "Using the built-in example."}</strong> Configure private Watch research above to load the paired companion’s sleep records.</p>
        <p>Saved private notes reload while your Vault is unlocked. New accepted sleep batches update the notes even when this page is closed, provided the Mac receiver is running.</p>
        <p>This view describes recorded patterns. It does not diagnose conditions or make forecasts.</p>
        <button aria-expanded={tools} aria-controls="health-testing-tools" onClick={() => setTools(value => !value)}>{tools ? "Close testing tools" : "Open storage & import testing tools"}</button>
        {tools && <div id="health-testing-tools">
          <p>Developer rehearsal only. These controls are not needed to use the observatory. All data must be invented.</p>
          <ArchiveRehearsal onLoad={archive => {
            setPrivateMode(false); setRecords(archive?.observations.flatMap(o => o.kind === "sleep" ? [o.value] : []) ?? []);
            setRange(exampleRange);
          }} />
          <ImportPanel onSave={(rows, from, to, offset, synthetic) => {
            if (!synthetic) return;
            setPrivateMode(false); setRecords(rows); setRange({ from, to, offset });
          }} />
        </div>}
      </section>
    </div>
    {hidden && <p role="status">Observatory hidden. Reveal it when you’re ready.</p>}
  </main>;
}
