import Link from "next/link";
import { CTM_2027_TRACKER, INFERRED_SELECTION_CRITERIA, RESEARCH_DIRECTION, RESEARCH_TEMPLATES } from "@/lib/research";

export function ResearchLab() {
  const tracker = CTM_2027_TRACKER;
  return (
    <main className="research-main">
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Storywalker Studio home">
          <span className="wordmark-mark">S</span><span>Storywalker <i>Studio</i></span>
        </Link>
        <Link className="quiet-button" href="/">Aurora Coast</Link>
      </header>
      <section className="research-hero">
        <p className="eyebrow"><span /> Research Lab · public practice space</p>
        <h1>Keep the proposal open long enough for the Author to answer back.</h1>
        <p>Practice-based artistic research for CTM 2027 preparation. The studio remains deterministic; this lab tests what editorial agency feels like.</p>
        <div className="research-links">
          <Link className="primary-button" href="/research/linz">Prototype 1 · Linz</Link>
          <Link className="primary-button" href="/research/refusal">Experiment 01 · Refusal</Link>
          <Link className="outline-button" href="/research/echo-lab">Experiment 02 · Locative Echo</Link>
        </div>
      </section>
      <section className="research-grid" aria-label="CTM 2027 tracker">
        <article className="notebook-card tracker-card">
          <p className="section-kicker">Verified CTM tracker · {tracker.verifiedAt}</p>
          <div className="readiness"><strong>{tracker.readiness}%</strong><span>initial readiness</span></div>
          <dl className="facts-list">
            <div><dt>Status</dt><dd>{tracker.status}</dd></div>
            <div><dt>Official deadline</dt><dd>{tracker.officialDeadline}</dd></div>
            <div><dt>Internal deadline</dt><dd>{tracker.internalDeadline}</dd></div>
            <div><dt>Format</dt><dd>{tracker.format}</dd></div>
            <div><dt>Event</dt><dd>{tracker.event}</dd></div>
            <div><dt>Selection</dt><dd>{tracker.selectedParticipants} participants selected</dd></div>
            <div><dt>Support</dt><dd>{tracker.support}</dd></div>
            <div><dt>Limits</dt><dd>Biography {tracker.limits.biography}; proposal {tracker.limits.proposal} characters including spaces; URL 1 required, URL 2 optional.</dd></div>
          </dl>
          <p className="small-note">Eligible: {tracker.eligibleApplicants}</p>
          <p className="small-note">Truthful title: {tracker.truthfulTitle}</p>
          <p className="small-note">AI policy: {tracker.aiPolicy}</p>
          <p className="source-links">Official sources: {tracker.officialSources.map((source, index) => <a href={source} key={source} target="_blank" rel="noreferrer">{index + 1}</a>)}</p>
        </article>
        <article className="notebook-card direction-card">
          <p className="section-kicker">Current direction · provisional until {RESEARCH_DIRECTION.provisionalUntil}</p>
          <h2>{RESEARCH_DIRECTION.title}</h2>
          <blockquote>{RESEARCH_DIRECTION.question}</blockquote>
          <h3>Decision made</h3><p>{RESEARCH_DIRECTION.decisionMade}</p>
          <h3>Evidence produced</h3>
          <ul>{RESEARCH_DIRECTION.evidenceProduced.map((item) => <li key={item}>{item}</li>)}</ul>
          <h3>Next three actions</h3>
          <ol>{RESEARCH_DIRECTION.nextActions.map((item) => <li key={item}>{item}</li>)}</ol>
          <p className="checkpoint"><b>Next checkpoint:</b> {RESEARCH_DIRECTION.nextCheckpoint}</p>
        </article>
      </section>
      <section className="research-grid secondary-grid">
        <article className="notebook-card">
          <p className="section-kicker">Research notebook structures</p>
          <ul className="template-list">{RESEARCH_TEMPLATES.map((item) => <li key={item}>{item}</li>)}</ul>
          <Link href="https://github.com/adinapirjol/storywalker-studio/tree/main/docs/research/ctm-2027" className="text-link">Read the public templates →</Link>
        </article>
        <article className="notebook-card">
          <p className="section-kicker">Inferred selection criteria</p>
          <p className="small-note">These are working inferences, not confirmed CTM requirements.</p>
          <ul className="template-list">{INFERRED_SELECTION_CRITERIA.map((item) => <li key={item}>{item}</li>)}</ul>
          <h3>Parking lot</h3>
          <ul className="template-list">{RESEARCH_DIRECTION.parkingLot.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
      </section>
      <footer><span>Storywalker Research Lab</span><span>Public fictional demonstrations · private life material stays local</span></footer>
    </main>
  );
}
