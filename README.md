# Storywalker Studio

## Turn fragmented digital traces into an author-controlled journey.

Storywalker Studio is an author-controlled system for reconstructing personal journeys from fragmented digital traces. It correlates music history and life events while preserving uncertainty, privacy, provenance, and human editorial control.

[![CI](https://github.com/adinapirjol/storywalker-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/adinapirjol/storywalker-studio/actions/workflows/ci.yml)

![Storywalker Studio showing the fictional Aurora Coast route and Author-review workspace](docs/screenshots/storywalker-studio-hero.png)

The system is deliberately deterministic first. It does not claim that a song explains an event because their timestamps are close. It proposes a connection, shows the temporal evidence and its uncertainty, and waits for an Author to confirm or reject it.

> **Fictional demonstration data:** Aurora Coast is invented for this public repository. Every song, artist, person, event, note, identifier, and timestamp in the committed demo is fictional.

## Current research: Spatial Rehearsal

`/research/xr` develops WORLD / TIME / MEMORY: geographic calibration, a chronological archive of episode spaces, and Author recomposition with visible geographic ghosts. Private sources stay in the encrypted local Vault; passkey or recovery-passphrase access can resume an interrupted action on the same page.

See the [29 September NOVA report and next tasks](docs/research/xr/nova-report-2026-09-29.md) and [rehearsal guide](docs/research/xr/README.md). The full fictional Aurora Coast immersive preview is available at `/research/xr/aurora-coast`; it needs no Vault. The earlier editorial demo remains available below.

See the [prioritized future work](docs/roadmap.md) for rehearsal goals and the deferred Vault security and usability improvements.

## BODY companion and shared private access

`/research/xr/body` is a creature-first study in warm mineral light and wire form.
Drag, zoom and gentle petting shape its presentation; optional evidence inspection
keeps measurement values, provenance and timing visible without dominating it.
The same pet accompanies the Author on **Apple Watch and iPhone**, with native
SwiftUI apps in [`research/body-context-native`](research/body-context-native/README.md).

| Apple Watch companion | iPhone companion |
| --- | --- |
| <img src="research/body-context-native/Watch/Assets.xcassets/AppIcon.appiconset/AppIcon.png" width="80" alt="Storywalker Watch companion icon"> | <img src="research/body-context-native/iPhone/Assets.xcassets/AppIcon.appiconset/AppIcon.png" width="80" alt="Storywalker iPhone companion icon"> |
| Pet interaction, last registered reading and measurement time. **Start meditation** is the first session action; walking, running and indoor cycling remain explicit choices. | The companion and its reading age stay at the front. Collection, pairing, encrypted transfers and the Mac feed live behind **Connections & data**. |

Meditation starts a HealthKit **Mind and Body workout session** for available live
readings. It does not infer that the Author is resting or promise a Mindful Minutes
record. The Watch sends available readings to the phone; the phone bridges them
to the local web companion. Latest on-device acceptance remains separate from
simulator compilation and synthetic tests.

Watch workout readings can reach the phone through WatchConnectivity; available
HealthKit records remain the fallback. The phone pushes fresh previews to a pinned
local HTTPS receiver, which pushes browser updates through a bounded event stream.
Encrypted archived batches, receipts and explicit evidence acceptance remain a
separate path. Contact, receipt and measurement times are shown independently.
Watch sensing and operating-system scheduling do not guarantee continuous delivery.
This research companion is not an emergency monitor.

All private surfaces share one passkey / recovery-passphrase window. Existing
Vault access from `/vault` uses it too. Sessions expire after 15 minutes, lock on
request and disappear on server restart. Private actions recheck authority before
persistence and release. Passkeys require encryption support (PRF); use the saved
`localhost` address for enrollment and unlock, with recovery access retained.
See [passkey setup](docs/vault-passkeys.md), [auth architecture](docs/auth-architecture.md)
and [code review standards](docs/code-review-guidelines.md). The
[10 October review](docs/research/review-2026-10-10.md) records repairs and checks.
The [release-readiness review](docs/research/release-readiness-2026-10-10.md)
records the repaired consent blocker, remaining risks and manual acceptance checklist.

Vault unlocking uses **WebAuthn passkeys with PRF key wrapping**, retaining the
recovery passphrase. A provider sign-in alone would not unwrap the local Vault
key. OAuth remains the separate mechanism for delegated provider access, such as
Spotify imports; it does not grant evidence acceptance or export consent.

Aurora Coast has a fourth **BODY** view beside **WORLD / TIME / MEMORY**, with
the pet and invented batch timing, threshold and access examples. It starts
paused and is manually explored, with no
real Watch feed, private Vault writes or external telemetry. Cryptographic and
contract tests use synthetic inputs; real-device acceptance remains a separate
check.

![Fictional Aurora Coast BODY companion, paused with rotation, zoom and petting controls](docs/screenshots/aurora-xr-body.jpg)

*Web browser capture from Aurora Coast's fictional BODY tab. Invented inputs only;
playback and sound are stopped. This is a design rehearsal, not live phone or Watch
evidence. The icons above identify the native pair; they are not device screenshots.*

## Why Storywalker exists

Personal archives are fragmented across playlists, timestamps, photographs, notes, tickets, calendars, and memory. Automated storytelling tools often flatten those fragments into a smooth narrative, quietly turning an estimate into a date or proximity into meaning.

Storywalker Studio keeps the seams visible. Exact times remain exact. Day-level memories remain day-level. Approximate ranges remain ranges. A match is a proposal until the Author makes a decision.

## The Author stays in control

The review loop separates machine-verifiable evidence from autobiographical meaning:

```mermaid
flowchart LR
  A["Music history + life events"] --> B["Exact-revision bundle"]
  B --> C["Memory-only preview"]
  C --> D["Explicit deterministic seed"]
  D --> E["Pending LifeEvents"]
  E --> F["Author review"]
  F --> G["Proposed correlations"]
  G --> H{"Author decision"}
  H -->|Confirm| I["Confirmed journey"]
  H -->|Reject| J["Audit history"]
  F -->|Revise date range| G
  I --> K["Privacy-safe export"]
```

No demo data is persisted during preview. Seeding is explicit. LifeEvents begin pending. Editing an uncertain event window regenerates temporal proposals and retains invalidated proposals as audit history.

![The Review desk before any decision: eight pending fictional LifeEvents, twelve synthetic tracks, and zero proposed connections](docs/screenshots/aurora-coast-timeline.png)

## Enter the fictional XR rehearsal

Open `/research/xr/aurora-coast` on your local server. All visits, plays, notebook material and decisions are invented; the map uses public geographic anchors.

1. In **TIME**, choose **Next**, then **Approach** and **Open first visible window**. Cross into the chamber and return to the same corridor.
2. In **WORLD**, orbit the geographic baseline. In **MEMORY**, choose **Time-axis view** and move an episode; its geographic ghost remains visible.
   In **BODY**, rotate, zoom or pet the companion and step through fictional
   measurements manually. **Inspect evidence** reveals the invented values;
   **Batch Aurora 01** keeps its timestamp visible with extra detail collapsed.
3. Inspect the source desk: an ambiguous calendar fragment stays pending, a refused association stays excluded, and an empty listening window remains sparse.
4. Activate the fictional sound choices, then use **Sound & samples** to audition. Sound requires an explicit action; the sample palette is local Kenney CC0 material, not Spotify audio.
5. Download the current scene to preserve your changes. Reload restores the deterministic fixture; it does not write to your private Vault.

![Aurora Coast TIME passage: invented festival windows become entrances to evidence](docs/screenshots/aurora-xr-time.jpg)

![Aurora Coast MEMORY: fictional visits, elapsed time and visible geographic ghosts](docs/screenshots/aurora-xr-memory.jpg)

The private Are.na experiment lives at `/research/arena-field`: open an authenticated snapshot, orbit its references, hold two together, set others aside and save the composition encrypted. Private channel content is never embedded in these screenshots or the public build.

## Explore Aurora Coast

**Aurora Coast — Chapter One: Ten Days in Transit** is a fictional Euro-summer journey set from 18–27 July 2027:

**Ljubljana → Afterlight Fields → Venice → Piran → Vienna → Berlin**

Afterlight Fields is a fictional festival. The chapter moves from unsettled arrival weather and a temporary volunteer community to a quieter coast, then ends on an overnight bus as a birthday approaches.

The committed bundle contains:

- exactly **12 synthetic tracks**, with fictional Spotify-style IDs and metadata;
- exactly **8 fictional LifeEvents**, mixing exact timestamps, bounded ranges, and day-level certainty;
- public, friends-only, and private records;
- competing temporal proposals;
- a suggested rejection;
- an uncertain Venice window that changes after Author input.

The full deterministic proposal set remains available as an evidence ledger, not an equal-priority to-do list. The guided review follows a curated confirmation, rejection, and date-range revision, while the workspace surfaces the 18 most relevant active proposals first.

![After the guided review: one connection confirmed, one rejected, and the Venice window revised, with invalidated proposals kept as audit history](docs/screenshots/author-review.png)

## Try it in under a minute

Requires Node.js 22 or newer. The editorial demo is credential-free. For BODY
contract tests, also prepare the local Python validator as shown below.

```bash
npm ci
npm run demo:aurora-coast
npm run dev
```

Open **http://localhost:3000** for local browsing and Vault passkeys. Page visits
to `127.0.0.1` redirect to the same path on `localhost`. The server remains bound
to loopback so both addresses can reach it; API requests and form submissions
are not redirected or replayed. Existing tabs with unsaved edits should be kept
until those edits are saved; sessions remain specific to their browser address.

When Next.js reports that it is ready, open http://localhost:3000. Choose **Load Aurora Coast Demo**, verify the memory-only preview, then choose **Seed Author workspace**.

No Spotify account, credentials, network connection, private file, or local editorial export is required for the demo.

## Orientation infrastructure: Vault → Atlas Now → Scenario Studio

The local product now has a private orientation path beside the fictional Aurora Coast demonstration:

1. **Vault** (`/vault`) is the consent-first, encrypted local evidence field. Imports, captures, and editorial candidates remain private and pending by default. Unlocking creates a browser-wide local session with an opaque HTTP-only cookie; the key remains only in the local server process and the session expires after 15 minutes or an explicit lock.
2. **Atlas Now** (`/atlas`) makes source changes, explicit wording overlaps, and bounded place readings legible. It is keyword/time retrieval, not semantic RAG, causal explanation, or a recommendation engine. Timeline and saved-place proximity are always candidate evidence, never a confirmed visit or commitment.
3. **Scenario Studio** (`/scenario-studio`) keeps possible routes side by side. The Author can name timing and conditions, draw explicit connections, and independently link or remove Atlas evidence lanes. It stores a revisable private constellation; it never ranks a route, creates an Episode or Journey, or promotes material to public work.

The three surfaces are intentionally interconnected through local record IDs, not through inferred personal meaning. A local clone opens with no private data and remains usable through the fictional demo.

## First run: see the shape, then make it yours

Open `/start` for the first-run path. It is intentionally two-sided:

- **Private Vault** (`/vault`) is the local encrypted notebook for evidence, imports, capture, and retrieval. Its short-lived browser-wide unlock is local to the running server and can be locked explicitly.
- **Atlas Now** (`/atlas`) is the private evidence map. It surfaces only explicit source changes and retrieval overlaps, with uncertainty still visible.
- **Scenario Studio** (`/scenario-studio`) is the private constellation board: routes can overlap and share evidence without being ranked or made canonical.
- **Public Voice** (`/voice`) is an encrypted draft shelf. A person searches their private Vault, deliberately selects up to eight evidence references, writes their own draft, then explicitly exports local Markdown. It never publishes to Medium, Substack, or a portfolio automatically.

The Spotify onboarding contract is read-only: it will use the connected account's recently played tracks and recommend up to four playlists owned by that account, excluding collaborative playlists by default. The selection is always shown for confirmation. A local clone remains fully usable in demo and import mode; frictionless provider authorization needs a registered OAuth client and a deployed/shared redirect configuration, which are intentionally not committed.

Google Maps Timeline and ChatGPT history are local, user-selected exports in this release. They are not treated as background account scraping. Any future external-model editor must remain a separately consented operation over a selected, redacted evidence window; it may not promote a correlation to fact or publication.

## What the demo proves

- **Deterministic correlation** — identical confirmed inputs produce the same proposals and ordering.
- **Exact-revision validation** — all bundle documents must share the expected schema revision and counts.
- **Uncertain time ranges** — exact, day-level, exact-range, and approximate-range evidence stay distinct.
- **Competing proposals** — one music trace may be temporally close to more than one event.
- **Privacy levels** — public, friends-only, and private material pass through an explicit export boundary.
- **Author confirmation** — only confirmed proposals can appear as connections in an export.
- **Author rejection** — rejected proposals remain non-canonical.
- **Regenerated proposals** — changing the Venice window invalidates a stale overlap without deleting its audit record.
- **Safe export** — pending, rejected, and out-of-scope private material are excluded.

![Privacy-safe Markdown export after Author decisions](docs/screenshots/confirmed-export.png)

## Use your own Spotify history

Spotify import is optional and server-side. Credentials and tokens never enter the browser bundle. The current importer reads playlist addition history available through Spotify’s Web API; it does not claim access to a complete lifetime listening history.

```bash
cp .env.example .env.local
# fill in the three variables locally
npm run spotify:authorize
npm run spotify:import -- --playlist YOUR_PLAYLIST_ID
```

Imported material is written beneath `private-data/spotify/` as an ignored `*.private.json` file. It is never required by Aurora Coast and is never committed by default. See [Spotify import and deletion](docs/spotify-import.md) for scopes, setup, storage, and deletion.

## BODY research events and Logfire

In `/research/xr/body`, choose **My private HealthKit data** and open
**Unreviewed live research telemetry · thresholds & context**. Its separate export switch controls
new research candidates in the explicitly configured EU Logfire project.
Set `STORYWALKER_HEALTH_PROJECT_URL` in ignored server configuration; without a
valid target export fails closed. The credential must match that exact project.
Reviewed-batch summaries have a separate session switch and per-batch export action.
Staging stays private and pending; Accept saves evidence without authorizing export.
After enabling reviewed exports for the current Vault session, review an accepted
batch and choose **Export this reviewed summary to Logfire** to consent to that send.
Pending/deleted batches cannot use that action. Live-window summaries are disabled.
Legacy summary/event settings are not migrated: both feeds require explicit
reconfirmation of the new scope. Restart or expiry requires a fresh enable action.
See [the health export consent contract](docs/research/health-export-consent.md).

The illustrative research markers are at least 120 bpm and below 50 bpm, with
two distinct supporting observations, gaps of at most 60 seconds and an explicit
Author report of being awake and resting. They are not personalized danger limits,
diagnoses or emergency notifications. Rest confirmation applies prospectively,
expires after ten minutes and clears when the receiver stops. Clear it when activity
changes. No resting state, stress, anxiety or relaxation is inferred from BPM.

The resting baseline starts **unset**. Relative elevation (+30 bpm) and sustained
sampled elevation (+20 bpm across five minutes) require a baseline supplied from
reviewed resting evidence. Review approximately 7–14 days when adequate context is
available; sparse observations cannot establish continuous coverage. The rapid-change
marker compares consecutive Watch-attributed observations from the same source:
at least +30 bpm with a comparison gap no greater than two minutes and no reported
poor-signal flag. This is an observed delta, not certified sensor accuracy.

Pydantic validates locally in an isolated subprocess; deterministic rules evaluate
fresh Watch preview observations, no more than two minutes old. Incoming historical
batches do not trigger this exporter. Timestamp watermarks suppress repeated live
measurements.
Missing data resets supporting runs but does not prove recovery. A 5 bpm return
margin and five-minute per-marker cooldown limit repeated episodes. Candidates are
grouped for 60 seconds before export. All these settings are editable.

Only candidate kind, configured marker, extreme or delta, count, source class,
context/support labels and measured/app-receipt time windows leave the Mac. These
remain sensitive health-derived data despite minimization. No raw packets, source
or device identifiers, notes, location or musical history are exported; no LLM is
called. Rules/configuration and credentials stay under ignored `.logfire/storywalker/`.
Evaluation state, rest context and pending candidates are bounded and memory-only.
Stopping or receiver expiry drops pending candidates; it cannot recall events already
sent to Logfire. There is no persistent delivery outbox or guaranteed delivery.
Historical review stays local and is never automatically backfilled to this feed.
No event accepts evidence, clears the phone queue or creates canonical memory.

**Send fictional connection test** checks the exporter without using a personal
reading or enabling the feed. Its Logfire event carries `synthetic_test=true`;
exclude that flag when querying actual research candidates. Successful ingestion
does not establish a real Watch threshold crossing or continuous monitoring.

Validation covers context gating, baseline requirements, source preference,
deduplication, stale/future data, missing coverage, cooldown/recovery, partial
ingestion rejection, session expiry and cancellation. Run the focused checks with:

```sh
npx vitest run lib/body/health-threshold.test.ts lib/body/context-summary-route.test.ts lib/body/health-summary-security.test.ts
research/rehearsal-dramaturg/.venv/bin/python -m pytest research/rehearsal-dramaturg/tests/test_health_events.py -q
```

## Architecture

```text
Committed fictional bundle
        │
        ▼
Zod revision + schema gate ──► memory-only preview
        │
        ▼ explicit action
Local Author workspace ──► deterministic correlation
        │                         │
        │                  pending proposals
        │                         ▼
        └──────────────► Author decisions
                                  │
                                  ▼
                         privacy-filtered Markdown

Optional Spotify CLI ──► ignored private-data/ directory
        (Node only; never imported by the browser app)

Private Vault ──► Atlas Now ──► Scenario Studio
  encrypted local       retrieval-only      revisable constellation
  consented sources     evidence lanes      no ranking or promotion
```

The domain and transformation functions live in `lib/`. The Next.js client is a review surface over those pure functions. `localStorage` is used only after explicit demo seed and is described honestly as demo persistence, not durable archival storage. The separate Vault is an encrypted local SQLite store under ignored `private-data/`; it is never part of the demo bundle or browser build.

Read [the authentication architecture](docs/auth-architecture.md), [the architecture note](docs/architecture.md), [privacy model](docs/privacy-model.md), and [orientation release notes](docs/release-notes.md) for the boundaries in detail.

## Local private recovery staging

Recovered personal evidence belongs only under ignored `private-data/storywalker/`. The recovery importer is dry-run by default and requires absolute paths for the machine-readable ledger plus its three human-review companions:

```bash
npm run private:import -- recovery --ledger /absolute/path/ledger.json --author-review /absolute/path/review.md --gaps /absolute/path/gaps.md --import-prompt /absolute/path/import-prompt.md
# only after reviewing the report
npm run private:import -- recovery --ledger /absolute/path/ledger.json --author-review /absolute/path/review.md --gaps /absolute/path/gaps.md --import-prompt /absolute/path/import-prompt.md --write-private
```

The ledger is the source of truth. Companion files are staged as provenance and unanswered-question context; they never silently rewrite a ledger record. The importer merges by stable Moment ID, preserves prior local decisions, creates an explicit private conflict instead of overwriting changed reviewed evidence, and creates no Episode. Playlist IDs are retained without Spotify share parameters; an application, planned set, or playlist entry is not evidence of submission, attendance, or playback.

The local review route is intentionally separate from Aurora Coast. It keeps evidence decisions, proposal refusals, exclusions, contradictions, and unknowns private; accepting evidence does not accept an editorial proposal or canonise a Moment, Journey, Thread, or Episode. To remove staged data safely, stop the local server and delete only the specific ignored `private-data/storywalker/` recovery file you no longer need. `npm run audit` checks committable paths and, when a staged recovery is present, also verifies that its IDs and source phrases do not appear in public files.

## Research Lab — CTM 2027 preparation

`/research` is a restrained, public practice-based artistic-research layer. It tracks verified CTM 2027 call facts (checked 23 August 2026), separates those facts from working inferences, and keeps the current question provisional:

> **Refusal Is an Editorial Act: Who Gets to Author the Memory?**

It includes two small, fictional experiments. They do not introduce an external model, a user account, analytics, or a public autobiographical timeline.

- **Experiment 01 — Refusal:** a fictional Aurora Coast proposal can be accepted, revised, or refused. Each response changes a visual trace and a copyright-safe synthetic audio consequence; the experiment remains outside the canonical journey export.
- **Experiment 02 — Locative Echo Lab:** a browser-only study of circular GPS geofences and sound triggers, inspired by general locative-audio practice. Its desktop simulation requires no map or external service. Live location is opt-in, in-memory, accuracy-aware, and stopped on pause, exit, and unmount.

Run `npm run dev`, then open `/research`, `/research/refusal`, or `/research/echo-lab`. Audio and GPS are optional: each experiment has textual alternatives and manual controls. The experiments demonstrate bounded interaction mechanics, not proof that a song explains a memory or that location proves meaning.

Public research templates and the dated 23 August 2026 checkpoint are in [`docs/research/ctm-2027/`](docs/research/ctm-2027/). Private notebook entries, local audio selections, personal imports, and Author decisions remain ignored local material.

## Repository structure

```text
app/                         Next.js routes, local API, and visual language
components/                  Feature-owned UI (see components/README.md)
examples/aurora-coast/       Committed fictional demo bundle
lib/                         Feature-owned contracts, domain operations and colocated tests
scripts/                     Demo verification, privacy audit, optional local import tools
docs/                        Architecture, privacy, demo, import, and release notes
.github/workflows/ci.yml     Credential-free quality gates
```

## Testing and quality checks

The full JavaScript suite calls the local Pydantic validator. Install Python
3.11–3.14 and uv, then prepare its ignored environment from the committed lockfile:

```bash
uv sync --frozen --project research/rehearsal-dramaturg
(cd research/rehearsal-dramaturg && .venv/bin/python -m pytest tests -q)
npm test
npm run typecheck
npm run lint
npm run build
npm run audit:public
npm run audit:build-private
npm run audit
```

`npm run audit:public` checks visible repository files for forbidden private paths, tracked token caches, private JSON, absolute user paths, selected private-journey markers, and common credential-shaped values. It is a focused backstop, not a substitute for human review.

CI prepares both lockfile-enforced runtimes and runs the Python, JavaScript, type,
lint and public build audits without personal credentials. On macOS, also run
`swift test --package-path research/body-context-native` for the collector core;
this does not install a device build.

## Design principles

- **Deterministic first.** Generate reproducible evidence before interpretation.
- **Uncertainty is data.** Do not promote an estimate into a fact.
- **The Author decides meaning.** Temporal proximity is evidence, not autobiography.
- **Privacy is structural.** Filter at ingestion, persistence, and export boundaries.
- **Provenance survives edits.** Revised proposals leave an audit trail.
- **A notebook, not a dashboard.** The interface favors reading, attention, and editorial calm.

## What this project demonstrates

Every claim below is checkable in this repository:

- **Deterministic data systems** — a pure correlation pass in `lib/studio/correlation.ts` produces identical proposal IDs and ordering for identical confirmed input, verified in `lib/studio/demo.test.ts`.
- **Temporal uncertainty modelling** — exact, day-level, and ranged evidence stay distinct from schema (`lib/studio/schema.ts`) through review to export, and are never silently promoted to facts.
- **Human-in-the-loop interaction design** — `lib/studio/review-state.ts` and the workspace in `components/` make Author confirmation, rejection, and date revision the only path from evidence to narrative.
- **Privacy-aware architecture** — explicit filters at ingestion, encrypted local persistence, Atlas derivation, and export boundaries, documented in [the privacy model](docs/privacy-model.md).
- **Server-side API integration** — the optional Spotify importer lives in Node-only modules, with `lib/privacy/browser-boundary.test.ts` proving credentials never reach the browser bundle.
- **Reproducible verification** — credential-free CI, a deterministic fixture check, and a public-repository audit script in `scripts/`.

## Roadmap

- Scenario snapshots and source-ID references beyond the single current constellation.
- Author-readable curation queues for pending captures and bounded Timeline evidence.
- Additional consented local adapters for photographs and notes.
- A separately consented semantic retrieval adapter, with an inspectable preview and no automatic promotion.
- Portable encrypted project bundles and a documented restore/migration path.

## Open source

Storywalker Studio is released under the [MIT License](LICENSE). Contributions are welcome through [CONTRIBUTING.md](CONTRIBUTING.md); security reports follow [SECURITY.md](SECURITY.md).

Created by [Adina Pirjol](https://github.com/adinapirjol).
