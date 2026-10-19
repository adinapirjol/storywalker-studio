# Study 04 — private Watch sleep connection and saved research

Updated 2026-10-15. This implements descriptive research, not forecasting,
episode classification or diagnostic inference. The 32-week experiment remains a
proposal, not a collection commitment. No real Health records were used to test
this change, and no device installation or permission grant is claimed.

## What happens automatically

The iPhone Sleep observatory requests read-only `sleepAnalysis` access. A separate
protected queue, collection window, anchored query and prepared transfer keep it
independent of heart-rate collection. Saved opt-in resumes on launch; a fresh
installation does not start collecting. Observer notifications trigger bounded
anchored queries; foreground checks and delivery retries also remain available.
Sleep analysis is HealthKit data synced to the phone, not a direct streaming
Watch measurement. No new Watch workout or Watch application is needed for sleep.

The existing paired HTTPS receiver requires its pinned certificate, pairing
secret, unlocked Vault and local network. Enable private Watch research in HEALTH
separately from transport pairing. That saved consent permits automatic acceptance
only of Watch-labelled sleep from one source/device. The first identifiable
source is selected; mixed, different-source, unidentifiable and heart-rate batches
still require manual review. Source identity is HealthKit metadata delivered by
the trusted paired companion, not independent cryptographic proof of a Watch.
An accepted deletion must refer to previously accepted selected-source sleep
(or an existing tombstone) to be accepted automatically.

New accepted evidence and recalculated notes commit in the same Vault transaction.
A repeat of identical analytical input does not create a duplicate analysis. The
last 30 analyses retain issue time, algorithm version, source-input digest, date
range, interval count, omitted-record count, evidence and uncertainties. Earlier
analyses expire at that limit; the expired count is visible. This is bounded
research history, not a permanent clinical record. Switching source or switching
between example and private mode starts a separate history rather than mixing
sources. The page checks for saved updates every 15 seconds while visible; note
creation happens in the receiver, so it does not depend on the page staying open.

Calculations use at most the latest 90 dated windows, one source/device, interval
union and fixed-offset noon-to-noon grouping. The first 14 displayed windows are
an analytical comparison, not a designation of health or stability. Changes of
at least one hour across three usable consecutive nights are descriptive flags.
Timezones are taken from original metadata; unknown zones are omitted and counted,
never replaced with the phone's current zone. Offset changes are marked uncertain
and excluded from comparisons. Records retain source timestamps and provenance.
A window containing some samples is not proof of a complete night. Source
inventory is bounded to 10,200 accepted-record candidates per update; exceeding
it fails closed instead of silently dropping history. A later indexed store and
retention policy are needed for a long-running installation with larger history.

Private sleep does not provide subjective mood, restedness or energy. The private
view leaves these unknown and withholds their correlations. Example values stay
labelled invented. No LLM, cloud endpoint, analytics or Logfire export is invoked
by research acceptance or note creation. Existing BODY summary exports remain a
separate user-controlled feature; sleep delivery does not enable them.

## Phone walkthrough — after the updated companion is installed

1. On the Mac, open BODY → Connections & data → Automatic iPhone → Mac delivery.
   Use **Resume saved pairing** for the existing HealthKit receiver. Only create
   a new pairing if none exists; do not reset an existing connection to add sleep.
   Unlock the Vault, then **Download private pairing file**. Keep this secret file
   local; transfer it to the phone without uploading it to chat or cloud storage.
2. On the Mac, open HEALTH and select **Enable private Watch research**. This
   grants matching-sleep acceptance and note saving; it does not grant iOS access.
3. On the iPhone, open the updated Storywalker companion → **Connections & data**
   → **Sleep observatory**. Tap **Request Sleep read access** and allow reading
   Sleep in Apple's permission screen. No write access is requested.
4. Choose the initial 7-, 30- or 90-day history, then **Start selected sleep
   collection**. The choice is a collection preference, not an experiment duration.
   Resume preserves the previous window and anchor; clearing phone copies resets it.
5. Tap **Import sleep Mac pairing file**, select the HealthKit pairing file, then
   **Start sleep delivery**. Allow local-network access if iOS asks. Sleep has its
   own saved delivery preference; the existing heart-rate pairing is unchanged.
6. Keep phone and Mac on the same private network and the Mac awake, receiver
   running and Vault unlocked. For the first check keep the phone app open and tap
   **Check sleep now**, then **Retry sleep delivery**. Expect a verified Vault
   receipt, a smaller phone queue, and saved analyses in HEALTH's Research history.
   Remove the transferred pairing file after successful pairing.

Zero returned samples cannot distinguish denied read access, no samples, pending
Watch sync or unavailable protected data. Check that Apple Health itself has sleep
records and that Sleep read permission is enabled. Background delivery requires a
physical-device rehearsal and has no guaranteed cadence. No force-quit, re-pair,
beta-channel or network-policy changes are part of this workflow.

## Storage, recovery and deletion boundaries

This live path uses the existing personal Vault, **not** the separate synthetic
archive. AES-GCM encrypts record contents; this is **not whole-database encryption**.
SQLite still exposes record identifiers, kind, captured-at metadata and plaintext
content hashes. The journal uses a fixed identifier and metadata timestamp to avoid
putting its research dates in that timestamp column. File size/count and content
hashes remain observable. Phone copies use iOS file protection until first unlock
and are excluded from app backup; they are not a new custom encrypted database.
HTTPS is certificate-pinned; the prepared transfer is also encrypted. Unlocked
process memory and the visible authenticated page contain readable health content.

Journal contents rely on the existing Vault key/session/recovery mechanisms.
The separate synthetic `archive.enc` / `recovery.enc` rehearsal does not back up
live research notes. A backup of the whole personal Vault and its recoverable key
material can include these notes; copying a database without its key is not a
usable recovery strategy. Independent security review of this new private-data
integration is required before merge under repository policy. Automated tests do
not satisfy that gate or establish device acceptance.

- **Pause automatic research** stops automatic acceptance/recalculation but keeps
  existing notes and source records. Phone collection/delivery are separate controls.
- **Delete saved research notes & pause** removes the current journal's analyses and
  pauses it; it retains the source selection and accepted source evidence. It does
  not erase separately created backups, exports or operating-system snapshots.
- Accepting any native evidence deletion clears the entire current research
  history conservatively and, if enabled, recomputes from surviving sleep records
  in the same transaction. This deliberately may clear unrelated research history.
- **Clear phone sleep copies** stops sleep collection/delivery, deletes that app's
  sleep queue and prepared transfer, and resets its sleep anchor/window. It does
  not delete Apple Health records, Mac data, other app queues or exports.
- A source deletion still needs delivery/acceptance on the Mac. Paused/disconnected
  devices cannot propagate deletion until resumed/reviewed. Tombstones prevent an
  older transfer replay from restoring deleted source records. Restoring an old
  whole-Vault backup can restore older notes and records; delete that backup too
  if those copies must be removed. Secure physical erasure of SSD/snapshots is not
  claimed by application deletion.

The journal and native evidence use the excluded `native:` namespace. General
Vault retrieval, Atlas and public scene enrichment exclude it. Real data is never
bundled as a fixture. Existing private-data/build exclusions remain in place;
Git-ignore and owner-only file modes are not encryption. XML/ZIP imports remain
disabled. No forecast, bipolar probability or clinical conclusion is generated.

## Verification and remaining acceptance

Fictional tests exercise interval stage mapping, missing timezone, independent
phone anchors, encrypted journal reopen, idempotency, source-scoped consent,
automatic receipt, deletion propagation, retained-history bounds, origin/session
checks, raw-payload rejection and exclusion from general retrieval. Native Swift
unit tests do not execute HealthKit. Simulator compilation does not test iPhone
permissions, actual Watch provenance, background relaunch, locked-device behaviour
or end-to-end delivery of real sleep. Those remain device acceptance steps.

Apple primary references, checked 2026-10-15 (documentation has no publication date):
- [HealthKit authorization](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data): per-type permission; a successful permission request does not establish read permission.
- [Executing observer queries](https://developer.apple.com/documentation/healthkit/executing-observer-queries): background observers and completion handling; timing is system-managed.
- [Configuring HealthKit access](https://developer.apple.com/documentation/xcode/configuring-healthkit-access): capabilities and background-delivery entitlement.

## Results from this implementation session

- Repository suite: 104 files, 497 tests passed. A final journal/route rerun after
  using replacement plus SQLite compaction for note changes passed all 8 tests.
- Swift: 29 tests passed, including sleep mapping and independent queue anchors.
- Python native transfer boundary: 17 tests passed, including all six sleep stages.
- TypeScript and targeted lint passed. Public repository audit passed; this is a
  source audit, not a newly produced production-bundle audit.
- Unsigned iPhone + embedded Watch simulator build passed with Xcode selecting each
  target's SDK. Initial attempts incorrectly forced the iPhone SDK on the Watch
  and failed; no asset or deployment-target workaround remains.
- No phone installation, real import, device permission, background-delivery
  acceptance, independent security review, commit or merge was performed.

### Synthetic notes rehearsal

Open HEALTH and select **Save example research notes** after unlocking. Expect
invented data, one saved analysis and clearly labelled example associations.
**Unlock / reload saved research**, then reopen the page: the same analysis ID and
history count should remain. Repeated saves of the same example do not append.
**Delete saved research notes & pause** leaves zero analyses and automatic research
paused. This does not delete separately saved source evidence or backups.
Switching between private/example mode or selecting a different source asks before
replacing the current note history. The automated fictional transport tests cover
new data, duplicates, source mismatch, deletion and history-limit behaviour; they
are not evidence that a physical Watch has connected.

## Optional automatic sleep and heart-rate acceptance — 2026-10-15

BODY's **Automatic iPhone → Mac delivery** panel now offers **Automatically accept
sleep & heart-rate batches**. This is a separate, explicit persisted setting in
the encrypted receiver configuration. It accepts validated HealthKit sleep and
heart-rate source records from the authenticated paired phone, including mixed
sources and records without Watch-identification metadata. It does not select a
new research source, infer mood, enable exports or enable notifications.

Incoming batches are tied to the receiver identity. Waiting batches are checked
again when the phone polls for its receipt, resolving the previous stuck-batch
behaviour. Legacy waiting batches without a receiver identity can be reconsidered
only when the currently authenticated paired phone presents their batch ID.
Batches tied to another receiver are not automatically accepted. Unknown deletion
targets remain pending review; supported accepted records and existing tombstones
can be deleted without restoring older evidence. Malformed packets still fail
validation before staging. Receipts remain contingent on durable acceptance.

**Require manual batch acceptance** sets an explicit manual override, including
over the older HEALTH-only sleep rule. Existing pairings without either setting
retain the previous HEALTH sleep-consent behaviour. The setting survives stop and
resume with the same pairing. Revoking or creating a pairing removes this opt-in.
Changing the setting briefly restarts the local receiver with the same certificate
and pairing secret; the phone retains its queue and retries. If restart fails,
check receiver state and resume the saved pairing; the preference may already
have been saved. No phone rebuild or new pairing file is required.

Synthetic regression coverage includes mixed sleep/heart input, absent Watch
metadata, newly arriving sources, waiting-receipt acceptance, duplicate receipt
requests, pairing mismatch, manual override, known deletion and unknown deletion.
Independent security review remains required before merge.

### Combined sleep history (observatory-v2)

Choose **All sleep sources · combined history** in HEALTH to analyse all accepted
HealthKit sleep records together, including newly accepted sources. This analysis
choice does not grant batch acceptance or export consent. Individual sources remain
available for inspection. Raw records, IDs, timestamps and source/device provenance
are retained in the existing Vault; no duplicate source records are deleted.

Sleep duration uses the union of recorded asleep intervals, so overlapping generic
and staged sleep is counted once. Per-source sleep coverage is normalized before
comparison: identical coverage, even with different stage segmentation, is not a
conflict. Differently bounded overlapping coverage is conservatively uncertain;
awake/sleep contradictions also remain uncertain. Separate non-overlapping recordings
are combined, but cannot establish complete coverage or prove agreement. Stage labels
are not adjudicated. In-bed records are separate. Timing uncertainty, including
mismatched offsets, excludes windows from trend/baseline calculations. Uncertain
union durations remain visible and are labelled; missing nights remain unknown.

The view is bounded to the latest 90 noon-to-noon windows, using the offset of the
latest-ending usable record. Older source evidence remains saved. Original offsets
are preserved. Source changes preserve prior private analyses with their selection
and algorithm recorded; they do not make prior findings current. Existing v1 runs
remain readable. Switching between invented and private modes still resets the
journal with confirmation. The 30-run retention limit and conservative clearing on
accepted native evidence deletion are unchanged. Backups remain separate copies.

Synthetic regression checks cover duplicate/staged overlap, divergent overlapping
coverage, separate source nights/naps, timezone disagreement, persistence/reopen,
new-source updates, idempotence, and deletion. These checks are not an independent
security review; that review remains required before merging private-data changes.

### Full-period duration comparisons (observatory-v3)

Private research now measures complete candidate sleep bouts using elapsed UTC
intervals and assigns each to its source-local waking date. Overlapping stages and
sources count once; gaps up to 90 minutes join a bout but do not count as sleep.
Noon crossing and differing original offsets no longer exclude sleep duration.
Onset and waking retain their own source offsets; mixed offsets are timing notes,
not duration exclusions. If sources assign different offsets to the same end
instant, the lexicographically first record ID supplies the date label; all original
records remain available. This deterministic choice does not resolve local-time
ambiguity. Longest bout per waking date is main sleep; other bouts are separate
candidates. Their sum is explicitly an assigned-date total, not a fixed 24-hour
sleep total. This distinction matters during travel and for naps around midnight.

Awake/asleep contradictions, divergent overlapping source coverage and candidate
bouts spanning over 24 elapsed hours remain excluded from duration comparisons.
These conservative rules do not establish which source is correct. Unknown source
timezones remain omitted by the existing importer; none is guessed.

The latest up-to-90-day view includes every date, including gaps. Consecutive 30-day
periods show median, median absolute deviation, eligible count, missing count and
excluded count. Three recordings permit a descriptive median, without a coverage
percentage gate. This is an analytical display choice, not statistical confidence
or a clinical criterion. The final period can be shorter. First/last medians are
compared only when both are available; no missing-date interpolation is performed.
Coverage/source changes can bias comparisons. Sustained-change highlighting uses
the full-period median with at least seven eligible dates, a one-hour threshold and
three consecutive eligible dates; it is retrospective, not forecasting.

Automatic accepted-source updates save full-period coverage, period summaries and
any eligible first/last difference in encrypted research notes. Refresh also saves
a new version for the algorithm change; unchanged input is idempotent. Earlier
versions remain labelled with their algorithm and source selection, subject to the
existing 30-analysis retention/deletion policy. The invented example retains its
original fixed-window demonstration. No diagnostic or forecasting code is added.

### Recorded-date estimates and personal hypotheses (observatory-v4)

Summary labels and newly saved notes explicitly describe medians of recorded dates,
not typical sleep across the whole period. Missingness may depend on sleep itself;
neither its direction nor the missing durations are inferred. No imputation occurs.

An optional, bounded personal hypothesis is saved inside the encrypted journal,
separate from calculated runs, with entry time and the displayed date range at entry.
It is labelled retrospective and unverified. Source refreshes retain it without
changing calculations, and source switches preserve its original date scope. It
can be removed separately; deleting saved notes also removes it. Native source
deletions clear derived runs but retain this separately authored hypothesis.
Switching between invented/private modes resets the journal with the existing
confirmation. Backups may retain previous copies. Only fictional hypotheses are
used in tests and documentation; personal text is never embedded in source code.
