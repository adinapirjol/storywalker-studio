"use client";

import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  Download,
  FileCheck2,
  Fingerprint,
  Headphones,
  LockKeyhole,
  MapPin,
  Music2,
  RefreshCcw,
  Route,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { reconcileProposals } from "@/lib/correlation";
import { seedAuroraCoast, validateAuroraCoastDemo } from "@/lib/demo";
import { exportJourneyMarkdown } from "@/lib/export";
import {
  applyGuidedReview,
  reviewAllLifeEvents,
  reviewProposal,
  reviseVeniceWindow,
} from "@/lib/review-state";
import {
  studioStateSchema,
  type LifeEvent,
  type Privacy,
  type Proposal,
  type StudioState,
  type Track,
} from "@/lib/schema";

const STORAGE_KEY = "storywalker-studio:aurora-coast:r1";
const FIXED_REVIEW_TIME = new Date("2027-07-28T08:12:00+02:00");
const route = [
  "Ljubljana",
  "Afterlight Fields",
  "Venice",
  "Piran",
  "Vienna",
  "Berlin",
];

type Phase = "empty" | "preview" | "workspace";

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Ljubljana",
  }).format(new Date(value));
}

function dayLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Ljubljana",
  }).format(new Date(value));
}

function privacyLabel(value: Privacy) {
  return value === "friends-only" ? "Friends only" : `${value[0].toUpperCase()}${value.slice(1)}`;
}

export function StorywalkerStudio() {
  const [phase, setPhase] = useState<Phase>("empty");
  const [state, setState] = useState<StudioState>();
  const [preview, setPreview] = useState<ReturnType<typeof validateAuroraCoastDemo>>();
  const [showExport, setShowExport] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = studioStateSchema.parse(JSON.parse(stored) as unknown);
      setState(parsed);
      setPhase("workspace");
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  function persist(next: StudioState, message: string) {
    setState(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setNotice(message);
  }

  function loadPreview() {
    setPreview(validateAuroraCoastDemo());
    setPhase("preview");
    setNotice("Exact revision validated in memory. Nothing has been persisted.");
  }

  function seedWorkspace() {
    const next = seedAuroraCoast();
    persist(next, "Aurora Coast seeded locally. All 8 LifeEvents require an Author decision.");
    setPhase("workspace");
  }

  function resetDemo() {
    window.localStorage.removeItem(STORAGE_KEY);
    setState(undefined);
    setPreview(undefined);
    setPhase("empty");
    setShowExport(false);
    setNotice("Local demo state cleared.");
  }

  function reviewEvent(eventId: string, status: "confirmed" | "rejected") {
    if (!state) return;
    const reviewed = studioStateSchema.parse({
      ...state,
      lifeEvents: state.lifeEvents.map((event) =>
        event.id === eventId ? { ...event, reviewStatus: status } : event,
      ),
    });
    persist(
      studioStateSchema.parse({
        ...reviewed,
        proposals: reconcileProposals(reviewed, FIXED_REVIEW_TIME),
      }),
      `LifeEvent ${status} by Author. Temporal proposals regenerated.`,
    );
  }

  const workspace = state && phase === "workspace" ? (
    <Workspace
      onApplyGuidedReview={() =>
        persist(
          applyGuidedReview(state),
          "Guided review complete: one proposal confirmed, one rejected, and the Venice range revised.",
        )
      }
      onConfirmAll={() =>
        persist(
          reviewAllLifeEvents(state),
          "All 8 fictional LifeEvents confirmed by Author. Proposals regenerated deterministically.",
        )
      }
      onExport={() => setShowExport(true)}
      onReviewEvent={reviewEvent}
      onReviewProposal={(id, status) =>
        persist(
          reviewProposal(state, id, status),
          status === "confirmed" ? "Connection confirmed by Author." : "Connection rejected by Author.",
        )
      }
      onReviseVenice={() =>
        persist(
          reviseVeniceWindow(state),
          "Date range revised. Stale overlap invalidated and proposals regenerated.",
        )
      }
      state={state}
    />
  ) : null;

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Storywalker Studio home">
          <span className="wordmark-mark">S</span>
          <span>Storywalker <i>Studio</i></span>
        </a>
        <div className="header-actions">
          <span className="fiction-label">Fictional demonstration data</span>
          {phase === "workspace" ? (
            <button className="quiet-button" onClick={resetDemo} type="button">
              <RefreshCcw size={14} /> Reset local demo
            </button>
          ) : null}
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> Aurora Coast · Chapter One</p>
          <h1>What happened, what played, and what only <em>might</em> connect.</h1>
          <p className="hero-intro">
            Storywalker Studio reconstructs personal journeys from fragmented digital
            traces—without turning temporal proximity into objective truth.
          </p>
          {phase === "empty" ? (
            <button className="primary-button" onClick={loadPreview} type="button">
              Load Aurora Coast Demo <ArrowRight size={17} />
            </button>
          ) : phase === "preview" ? (
            <button className="primary-button" onClick={seedWorkspace} type="button">
              Seed Author workspace <ArrowRight size={17} />
            </button>
          ) : (
            <a className="primary-button" href="#review-desk">
              Open Author review <ArrowDown size={17} />
            </a>
          )}
          <p className="microcopy">
            <ShieldCheck size={14} /> Offline demo · no account · no Spotify credentials
          </p>
        </div>
        <RoutePlate phase={phase} />
      </section>

      <RouteRibbon />

      {notice ? (
        <div className="notice" role="status">
          <CheckCircle2 size={15} /> {notice}
        </div>
      ) : null}

      {phase === "preview" && preview ? (
        <PreviewCard preview={preview} onSeed={seedWorkspace} />
      ) : null}

      {workspace}

      {showExport && state ? (
        <ExportDrawer state={state} onClose={() => setShowExport(false)} />
      ) : null}

      <footer>
        <span>Storywalker Studio</span>
        <span>Deterministic first · Author controlled · Privacy aware</span>
        <span>Created by Adina Pirjol</span>
      </footer>
    </main>
  );
}

function RoutePlate({ phase }: { phase: Phase }) {
  const step = phase === "empty" ? 1 : phase === "preview" ? 2 : 3;
  return (
    <aside className="route-plate" aria-label="Demo workflow">
      <div className="plate-top">
        <span>Field note / 01</span>
        <span>18—27.07.2027</span>
      </div>
      <div className="plate-map">
        <span className="map-line" />
        {route.map((place, index) => (
          <div className={`map-stop stop-${index + 1}`} key={place}>
            <i />
            <span>{place}</span>
          </div>
        ))}
        <span className="plate-stamp">FICTION<br />ONLY</span>
      </div>
      <div className="workflow-mini">
        <WorkflowStep active={step >= 1} number="01" text="Validate" />
        <ChevronRight size={14} />
        <WorkflowStep active={step >= 2} number="02" text="Preview" />
        <ChevronRight size={14} />
        <WorkflowStep active={step >= 3} number="03" text="Review" />
      </div>
    </aside>
  );
}

function WorkflowStep({
  active,
  number,
  text,
}: {
  active: boolean;
  number: string;
  text: string;
}) {
  return (
    <span className={active ? "workflow-step active" : "workflow-step"}>
      <b>{number}</b> {text}
    </span>
  );
}

function RouteRibbon() {
  return (
    <nav className="route-ribbon" aria-label="Aurora Coast route">
      {route.map((place, index) => (
        <span key={place}>
          <b>{String(index + 1).padStart(2, "0")}</b>
          {place}
          {index < route.length - 1 ? <ArrowRight size={13} /> : null}
        </span>
      ))}
    </nav>
  );
}

function PreviewCard({
  preview,
  onSeed,
}: {
  preview: ReturnType<typeof validateAuroraCoastDemo>;
  onSeed: () => void;
}) {
  return (
    <section className="preview-card">
      <div className="preview-heading">
        <span className="icon-tile"><Fingerprint size={21} /></span>
        <div>
          <p className="section-kicker">Memory-only preview</p>
          <h2>Exact revision verified</h2>
        </div>
        <span className="verified-pill"><Check size={13} /> Valid</span>
      </div>
      <div className="preview-grid">
        <div>
          <small>Bundle revision</small>
          <strong>{preview.revision}</strong>
        </div>
        <div>
          <small>Music traces</small>
          <strong>12 synthetic tracks</strong>
        </div>
        <div>
          <small>Source events</small>
          <strong>8 fictional LifeEvents</strong>
        </div>
        <div>
          <small>Persistence</small>
          <strong>Nothing written yet</strong>
        </div>
      </div>
      <div className="preview-footer">
        <p>
          Validation checks the schema, shared revision, and expected counts. Seeding is a separate,
          explicit local action.
        </p>
        <button className="dark-button" onClick={onSeed} type="button">
          Seed Author workspace <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}

interface WorkspaceProps {
  state: StudioState;
  onConfirmAll: () => void;
  onApplyGuidedReview: () => void;
  onExport: () => void;
  onReviewEvent: (eventId: string, status: "confirmed" | "rejected") => void;
  onReviewProposal: (proposalId: string, status: "confirmed" | "rejected") => void;
  onReviseVenice: () => void;
}

function Workspace({
  state,
  onConfirmAll,
  onApplyGuidedReview,
  onExport,
  onReviewEvent,
  onReviewProposal,
  onReviseVenice,
}: WorkspaceProps) {
  const counts = {
    eventsConfirmed: state.lifeEvents.filter((event) => event.reviewStatus === "confirmed").length,
    pending: state.proposals.filter((proposal) => proposal.status === "pending").length,
    confirmed: state.proposals.filter((proposal) => proposal.status === "confirmed").length,
    rejected: state.proposals.filter((proposal) => proposal.status === "rejected").length,
    invalidated: state.proposals.filter((proposal) => proposal.status === "invalidated").length,
  };
  const activeProposals = useMemo(
    () =>
      [...state.proposals]
        .filter((proposal) => proposal.status !== "invalidated")
        .sort(
          (a, b) =>
            ["confirmed", "rejected", "pending"].indexOf(a.status) -
              ["confirmed", "rejected", "pending"].indexOf(b.status) ||
            a.distanceHours - b.distanceHours,
        )
        .slice(0, 18),
    [state.proposals],
  );

  return (
    <>
      <section className="workflow-band">
        {[
          ["01", "Validated bundle"],
          ["02", "Memory preview"],
          ["03", "Explicit seed"],
          ["04", "Author review"],
          ["05", "Safe export"],
        ].map(([number, label], index) => (
          <div className={index < 3 || counts.eventsConfirmed ? "done" : ""} key={number}>
            <span>{number}</span>
            <strong>{label}</strong>
            {index < 4 ? <ChevronRight size={15} /> : null}
          </div>
        ))}
      </section>

      <section className="review-shell" id="review-desk">
        <div className="review-title">
          <div>
            <p className="section-kicker">The Author stays in control</p>
            <h2>Review desk</h2>
            <p>
              A timestamp can establish proximity. Only an Author can establish meaning.
            </p>
          </div>
          <div className="review-actions">
            {counts.eventsConfirmed < 8 ? (
              <button className="outline-button" onClick={onConfirmAll} type="button">
                <FileCheck2 size={16} /> Confirm all 8 source events
              </button>
            ) : null}
            <button className="outline-button" onClick={onApplyGuidedReview} type="button">
              <Sparkles size={16} /> Apply guided review
            </button>
            <button className="dark-button" onClick={onExport} type="button">
              <Download size={16} /> Privacy-safe export
            </button>
          </div>
        </div>

        <div className="review-metrics">
          <Metric value={`${counts.eventsConfirmed}/8`} label="events Author-confirmed" />
          <Metric value={String(counts.pending)} label="decisions required" />
          <Metric value={String(counts.confirmed)} label="confirmed connections" />
          <Metric value={String(counts.rejected)} label="rejected connections" />
          <Metric value={String(counts.invalidated)} label="invalidated revisions" />
        </div>

        <div className="studio-grid">
          <section className="events-column">
            <ColumnHeading
              icon={<MapPin size={16} />}
              count="08"
              title="Life events"
              subtitle="Source evidence"
            />
            <div className="event-list">
              {state.lifeEvents.map((event, index) => (
                <EventCard
                  event={event}
                  index={index}
                  key={event.id}
                  onReview={onReviewEvent}
                  onReviseVenice={onReviseVenice}
                />
              ))}
            </div>
          </section>

          <section className="proposals-column">
            <ColumnHeading
              icon={<Route size={16} />}
              count={String(state.proposals.length).padStart(2, "0")}
              title="Proposed connections"
              subtitle="Temporal evidence"
            />
            {!state.proposals.length ? (
              <div className="empty-proposals">
                <CircleDashed size={31} />
                <h3>Author decision required</h3>
                <p>
                  Confirm source events before the deterministic correlation pass can propose
                  connections.
                </p>
                <button className="dark-button" onClick={onConfirmAll} type="button">
                  Confirm source events <ArrowRight size={15} />
                </button>
              </div>
            ) : (
              <div className="proposal-list">
                {activeProposals.map((proposal) => (
                  <ProposalCard
                    event={state.lifeEvents.find((event) => event.id === proposal.eventId)!}
                    key={proposal.id}
                    onReview={onReviewProposal}
                    proposal={proposal}
                    track={state.tracks.find((track) => track.id === proposal.trackId)!}
                  />
                ))}
                {state.proposals.length > activeProposals.length ? (
                  <p className="list-note">
                    Showing the 18 most relevant active proposals. The full deterministic set remains
                    in local state and export logic.
                  </p>
                ) : null}
                {counts.invalidated ? (
                  <details className="audit-details">
                    <summary>{counts.invalidated} invalidated proposal retained for audit</summary>
                    {state.proposals
                      .filter((proposal) => proposal.status === "invalidated")
                      .map((proposal) => (
                        <code key={proposal.id}>{proposal.id}</code>
                      ))}
                  </details>
                ) : null}
              </div>
            )}
          </section>

          <aside className="tracks-column">
            <ColumnHeading
              icon={<Headphones size={16} />}
              count="12"
              title="Listening trace"
              subtitle="Synthetic metadata"
            />
            <div className="track-list">
              {state.tracks.map((track, index) => (
                <TrackRow index={index} key={track.id} track={track} />
              ))}
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ColumnHeading({
  count,
  icon,
  subtitle,
  title,
}: {
  count: string;
  icon: React.ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="column-heading">
      <span className="column-icon">{icon}</span>
      <div>
        <h3>{title}</h3>
        <span>{subtitle}</span>
      </div>
      <b>{count}</b>
    </div>
  );
}

function EventCard({
  event,
  index,
  onReview,
  onReviseVenice,
}: {
  event: LifeEvent;
  index: number;
  onReview: (eventId: string, status: "confirmed" | "rejected") => void;
  onReviseVenice: () => void;
}) {
  return (
    <article className={`event-card ${event.reviewStatus}`}>
      <div className="event-number">{String(index + 1).padStart(2, "0")}</div>
      <div className="event-body">
        <div className="event-meta">
          <span>{event.certainty === "day" ? dayLabel(event.startAt) : dateLabel(event.startAt)}</span>
          <PrivacyPill value={event.privacy} />
        </div>
        <h4>{event.title}</h4>
        <p>{event.description}</p>
        <div className="event-location"><MapPin size={12} /> {event.location}</div>
        {event.id === "demo-event-006" ? (
          <button className="revision-button" onClick={onReviseVenice} type="button">
            <Clock3 size={13} />
            {event.revision ? "Date range revised" : "Revise to last-vaporetto window"}
          </button>
        ) : null}
        <div className="event-review">
          <StatusPill status={event.reviewStatus} />
          <button
            aria-label={`Confirm ${event.title}`}
            onClick={() => onReview(event.id, "confirmed")}
            type="button"
          >
            <Check size={13} />
          </button>
          <button
            aria-label={`Reject ${event.title}`}
            onClick={() => onReview(event.id, "rejected")}
            type="button"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </article>
  );
}

function ProposalCard({
  event,
  onReview,
  proposal,
  track,
}: {
  event: LifeEvent;
  onReview: (proposalId: string, status: "confirmed" | "rejected") => void;
  proposal: Proposal;
  track: Track;
}) {
  return (
    <article className={`proposal-card ${proposal.status}`}>
      <div className="connection-line">
        <span className="music-node"><Music2 size={15} /></span>
        <span className="dashed-line" />
        <span className="event-node"><MapPin size={14} /></span>
      </div>
      <div className="proposal-content">
        <div className="proposal-top">
          <span className={`confidence ${proposal.confidence}`}>{proposal.confidence}</span>
          <span>{proposal.basis.replaceAll("-", " ")}</span>
          <PrivacyPill value={event.privacy} />
        </div>
        <h4>{track.trackName} <span>— {track.artistName}</span></h4>
        <div className="proposal-target"><ArrowRight size={12} /> {event.title}</div>
        <p>{proposal.reason}</p>
        <div className="proposal-foot">
          <StatusPill status={proposal.status} />
          <span>{proposal.distanceHours === 0 ? "inside window" : `${proposal.distanceHours}h from window`}</span>
          {proposal.status === "pending" ? (
            <div className="decision-buttons">
              <button onClick={() => onReview(proposal.id, "confirmed")} type="button">
                <Check size={13} /> Confirm
              </button>
              <button onClick={() => onReview(proposal.id, "rejected")} type="button">
                <X size={13} /> Reject
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function TrackRow({ index, track }: { index: number; track: Track }) {
  return (
    <article className="track-row">
      <span className="track-index">{String(index + 1).padStart(2, "0")}</span>
      <span className="album-art" style={{ "--track": index } as React.CSSProperties}>
        <i />
      </span>
      <div>
        <strong>{track.trackName}</strong>
        <span>{track.artistName}</span>
        <small>{dayLabel(track.addedAt)} · {Math.floor(track.durationMs / 60000)}:{String(Math.floor((track.durationMs % 60000) / 1000)).padStart(2, "0")}</small>
      </div>
      <PrivacyDot value={track.privacy} />
    </article>
  );
}

function PrivacyDot({ value }: { value: Privacy }) {
  return <span className={`privacy-dot ${value}`} title={privacyLabel(value)} />;
}

function PrivacyPill({ value }: { value: Privacy }) {
  return (
    <span className={`privacy-pill ${value}`}>
      {value === "private" ? <LockKeyhole size={10} /> : null}
      {privacyLabel(value)}
    </span>
  );
}

function StatusPill({ status }: { status: Proposal["status"] | LifeEvent["reviewStatus"] }) {
  const label =
    status === "confirmed"
      ? "Confirmed by Author"
      : status === "rejected"
        ? "Rejected by Author"
        : status === "invalidated"
          ? "Date range revised"
          : "Author decision required";
  return <span className={`status-pill ${status}`}>{label}</span>;
}

function ExportDrawer({
  onClose,
  state,
}: {
  onClose: () => void;
  state: StudioState;
}) {
  const [privacy, setPrivacy] = useState<Privacy>("public");
  const markdown = exportJourneyMarkdown(state, privacy);

  function download() {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `aurora-coast-${privacy}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="drawer-backdrop" role="presentation">
      <section aria-labelledby="export-title" className="export-drawer" role="dialog">
        <div className="drawer-heading">
          <div>
            <p className="section-kicker">Local editorial boundary</p>
            <h2 id="export-title">Privacy-safe export</h2>
          </div>
          <button aria-label="Close export" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <div className="export-control">
          <label htmlFor="export-privacy">Maximum privacy level</label>
          <select
            id="export-privacy"
            onChange={(event) => setPrivacy(event.target.value as Privacy)}
            value={privacy}
          >
            <option value="public">Public only</option>
            <option value="friends-only">Friends only + public</option>
            <option value="private">Complete local backup</option>
          </select>
        </div>
        <div className="export-rule">
          <ShieldCheck size={19} />
          <p>
            Pending and rejected proposals are omitted. Confirmed connections appear only when both
            the music trace and source event are allowed at this privacy level.
          </p>
        </div>
        <pre>{markdown}</pre>
        <button className="dark-button full" onClick={download} type="button">
          <Download size={16} /> Download Markdown
        </button>
      </section>
    </div>
  );
}
