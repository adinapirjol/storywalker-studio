import Link from "next/link";
import { CTM_2027_TRACKER, RESEARCH_DIRECTION, RESEARCH_TEMPLATES } from "@/lib/research";
import styles from "./research-lab.module.css";

const experiments = [
  { href: "/research/linz", name: "Public City, Private Echoes", tag: "Linz · locative prototype", text: "A three-location rehearsal of public place data, private traces and the Author’s right to revise or refuse a proposal." },
  { href: "/research/refusal", name: "The consequence of refusal", tag: "Experiment 01 · editorial agency", text: "Accept, revise or refuse a proposed fragment. Explore how an editorial decision changes the work without turning a proposal into canon." },
  { href: "/research/echo-lab", name: "Locative Echo", tag: "Experiment 02 · movement & consent", text: "A bounded study of movement, uncertainty and consent. Location provides context; the Author decides what it means." },
  { href: "/research/13a-forever", name: "13A Forever", tag: "Are.na · archive reader", text: "A route through source-ordered cultural fragments. Available material depends on the saved Are.na snapshot; unavailable sources stay visibly absent." },
];

export function ResearchLab() {
  const tracker = CTM_2027_TRACKER;
  return (
    <main className={`research-main ${styles.lab}`}>
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Storywalker Studio home"><span className="wordmark-mark">S</span><span>Storywalker <i>Studio</i></span></Link>
        <nav className={styles.headerLinks} aria-label="Studio"><Link className="quiet-button" href="/vault">Private Vault</Link><Link className="quiet-button" href="/">Studio home</Link></nav>
      </header>
      <section className={`research-hero ${styles.hero}`}>
        <p className="eyebrow"><span /> Research Lab · practice in progress</p>
        <h1>An archive you can enter.<br /><em>A memory you can move.</em></h1>
        <p>Storywalker explores how evidence becomes an artistic space while the traveller remains its Author. Walk through time, encounter the sources, and compose a different arrangement.</p>
        <div className="research-links"><Link className="primary-button" href="/research/xr">Enter Spatial Rehearsal →</Link><a className="outline-button" href="#experiments">Explore the other studies</a></div>
        <p className={styles.updated}>Research overview · 29 September 2026</p>
      </section>

      <section className={styles.feature} aria-labelledby="spatial-title">
        <div className={styles.featureCopy}>
          <p className={styles.kicker}>Current practice / Spatial Rehearsal</p>
          <h2 id="spatial-title">A passage made<br /><em>of intervals.</em></h2>
          <p>A browser-based audiovisual installation study. Episode spaces hold listening observations, cultural fragments and their sources. Approach a window, draw its evidence into view, then cross into an archival chamber.</p>
          <p className={styles.featureNote}>The public route begins with a demonstration. Personal scenes are loaded explicitly from the encrypted Vault.</p>
          <Link href="/research/xr" className={styles.enter}>Open the rehearsal <span aria-hidden="true">↗</span></Link>
        </div>
        <div className={styles.portalStudy} aria-hidden="true"><div className={styles.portalA} /><div className={styles.portalB} /><div className={styles.portalC} /><span>WORLD / TIME / MEMORY</span><small>Spatial study · no personal data</small></div>
        <div className={styles.regimes}>
          <article><span>01 / WORLD</span><h3>Locate.</h3><p>An orbitable geographic atlas establishes the baseline. Episode plates remain anchored to source-supported locations.</p></article>
          <article><span>02 / TIME</span><h3>Enter.</h3><p>Episodes form a chronological passage. Source windows reveal their evidence through proximity, selection and entry.</p></article>
          <article><span>03 / MEMORY</span><h3>Recompose.</h3><p>Geography meets elapsed time and listening. Move an episode as an Author decision; its geographic ghost and displacement remain visible.</p></article>
        </div>
      </section>

      <section className={`research-grid ${styles.current}`} aria-label="Current research state">
        <article className="notebook-card"><p className="section-kicker">Working question</p><h2>What changes when evidence becomes a space you can walk through?</h2><p>The current study tests orientation, proximity and authored displacement. It keeps the earlier question of editorial agency alive: the Author can accept, reconsider, refuse and reposition a proposal.</p><h3>Implemented in the rehearsal</h3><ul><li>WORLD, TIME and MEMORY representations of the same episode evidence.</li><li>Source-window inventories, evidence surfaces and bounded archive chambers.</li><li>Timestamp-based listening alignment and provenance-aware Vault enrichment.</li><li>Saved review decisions, scene export and optional synthetic spatial sound after activation.</li></ul></article>
        <article className="notebook-card"><p className="section-kicker">Next rehearsal · questions to test</p><h2>From working prototype to lived encounter.</h2><ol><li>Walk a TIME passage and record whether the source windows feel like entrances to an archive.</li><li>Compare WORLD and MEMORY: can a viewer distinguish recorded geography from an Author’s displacement?</li><li>Review uncertain evidence associations and document what accepting or refusing them changes.</li><li>Rehearse scale, projection and sound in a physical room before making installation claims.</li></ol><p className="small-note">These are proposed research actions. Headset tracking, sensors and a physical multi-speaker installation are not established by this browser prototype.</p></article>
      </section>

      <section className={styles.principles} aria-label="Evidence and authorship"><p className="section-kicker">The traveller is the Author; the AI is the Editor.</p><p>Evidence, interpretation and artistic composition remain separate. Strong source links can attach automatically; uncertain associations await review. Listening counts and duration can shape the space without claiming emotion or importance.</p><p className="small-note">This public overview contains no private itinerary, listening history or Vault artefacts. The current rehearsal uses deterministic methods and synthetic sound; no ML interpretation or Spotify audio.</p></section>

      <section id="experiments" className={styles.studies} aria-labelledby="studies-title"><div className={styles.sectionHeading}><p className="section-kicker">Alongside the current rehearsal</p><h2 id="studies-title">Other paths through the practice.</h2></div><div className={styles.studyGrid}>{experiments.map(item=><article key={item.href}><p className="section-kicker">{item.tag}</p><h3><Link href={item.href}>{item.name} <span aria-hidden="true">↗</span></Link></h3><p>{item.text}</p></article>)}</div></section>

      <section className={styles.notes} aria-label="Research notebook and earlier planning">
        <details><summary>Research notebook · structures for documenting the work</summary><ul className="template-list">{RESEARCH_TEMPLATES.map(item=><li key={item}>{item}</li>)}</ul><a href="https://github.com/adinapirjol/storywalker-studio/tree/main/docs/research/ctm-2027" className="text-link" target="_blank" rel="noreferrer">Read the public templates ↗</a></details>
        <details><summary>Earlier CTM 2027 planning · snapshot from 23 August 2026</summary><p>This is a retained planning record, not a current application status. Its 24% readiness estimate and 15 September checkpoint have not been reassessed. Check the official call before using its dates or requirements.</p><div className={styles.archiveGrid}><div><h3>Recorded call details</h3><dl className="facts-list"><div><dt>Recorded status</dt><dd>{tracker.status} as of {tracker.verifiedAt}</dd></div><div><dt>Recorded deadline</dt><dd>{tracker.officialDeadline}</dd></div><div><dt>Internal target</dt><dd>{tracker.internalDeadline}</dd></div><div><dt>Format</dt><dd>{tracker.format}</dd></div><div><dt>Event</dt><dd>{tracker.event}</dd></div><div><dt>Support</dt><dd>{tracker.support}</dd></div></dl><p className="source-links">Official references: {tracker.officialSources.map((source,index)=><a key={source} href={source} target="_blank" rel="noreferrer">{index===0?"Research Networking Day call":"Festival theme"}</a>)}</p></div><div><h3>Earlier research frame</h3><h4>{RESEARCH_DIRECTION.title}</h4><p>{RESEARCH_DIRECTION.question}</p><p>The former decision date was {RESEARCH_DIRECTION.provisionalUntil}. This frame remains part of the research history; the current practical focus is Spatial Rehearsal.</p></div></div></details>
      </section>
      <footer><span>Storywalker Research Lab</span><span>Public practice · private sources remain in the Vault</span></footer>
    </main>
  );
}
