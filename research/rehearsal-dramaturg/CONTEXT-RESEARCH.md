# BODY–WORLD–TIME–MEMORY

The working local slice is **A context window, then a deliberate reading** in Scenario Studio and `/research/xr`. All generated observations are explicitly fictional, dated in 2030. A sampled body threshold bookmarks context; the Author may reflect, accept, revise, refuse or leave meaning unresolved. Accepted accounts are versioned, linked to evidence and decisions. Canonical means Author-approved, never scientific proof of physiology, emotion or causation.

## Run

From the repository root, in two terminals:

```sh
uv sync --project research/rehearsal-dramaturg --frozen
uv run --project research/rehearsal-dramaturg uvicorn dramaturg.app:app --app-dir research/rehearsal-dramaturg --host 127.0.0.1 --port 8765 --no-access-log
npm run dev
```

Open `http://localhost:3000/scenario-studio`. The frontend and processor bind to loopback. No account, API key, Vault passphrase, headset, Watch or audio permission is necessary. Keep the default telemetry-off configuration. The processor reads a local protected authentication token created by the Next adapter, never a Vault key. Do not expose these development servers through a tunnel.

```sh
uv run --project research/rehearsal-dramaturg pytest research/rehearsal-dramaturg/tests -q
npm run typecheck
npm test
npm run lint
npm run audit:public
PYTHONPATH=research/rehearsal-dramaturg uv run --project research/rehearsal-dramaturg python research/rehearsal-dramaturg/scripts/contracts.py
```

`uv.lock` pins Python dependencies; package-lock.json pins frontend dependencies. Generated `lib/context/context-contract.ts` and `lib/context/context-contract.schema.json` come from Pydantic serialization schemas; do not edit them separately. Strict JSON-boundary validation rejects coercible invalid scalars, unknown fields, nonfinite numbers, naive timestamps and invalid references. Heart readings must satisfy the research plausibility envelope 0 < BPM <= 300; these are data-quality bounds, not clinical alarm thresholds. Native HealthKit ingestion also enforces the documented 120-second clock-skew policy without rewriting source timestamps; see `docs/research/health-export-consent.md`. Parsing Apple units/dates happens in its explicit adapter before validation.

## Five-minute walkthrough

1. Reset the **scenario sandbox only**. Step ten deliveries: normal observations become a sampled fictional threshold crossing, with an original cue label, approximate stale geography and missing activity at the trigger. Inspect measurement and receipt times. Sample coverage is not emotional confidence.
2. Add a fictional reflection, save it, then Accept the proposed reading. MEMORY receives version 1, tied to the exact approved context revision.
3. Step through the delayed heart measurement, marker and duplicate burst. Evidence joins by measurement time; duplicate stable IDs are ignored. Late evidence creates a new context/proposal revision and flags old memory for review without replacing its approved revision.
4. Write a revised account and choose Revise. Inspect version lineage and decision history. Continue until window 2 appears, select it and Refuse its proposal: evidence remains while the meaning relationship changes. Leave another reading unresolved if desired.
5. Open `/research/xr`, choose **Present evidence in the room**. The existing renderer shows silent WORLD, TIME, BODY and MEMORY cues, at most three windows/twelve cues. Inspect their text alternatives and decisions. Move a MEMORY slider deliberately; placement is persisted composition, not a location claim. Delete the fictional body source and observe support invalidation, removed body values and retained minimal decision history. Reset restores only this fictional scenario. Play/Pause and 1×/5×/20× change delivery pace, not temporal matching or capture semantics.

## Boundaries and stores

| Component/store | Responsibility, ownership and retention |
|---|---|
| Pydantic | Authoritative versioned contracts, strict validation and referential integrity. JSON input is bounded to 1 MB, state to 512 observations/32 captures/64 proposals/128 decisions and memories. No Python database or plaintext checkpoint. |
| pydantic-graph | Actual Validate → Execute/Deduplicate → Join → Evaluate → Review or explicit Author branch. Returns states such as insufficient-context, waiting-for-more-data, awaiting-Author and refusal. Checkpoint persistence belongs to the encrypted adapter, not the library. Invalid inputs return sanitized error codes without logging payloads. |
| Existing encrypted Vault code | Same AES-256-GCM record encryption. Fictional sandbox has separate `private-data/context-sandbox/scenario.sqlite` and protected random key, mode 600, directory 700. This is a disposable sandbox, never a second autobiography store; it never reads personal sources. Reflections written there remain local/encrypted. Reset replaces the scenario checkpoint. Real historical imports are staged/reviewed inside the existing passphrase-encrypted personal Vault. No passphrase/key crosses to Python. |
| Next local adapter | Serializes scenario writes, checks revision, same-origin mutation and HttpOnly local 15-minute session, authenticates processor packets. Reads one encrypted checkpoint, never reloads the personal Vault or rebuilds Atlas per delivery. A response lost after persistence requires refresh; stale retry cannot duplicate a capture. |
| PydanticAI | Optional typed selected-packet function, default disabled, configured model required. Its input contract excludes health/location/Spotify and unrestricted source packets. Tests use TestModel, no external calls. Not connected to automatic capture or canon. No provider credentials configured; enabling a public provider needs a separate eligible preview/permission review. |
| Logfire | Existing optional metrics-only transport uses an explicit fixed attribute allowlist for operational duration/outcome; no model instrumentation, payloads or validation exceptions. BODY processing also has an optional closed-vocabulary count/latency adapter (`BODY_CONTEXT_TELEMETRY=1`), with no event-time metadata or input content. Telemetry stays off; no account connection performed. |
| XR | Existing silent room cue renderer and text review, selected evidence/Author relationships only. Does not create Journeys, Episodes, life facts, public drafts or scientific explanations. WORLD is approximate source context, TIME is chronology/window revision, BODY is labelled bpm, MEMORY is deliberate meaning and placement. |
| Native queue | Platform-protected local pending deliveries/anchor; see native README. Opt-in paired local HTTPS transport; explicit Health read/collection controls. No iCloud health storage. |

Sandbox data remains until reset or the ignored sandbox directory is explicitly removed by its owner; no automatic retention daemon. Do not put real health data into the sandbox. Browser state is in memory, no localStorage. Historical staged sources remain encrypted until reviewed/deleted. Review deletion removes chunk records and manifest, with no payload tombstone. Sandbox source deletion removes observations and all copied references, preserves generic proposals/Author-written account history, and invalidates support. Author text is its own statement, not a retained raw source copy. No imported source is linked into this sandbox, so deleting imported evidence currently has no canonical sandbox derivatives.

## Matching and capture

UTC-aware comparisons retain original offset/semantics and receipt time. Context uses a documented ±5-second interval tolerance. An approximate location recorded up to 120 seconds before the trigger may be retained as stale context; age over 30 seconds is visibly stale. No route, venue, playback interval or playlist is inferred. Activity is known at the trigger only when its interval covers the trigger. Listening must carry the original/Author-marker/fictional policy discriminant; Spotify is rejected at validation.

The fictional high rule is 120 bpm for a 30-second **sampled span**, with maximum 10-second gaps, reset at 110 bpm and 60-second event-time cooldown. These numbers are demonstration values only. The general Rule contract defaults disabled with threshold unset; high/low evaluation is supported. The demo selects one rule; the contract supports up to five configured rules. Overlap precedence is priority, rule ID, then version; all simultaneously eligible rules latch the burst, producing one bookmark. Contextual baseline history is not enabled. A baseline cannot treat unknown activity as rest. All capture notifications are hard-disabled in this slice, including simulated, imported, delayed and historical records. No emergency monitoring or native Apple alert is implemented.

The bounded buffer persists start/end indexes and uses binary-search interval queries; this implementation does not enable continuous real collection or unbounded historical replay. Requests exceeding bounds are rejected rather than silently dropping evidence. Retention/capture pipelines for real sources remain disabled. No claim of production continuous collection is made.

## Historical Apple Health import

The importer streams XML/ZIP, forbids DTD/entities/external references, rejects unsafe archive paths/symlinks, bounds archive entries/bytes/records, preserves source dates/units/revisions, supports cancellation in the Python iterator, and accepts heart-rate `count/min` records only. It never emits alerts. The local staging pipe emits validated batches of 100 to the existing encrypted Vault; it has an additional 10,000-observation selection limit. Large exports may be rejected: select a smaller source export rather than raising limits blindly. Invalid chunks are not printed. Each encrypted batch updates a staged manifest atomically. A killed process can leave a visible incomplete staging entry; review can delete it, and acceptance is refused until staging completes.

```sh
node --import tsx scripts/stage-health.ts /absolute/path/to/export.xml
# Or an explicitly selected export.zip; no automatic discovery of private exports.
```

Enter the existing Vault passphrase locally. Then **Private Apple Health import review → Open staged imports → Preview → Accept source evidence**. Unlock uses the existing browser Vault session; source acceptance remains separate from interpretation. Deleting the stage removes its encrypted source chunks. This task tested synthetic XML, unsafe XML rejection and cancellation; it did not import the user's health data. Historical source review is implemented, but correlating selected accepted real imports into a private context-replay workspace remains a separate disabled stage.

## Spotify and external processing

Proposed use would have correlated Spotify listening with physiology, placed sound alongside XR visuals, or sent content to an Editor. Spotify Developer Policy III.13 restricts analysis/profiling of Spotify content/service/users, III.14 restricts AI ingestion, and III.6 prohibits synchronizing recordings with visual media. An export, consent or renamed source does not remove those constraints. This feature has no Spotify adapter/token/scopes/endpoints, playback, AI ingestion or physiological/emotional scoring. Existing unrelated Storywalker integrations are not used by this pipeline. Any future permitted display-only branch must stay isolated and verify current endpoint/scopes, timestamp meaning, attribution, retention and disconnect requirements before implementation.

## Migration and rollback

No personal Vault schema or encryption migration. Encrypted file persistence now flushes a private temporary file and atomically renames it; source removals vacuum discarded encrypted pages before persistence. One optional storage-path field lets the same record encryption persist the separate fictional sandbox. Historical imports add encrypted reference records and explicit review status. Generated schemas are version 1. Roll back by reverting these feature files and UI integrations; leave the personal Vault intact. Sandbox reset does not delete personal imports. Encrypted imported records remain available to the existing Vault adapter; remove only selected `health:stage:` records through review if wanted. Native source has never run on a device here.

Official references checked: [Pydantic](https://docs.pydantic.dev/latest/), [Pydantic Graph](https://ai.pydantic.dev/graph/), [PydanticAI](https://ai.pydantic.dev/), [Logfire/Pydantic](https://logfire.pydantic.dev/docs/integrations/pydantic/), [HealthKit](https://developer.apple.com/documentation/healthkit), [HKAnchoredObjectQuery](https://developer.apple.com/documentation/healthkit/hkanchoredobjectquery), [Core Location](https://developer.apple.com/documentation/corelocation), [Apple App Review 5.1.3](https://developer.apple.com/app-store/review/guidelines/#health-and-health-research), [Spotify policy](https://developer.spotify.com/policy), [Spotify terms](https://developer.spotify.com/terms).

## Private Vault subset rehearsal

The XR page now has **One window, several possible readings** above the fictional
BODY scenario. Unlock the Vault at the same local origin, open private demo
sources, select one to three existing grounded XR windows, and prepare them.
This view uses the existing encrypted `xr:spatial-draft:v1` record; it does not
scan raw account exports, perform new matching, or create Journeys or Episodes.
It excludes listening profiles, music cues, the broad evidence archive, and BODY
measurements. Existing geography, timing uncertainty, and attached Author,
calendar and Notion context remain inspectable through the existing XR renderer.

`xr:subset-demo:v1` stores only selected window IDs and the source scene's SHA-256
revision in the existing encrypted Vault. Reopening reconstructs the view from
that scene. If it changes, the selection must be reviewed again. The original
scene is unchanged. Rehearsal placement edits remain tab-local and are discarded
on reopen; this panel does not promote canonical memory or save Author decisions.
No new database, plaintext private export, external AI call or telemetry is used.
Source support is inherited from the existing draft, not freshly verified against
external accounts. This is a private inspection demo, not historical BODY replay.

Five-minute demonstration: inspect one WORLD source, compare its TIME bounds and
uncertainty, explicitly show absent BODY evidence, try a deliberate MEMORY move,
then leave an open question. All source-linked content remains private; use the
separate fictional scenario for a public presentation.

Validation: `npx vitest run lib/vault/vault-demo.test.ts lib/http/local-origin.test.ts
lib/vault/vault-session.test.ts lib/vault/vault-access-route.test.ts`. No storage migration is
needed. Rolling back the panel and its API leaves a harmless encrypted selection
reference; it does not require changing the Vault encryption or source records.

## BODY composition design preview (8 October 2026)

In `/research/xr`, open **BODY composition · spherical companion**, then **Show fictional design sample**. This read-only sample is generated from the existing Pydantic/pydantic-graph replay, without changing the encrypted scenario checkpoint or its decisions. Return to saved rehearsal evidence to inspect refusal, revision and source deletion. The prototype uses the existing perspective renderer; it is not a separate exported 3D asset or a headset experience.

The solid ring scales a selected heart-rate reading from 0–200 bpm; the dashed ring independently scales fictional musical tempo from 0–400 BPM. Exact values remain in the text/table. Controls support keyboard sample selection and manual rotation, with no automatic animation, audio or heartbeat motion. A tempo is displayed only for one overlapping permitted fictional marker; multiple markers remain ambiguous. The new optional tempo and city/country fields are generated from Pydantic; older packets default to unknown.

City/country grouping requires explicit labels, consecutive captured windows and the chosen time gap. Stale, missing and ambiguous geography never bridges groups. Overlapping window durations are counted once; captured context duration is not dwell time. Coordinate-distance grouping is not implemented. At most three windows are displayed. HealthKit/private Vault sources and Spotify are excluded by the presentation adapter; changing shape does not relax that boundary. A game-pet form and an Author-entered musical taste map remain design proposals.

Regenerate the contracts and read-only public fictional sample:

```sh
cd research/rehearsal-dramaturg
PYTHONPATH=. .venv/bin/python scripts/contracts.py
PYTHONPATH=. .venv/bin/python scripts/body_preview.py
```

No storage migration or encryption change is required. Remove the new BODY component/adapter and optional contract fields to roll back the presentation, regenerating contracts; existing retained evidence remains encrypted and unchanged.

### BODY evolution and rhythm-field rehearsal

Open `/research/xr/body` for the standalone fictional preview, without loading or refreshing an existing private scene. Select **Fin companion** or **Orb**, then **Play BODY evolution**. Rewind, Next measurement and the sample slider work without animation. Playback advances by measured event-time gaps at 1×/5×/20×, stops at the last sample and pauses when the page becomes hidden. Values are never interpolated or written back. Fin reach scales the current 0–200 bpm display value; a trail shows up to eight previous samples. Neither shape nor colour represents emotion, fitness or personal growth.

**Animate field while BODY plays** is optional and off initially. Its manually set 40–160 BPM seed drives a slow quarter-time visual envelope, bounded to 0–4% geometric expansion. Fast-forward does not accelerate this envelope. It is a fictional design palette, not extracted audio bass or a persona derived from Spotify exports. No Spotify history is read, clustered, correlated or sent to AI. OS reduced motion disables automatic playback and field movement; manual stepping and the evidence table remain available. There is no audio or flashing. Pausing settles the field.

The evolution controls are ephemeral browser state. No additional database or migration is introduced; source deletion in saved rehearsal still removes the displayed support. The standalone sample remains explicitly separate, generated from the fictional workflow rather than resurrected source data.

### Private BODY review (2026-10-08)

`/research/xr/body` now separates **Fictional design preview** from **My private
HealthKit data**. In the fictional preview the field-motion checkbox is beside
Play. The private view reads one accepted HealthKit batch from the existing Vault
through the local authenticated `/api/context-native` boundary. Pending, simulated
and deleted batches cannot be selected as real evidence. No source is copied into
ContextState, public scenes, canonical memory, fixtures, logs or AI inputs.

**Load accepted HealthKit batches → Use HealthKit batch → Play BODY evolution**.
Optional **Evaluate selected history with Pydantic** runs a bounded isolated Python
process; the server loads authoritative evidence rather than trusting client-supplied
observations. Pydantic validates both observations and rule; pydantic-graph executes
the historical review. Editable journal starting settings: upper 130 bpm, lower off,
60 seconds, 3 distinct measurement times, gaps at most 30 seconds, 5 bpm recovery
margin and 300-second cooldown. These are editorial capture settings, not personal
medical limits or an exercise classifier. Age estimates are not used in processing.

Markers are deterministic, temporary, await Author interpretation and issue zero
notifications. Evidence is ordered by measurement time, with duplicates removed;
separate sources and gaps cannot supply continuous coverage. A marker includes a
30-second context margin on each side; batch edges may truncate support. Evaluation
is within one batch, not a claim of complete longitudinal coverage across transfers.
No lower limit is automatically inferred. No Apple high/low notification is consumed.

The current selected batch is re-read every 15 seconds while visible. Lock/expiry,
revision mismatch, deletion or a failed refresh clears the display; tab hiding and
unmounting clear selected evidence. No browser storage or persisted derived marker
copy is created. Revocation in another tab can take up to one refresh interval to
appear. No database or Vault encryption migration is needed. Roll back by removing
the private BODY UI/adapter and `body-review` action; existing evidence is unchanged.
Contracts are generated with the existing `scripts/contracts.py` command; dependencies
and frozen lock remain unchanged. New tests: `tests/test_body_review.py`,
`lib/body/private-body.test.ts` and the private BODY case in `lib/native/native-transfer.test.ts`.

The physical phone collector already supports saved opt-in, observer delivery,
anchored recovery and stop. It must be installed and enabled on the paired iPhone.
Mac delivery now also has opt-in certificate-pinned HTTPS pairing and automatic
receipt retrieval. Fictional Swift-to-Mac networking is verified; physical phone
network delivery remains to be checked. See `../body-context-native/README.md` for
pairing, session expiry, retention and device checks. Never expose the
Python service or remove same-origin/Vault checks to approximate it. Current browser
inventory: two accepted simulated batches, no real HealthKit batch. First real source
transfer and physical background behaviour remain unverified.
