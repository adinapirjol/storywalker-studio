# Claude review brief — private sources, HEALTH and Listening Again XR

Prepared 19 October 2026. Independent review is pending. This document is a
review request and evidence map, not a security approval.

## Scope and revision

Review the complete PR diff against preparation base
`8f0754c0a6353f3a732c99706f39d7987b330e92`. Use the proposed head SHA recorded
in the PR description and report the exact SHA examined. The Author chose to
include all current committable development changes, including Vault, Watch,
HEALTH, research review and XR. The earlier documentation-only scope no longer
applies. Historical validation documents retain their original dates; the PR
validation receipt records checks of this expanded snapshot.

The public review package contains implementation, fictional fixtures, research
notes and locally vendored tracking models/runtime. It excludes private-data,
credentials, exports, audio recordings, Ableton projects and production receipts.
The IOANA/Ableton/XR progress in the direction file is a bounded account of
Author-confirmed local trials; it does not distribute the source or sampled mix.

## Review method and threat assumptions

Follow [the review policy](../code-review-guidelines.md). Review public source
and fictional fixtures only. Do not unlock a Vault, inspect private folders,
request personal records or recordings, call accounts, start the real receiver,
change pairing/permissions, install a native build, or enable external export.
Use temporary storage and fictional identities for reproductions. Account
collector behavior may be tested with stubbed responses, not live accounts.

Treat browser requests, staged inputs, connector responses, local file paths and
native packets as untrusted. Assume cross-origin requests, stale tabs, expired or
rotated sessions, interrupted writes, concurrent collectors, delayed/replayed
packets, network address changes and permission cancellation. State the limits
of protection against another process running as the same local OS user; do not
silently assume local file permissions prevent all such interference.

## Prioritised review map

1. **Vault authority and unlock effects.** Examine `app/api/vault/route.ts`,
   `app/api/vault/passkeys/route.ts`, `lib/vault/vault-access.ts`, the existing
   route/session guards, and `lib/automation/unlock-sync.ts`. Check origin and
   cookie policy, rotation, expiry during asynchronous work, key cleanup,
   rechecks before writes and release, and truthful handling of sync failures
   after successful authentication. Unlock is not consent to new sources.
2. **Automatic collection and encrypted ingestion.** Examine
   `app/api/private-sync/route.ts`, `lib/automation/`, `scripts/lastfm-import.ts`,
   `scripts/calendar-stage.ts`, `scripts/private-month-delta.ts` and the existing
   Spotify importer. Check disabled defaults, permitted identities, selected-only
   Calendar refresh, deselection, fail-closed manifests, bounded reads/pagination,
   windows, symlinks/permissions, locks, atomic writes and preservation after
   partial failure. Staging is local plaintext, not encrypted ingestion. A
   scheduled task alone proves neither a completed collection nor Vault storage.
   Check deduplication, stale/future input rejection, backups, receipts, and
   exclusion of administrative/backup records from Atlas and retrieval. Last.fm
   completed listening and Spotify playlist membership must remain distinct.
3. **Watch delivery, consent and network repair.** Examine
   `lib/native/native-receiver.ts`, `lib/native/native-transfer.ts`, receiver
   routes/components, TypeScript/JSON/Python transfer contracts, and the native
   collector/iPhone changes. Check authenticated pairing ownership, TLS pinning,
   acceptance scope, replay/deletion ordering, durable receipts, queue bounds,
   backpressure, cancellation and session loss. Resumption must preserve saved
   consent. Explicit address repair must retain pairing identity and queued data,
   preserve the previous configuration, and require the updated phone pin. It
   must not enable export or reset pairing. Physical acceptance is separate from
   test success; do not infer delivery from a listening socket.
4. **HEALTH data, research and recovery.** Examine `app/api/health-*`,
   `lib/health/`, `components/health/`, and native sleep mapping. Check bounded
   XML/ZIP parsing, rejected external entities, timezone/missingness handling,
   overlap union and source selection. Measurements, self-report and descriptive
   calculations must stay separate from interpretation. Cycle context is dated,
   optional and excluded unless explicitly included; no automatic hormonal,
   diagnostic or medication interpretation. Trace native deletion through derived
   note history. The synthetic archive/recovery key is separate from personal
   Vault recovery: inspect key separation, concurrency/revisions, filesystem races,
   uncertain commits, restore compatibility and deletion. Never reuse any exposed
   recovery code or treat credential replacement as compromise recovery.
5. **Private evidence and Author decisions.** Examine connected review storage,
   candidate/Control Room import, research persistence and affected Vault routes.
   Check provenance validation, selected import consent, repeat safety, retained
   decisions, bounded pagination, stale revision conflicts, expiry/cancellation,
   and errors after successful persistence. Accept/Revise/Refuse and unresolved
   states must remain distinct. Planned Calendar activity is not attendance;
   listening traces are not lived meaning or accepted interpretation.
6. **XR resource ownership and truthful controls.** Examine sound-shape audio,
   hands and microphone modules, head/finger/gesture tracking, renderer changes,
   worker/runtime and UI. Camera/microphone must be explicit opt-in and temporary;
   cancellation, blur, hidden pages, navigation, late permission results and
   teardown must stop owned resources. Audio stays local; unchanged playback
   rate preserves the input tempo but does not establish an arbitrary file is
   148 BPM. Nearby level influences form, without transcription or recording.
   Check fallback controls, file/decoded-audio limits and reduced motion. Current
   shaping controls a rendered mix; live Ableton, stem control and saved gestures
   remain future work. Model/runtime provenance is in the vendor README/license.
7. **Publication and deployment boundaries.** Review tracing exclusions,
   compiler/lint exclusions, browser dependency checks and privacy audits. Verify
   private inputs cannot enter public bundles, prerender output, server deployment
   traces, logs or public fixtures. Check that source-only review adds no private
   binary/artifact. The supplied HEALTH preview is explicitly synthetic.
8. **Creative argument and status.** Read the revised 13 October direction and
   supporting CTM notes. Keep the rejected earlier audio cut visible as disputed;
   do not invent the mismatch cause. Later passage/keyboard/XR confirmation is
   formative first-person acceptance, not clinical, accessibility or participant
   research evidence. Submission, later-date revisit and public sample release
   remain unverified/unapproved. Historical reports do not validate this head.

## Requested output and merge gate

Report actionable findings first, with severity, file/line, supporting evidence,
reproduction where feasible, and a concrete correction. Distinguish material
findings from preferences and explicitly list checks/source claims not verified.
If no actionable finding is identified, say so without implying zero risk.

Record reviewer, report link or sanitised report, reviewed SHA, findings,
fix/regression-test mapping, limitations and final recheck SHA. Security-relevant
fixes or later changes require independent recheck. Any unresolved finding needs
explicit Author acceptance and a recorded follow-up; do not waive it implicitly.
Do not edit, publish, contact others or merge on the Author's behalf.

Independent security review is **required before merge** because this PR changes
sessions, Vault/private-data handling, consent boundaries and recovery. Passing
local checks or CI does not satisfy that gate. The PR remains a draft, no
independent approval is claimed, and merge authorisation has not been given.

## Independent review record

- Reviewer: Claude, pending Author-arranged independent review.
- Review link or sanitised report: pending.
- Reviewed SHA and final recheck: pending.
- Findings, fixes and explicitly accepted residual issues: pending.
- Reviewer limitations and unperformed checks: pending; private artifacts and
  live device/account trials are outside the supplied review package.
