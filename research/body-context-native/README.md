# Storywalker companion — encrypted transfer and verification

Current source review: [10 October 2026](../../docs/research/review-2026-10-10.md).
The optional Watch target provides local pet display and available Health readings;
an Author-started meditation or movement session uses a live builder. The phone's HealthKit path is
the fallback. A completed source build is not proof of continuous device sensing.
Earlier verification snapshots below retain their original scope and dates.

Machine signing settings belong in ignored
`private-data/native-development/Signing.xcconfig` at the repository root, with
`DEVELOPMENT_TEAM = YOUR_TEAM_ID`. The public `Signing.xcconfig` optionally includes
it, and both target configurations use that include. A fresh clone supplies its
own team locally; do not put provisioning profiles or signing secrets in Git.

A local wellbeing journal companion source, narrow read-only heart-rate authorization, public HealthKit observer/anchored queries, foreground approximate Core Location adapter, protected pending queue and AES-GCM export helper. No Watch app is necessary: iPhone HealthKit receives available Watch samples. There is no browser access to HealthKit. Opt-in automatic delivery uses a separately paired local HTTPS receiver; the encrypted-file path remains available.

Heart-rate read controls are enabled for the private wellbeing review workflow; actual collection starts only with the Author’s in-app Start action and the system read-permission prompt. An XR/art portfolio by itself does not establish permitted HealthKit use. Apple's App Review Guidelines 5.1.3 restrict health data processing to applicable health, wellbeing or medical-research purposes and forbid personal health information in iCloud. User consent does not authorize arbitrary analysis or an AI disclosure. Native high/low HealthKit event ingestion and background location remain disabled. Optional aggregate research exports are a separate, explicit Mac-side consent boundary. Only an explicitly started and completed actual activity may save a workout; do not start a fake workout to animate the pet.

Use current Xcode with an accepted licence, an iOS 17+ target, your own signing team and physical iPhone with HealthKit available. No signing identity is included. Create an iOS app manually and add the local CollectorCore Swift package and iPhone source, entitlements and purpose strings; alternatively `xcodegen generate` in this directory using project.yml, then open the generated project. The existing generated Xcode project is available; project.yml preserves the purpose strings when regenerated. The former `SW_HEALTH_WELLBEING_VERIFIED` build flag has been removed; it did not represent Apple approval. No Health access occurs merely by installing a fresh build. A saved opt-in resumes at launch until Stop is selected. `swift test --package-path research/body-context-native` runs pure queue tests without HealthKit on a licensed Mac. Verified on 2026-10-08 with Xcode 27.0: 16 Swift tests and 46 Python tests pass; iOS Simulator and physical iPhone targets compile with signing disabled. The public repository privacy audit passes. A simulator build does not verify physical-device HealthKit access or background delivery.

Device verification checklist:

1. Build/sign on your physical iPhone. Confirm collection is paused on first launch and Request heart-rate access is available.
2. Request read-only heart-rate access, choose initial history (24 hours or 7 days), then Start selected collection. Test denied, allowed and no-sample cases; never infer read permission from emptiness.
3. Supply actual samples using normal device activity, never synthetic writes. Inspect event time, receipt time, lag, UUID mapping, source revision and unit conversion. Verify real Health availability and original device timezone semantics.
4. Kill during a batch commit; recover the queue and anchor together. Deliver/acknowledge repeatedly; confirm duplicate safety. Delete a source sample in Health and check that its deletion record is queued.
5. Exercise locked-device file protection, observer completion after recoverable commit, bounded backlog/full-queue failure, retries and stop. Background scheduling is not guaranteed.
6. Explicitly request foreground location separately; check reduced accuracy, denial, unavailable result and no background permission. The Core Location adapter is not started by the app.
7. Exercise the encrypted file export, private desktop review and authenticated receipt import described below. Confirm only the accepted batch is acknowledged; test a wrong receipt, restart and queue clearing. The complete file protocol is tested with fictional data. Physical HealthKit transfer remains unverified.

Queue ownership: native app Application Support, complete-until-first-authentication file protection, excluded from backup. Maximum 10,000 deliveries; anchor advancement occurs only after a successful atomic queue snapshot. No acknowledgement happens without explicit receiver acknowledgement. Clear stops collection and resets the selected window; Stop alone retains the queue and anchor. App removal removes its container. The encrypted export helper returns ciphertext only; caller owns key transfer and retention. The paired HTTPS receiver starts only after explicit Mac setup. No cloud account, notification or external sharing is introduced.

Physical fictional transfer is verified: the user supplied a 2026-10-08 iPhone screenshot confirming Vault receipt verification and batch removal. Known unverified limits: HealthKit authorization, Health data delivery, locked-device behaviour and background scheduling remain unverified. The earlier file workflow passed on the physical phone; repeat it with real selected Health records after installing this version. No native high/low HealthKit events or Watch runtime is claimed. Automatic paired delivery is implemented below; physical-device network delivery remains unverified.

References: [HealthKit](https://developer.apple.com/documentation/healthkit), [anchored queries](https://developer.apple.com/documentation/healthkit/hkanchoredobjectquery), [Core Location](https://developer.apple.com/documentation/corelocation), [Apple 5.1.3](https://developer.apple.com/app-store/review/guidelines/#health-and-health-research).

## Fictional collector dry run (2026-10-07)

From the repository root:

```sh
swift test --package-path research/body-context-native
(cd research/rehearsal-dramaturg && uv run --frozen python -m dramaturg.collector_dry_run)
# Explicit one-run opt-in: operational metrics only, to the existing EU project.
(cd research/rehearsal-dramaturg && uv run --frozen python -m dramaturg.collector_dry_run --logfire)
```

The Swift executable maps 17 fixed fictional deliveries (14 unique samples), checks
protected queue persistence/reopening and acknowledgement, and tests an AES-GCM
roundtrip. Python validates the emitted packets through the existing strict Pydantic
Observation contract and passes them through the actual pydantic-graph capture
workflow. Expect two captures, three duplicate deliveries, context revisions and
zero canonical memories or notifications. Empty activity/listening/location lanes
remain missing. Neither the Vault nor HealthKit is read; existing XR scenes remain
unchanged. The process discards its in-memory state on exit and removes its temporary
fictional queue. The fixed encryption key in this test is exclusively for invented
test packets and must never be used for personal exports.

The companion now has **Run mock collector**, built, installed and exercised successfully in the existing Storywalker Test iOS 27 simulator on 2026-10-07. This exercises the native queue and
encryption locally; the desktop command adds Python/Logfire verification. It works
without requesting Health permission or starting real collection. Simulator data is never written to HealthKit.

Verified on 2026-10-07: the existing EU setup page reported prior project data; the final mock run received 17 successful ingestion acknowledgements, and both `context.operations` and `context.latency` appeared as recently active in Metrics Explorer. Counters use OTLP double-valued deltas; the earlier integer-valued counter was acknowledged by the endpoint but did not appear in the catalog, so endpoint success alone was not used as proof.

Logfire verification: open Explore → Metrics in the existing EU project, select
`context.operations` or `context.latency`, and use the last-hour range. The service is
`storywalker-context-research`, environment `local-fictional`. This sends OTLP
metrics, not raw Pydantic validation traces: auto-instrumentation could expose input
values or validation errors. Export timestamps describe telemetry emission, never
health measurement times. `export-accepted` means the ingestion endpoint accepted
the points; verify the chart separately. HTTP errors, malformed acknowledgements
and rejected partial-success responses do not count as success. Telemetry remains
off for other app processes unless explicitly opted in.

## Before connecting a physical Watch

1. Use the paired physical iPhone, with normal Watch-to-Health synchronization. A
   simulator contains no personal Watch history. No separate Watch target is needed
   for reading samples already available in the iPhone Health store.
2. The implemented Health branch is private heart-rate review, encrypted file transfer
   and separately opted-in paired HTTPS delivery. It does not feed XR meaning, external AI or Spotify.
   The separate Storywalker summary feed described below can export aggregate health values to Logfire. The on-phone reflection remains an explicitly unsaved draft.
3. Configure your own signing team and device. Purpose strings and the narrowly
   scoped HealthKit/background-delivery entitlements are included. Complete system
   permission prompts on the device; neither an empty query nor successful request
   completion proves read access.
4. Use the encrypted file path or paired HTTPS receiver below. Both receipts are
   authenticated and bound to the exact encrypted batch. Keep the local Python
   service and main browser app on loopback.
5. Before enabling capture, verify historical versus live labels, timezone metadata,
   lag, deletion delivery, stop/restart, locked-device recovery and bounded queues
   on hardware. The current desktop context endpoint accepts fictional replay only.
   Keep real thresholds disabled and health payloads out of Logfire/external AI.

No accounts, signing identities, real capture, background permissions, notifications
or device sharing are activated by the dry run. No database migration is needed;
removing these dry-run additions leaves the existing encrypted Vault untouched.


## Finished encrypted file path (2026-10-07)

This extension reuses the existing encrypted Vault; no new database, cloud account,
provider, package dependency or encryption migration is introduced.

### Five-minute fictional transfer demonstration

1. Reopen `StorywalkerWellbeing.xcodeproj` after the package reload, keep your own
   signing team and physical iPhone selected, and Run to install this version.
2. On the phone, choose **Prepare fictional transfer**. It creates 14 unique source
   observations from the same 17 deliveries, in a separate protected mock queue.
3. Choose **Save encrypted batch**. Transfer `storywalker-batch.swtransfer` locally
   to the Mac. Keep files out of iCloud, source control and chat. Show the separate
   transfer key only when entering it in your local browser; it is not a Vault key.
4. Start the web app with `npm run dev`. Open `/research/xr`, unlock the Vault and
   expand **iPhone → private Vault transfer**. Select the file, enter its transfer
   key, then **Validate and stage encrypted batch**. No always-running Python server
   is needed for this file path; the existing frozen Python environment must exist.
5. **Review batch** shows all selected event/arrival times, units and quality flags.
   **Accept reviewed source evidence** saves evidence, never an approved meaning,
   capture rule, Journey, Episode or public scene. Download the acknowledgement.
6. Return `storywalker-receipt.json` to the phone using a local file transfer, choose
   **Import Vault acknowledgement**, and confirm the verified acknowledgement.
   An exported batch stays queued until this step. Delete transferred copies once
   you have verified the Vault. Closing/restarting either app before acknowledgement
   is safe; reopen the prepared batch or saved transfer and retry.

### Protocol and storage ownership

- Swift encrypts version-1 JSON using a new random 256-bit AES-GCM key per batch,
  a random 12-byte nonce, and fixed AAD `storywalker-transfer-v1`. The file contains
  nonce + ciphertext + 16-byte tag. Batches contain at most 200 deliveries / 1 MiB
  plaintext. HealthKit query anchors are never exported.
- The phone keeps pending deliveries and the query anchor atomically in Application
  Support (10,000-delivery ceiling, protection until first unlock, excluded from
  backup). There is no timed deletion of unacknowledged source evidence: retain until
  verified receipt or explicit clear. A full queue stops advancement and needs user
  action. The pending-export key/envelope are separately protected while locked and
  excluded from backup. One prepared export can exist at a time. Discarding an export
  removes that app-owned key/envelope but retains its queue. Clearing the Health queue
  also removes a prepared Health export; externally copied files remain user-owned.
- The loopback-only Next endpoint requires same-origin requests and an unlocked
  Vault session. It decrypts only the selected batch in memory. An isolated Python
  subprocess receives selected plaintext packets on stdin, validates with Pydantic,
  and returns normalized evidence. It receives no Vault key/passphrase or provider
  credentials, opens no health files, and emits only a fixed code on error. Timeout,
  output and request size limits apply; request bodies and validation details are
  never logged. Validation has no telemetry or external AI calls. After validation, the separately opted-in
  summary exporter can send aggregate health values to the dedicated private Logfire project.
- The Vault stores at most 100 pending review batches, with at most 200 deliveries
  each. Pending evidence remains encrypted until accepted/deleted; accepted evidence
  remains until explicit deletion. Native records use `native:batch:` and hashed
  `native:evidence:` identities. General search, retrieval, Atlas and XR enrichment
  exclude these records before processing; they are available only in this private
  review panel. Private evidence has no derived public or AI copies.
- Accepted receipt status and source changes persist in one Vault write. The receipt
  is an HMAC-SHA256 of `storywalker-receipt-v1\n<batch UUID>\n<envelope SHA256>\naccepted-evidence`,
  with the export key. Its JSON contains version, batch_id, envelope_sha256, status,
  and base64 mac. Swift verifies every field and MAC before removing the exact batch
  IDs. Queue epoch/revision checks prevent stale writes after acknowledgements or clear.
- Repeated batches return the existing review state. New batches containing existing
  observation IDs do not duplicate accepted evidence. Source deletions purge accepted
  and staged copies, invalidate stale reviews and leave only payload-free hashed
  tombstones. Those tombstones prevent old files from restoring deleted observations.
  An accepted batch keeps only receipt metadata and evidence pointers. Deleting the
  batch removes its receipt and evidence; no canonical memory is created by import.
- The draft note in the phone UI remains in memory and is explicitly labelled unsaved.
  It is not included in exports, logs or receipts. Existing desktop reflections and
  Author decisions remain in their existing encrypted scenario store.

### Verification commands

Run from the repository root:

```sh
swift test --package-path research/body-context-native
npx vitest run lib/native-transfer.test.ts lib/native-transfer-route.test.ts
(cd research/rehearsal-dramaturg && uv run --frozen python -m pytest -q)
(cd research/rehearsal-dramaturg && PYTHONPATH=. uv run --frozen python scripts/contracts.py)
npm run typecheck
npm run audit:public
```

Cross-language rehearsal without touching the personal Vault:

```sh
swift run --package-path research/body-context-native collector-dry-run --transfer-fixture /tmp/storywalker-transfer-check
node --import tsx scripts/verify-native-transfer.ts /tmp/storywalker-transfer-check
swift run --package-path research/body-context-native collector-dry-run --verify-fixture-receipt /tmp/storywalker-transfer-check
```

The temporary fixture directory contains only fictional test data and its key; remove
it after use. The verifier creates and removes its own encrypted sandbox. Never point
this test command at a personal export. Existing frozen dependencies suffice; use
`uv sync --frozen` in `research/rehearsal-dramaturg` if its environment is missing.

Verified this implementation: Swift exporter → Pydantic validation → encrypted
sandbox save/reopen → authenticated receipt; additionally, the real browser imported,
reviewed and accepted the fictional batch in the unlocked Vault, downloaded a receipt,
and Swift verified that downloaded receipt and emptied its fictional queue. The saved
fictional batch is labelled simulated. No personal Health payload was imported.
The iOS simulator also prepared a 14-delivery fictional batch and completed the
native Files save dialog, showing that the encrypted file was saved while its queue
remained pending. The user subsequently verified fictional export and receipt import
on the physical iPhone (2026-10-08). Real Health data remains unverified.

Checks for this implementation: 11 Swift tests, 45 Python tests, 212 frontend tests,
lint, TypeScript checking, production build, public repository audit and private
client-bundle audit passed. The simulator target compiled successfully.

### Remaining activation constraints and rollback

Real read controls are enabled, with collection off until the explicit in-app Start action.
Apple's [5.1.2(vi) and 5.1.3](https://developer.apple.com/app-store/review/guidelines/)
limit HealthKit processing and disclosures. Portfolio/XR research alone is not a
basis for broadening collection beyond the implemented private wellbeing review.
This implementation does not claim App Store review or approval. Current HealthKit pulls are conservatively labelled historical;
no custom alerts, urgent notifications, live-cadence claims, external AI, Spotify
correlation, background location or health telemetry are enabled. The existing
fictional graph remains independent of native imported evidence. Hardware permission,
background observer completion, deletion delivery and the new file UI must still be
exercised on the phone before claiming them verified.

No Vault schema migration is needed. Roll back these feature files to hide the panel;
existing encrypted native records remain readable after reinstalling it. Delete an
import through the panel before removing the code if you want its evidence removed.
The optional queue revision field is backward-readable; do not downgrade a running
collector mid-transfer. Stop collection and complete/discard a pending export first.

If Xcode reports a crash in `SwiftPM SPMPIFBuilder.build()` while refreshing the
package, reopen the project after edits finish. This is an IDE package reload failure,
not evidence of a crash in the installed iPhone app. The command-line simulator build
is checked separately; do not delete signing identities or simulator data to fix it.

## HealthKit activation (2026-10-08)

Verified after enabling the controls: 16 Swift tests, 46 Python tests, unsigned
simulator and iPhone builds, and the public privacy audit passed. The updated app
launched in the simulator with Request heart-rate access and Start available,
collection initially paused, and no Health permission requested by the test.

Rebuild the existing Xcode project using your existing signing team and select the
physical iPhone. Do not regenerate the project or change signing to enable this flow.

1. On the phone, choose **Request heart-rate access** and complete Apple's prompt.
   Only heart rate is requested; write access, location and workout collection are absent.
2. Choose **Last 24 hours** (default) or **Last 7 days**, then **Start selected collection**.
   The chosen start date remains fixed across restart/resume so the anchor's predicate
   cannot change silently. Stop and clear the local queue to choose a new window.
3. Review the latest 20 queued records, measured/received times, delivery lag, source,
   queue count and recovery state. A Watch label appears only when HealthKit device
   metadata explicitly identifies its model as Watch; missing metadata stays unknown.
4. Choose **Prepare selected Health transfer**, save locally and use the existing
   encrypted Mac import/review/receipt path. Each file contains at most 200 deliveries.
   Acknowledgement removes only that batch. Repeat for remaining backlog.
5. **Stop collection** persists a paused state before disabling background delivery.
   Relaunch restores an existing opt-in through the application delegate without a
   permission prompt. No samples still cannot distinguish denial from unavailable data.

HealthKit controls when archived samples arrive from the Watch. This archive path needs
no Watch app or Watch USB link. The direct native Watch path is documented below;
synthetic HealthKit writes and fake workouts are not provided. All archived HealthKit
records remain labelled historical to prevent treating a delayed sync as a live alert.

The protected queue stores selection, anchor and records atomically. Queries use 200-record
pages, a 15-second timeout, one page per observer processing pass, bounded backoff and
a 10,000-delivery cap. Completion callbacks are drained after processing or failure;
failures retain the old anchor. Foreground Check now resumes recovery. A source deletion
purges its queued payload and invalidates app-owned prepared Health ciphertext before
advancing the anchor. Previously exported copies remain user-owned and must be deleted.
Imported deletions take effect when the deletion batch is reviewed in the desktop Vault.

Operational status contains no raw telemetry. Raw Health values stay in local review
and encrypted storage/exports. The separate explicitly enabled Logfire aggregate feed
is documented below. This original archive implementation did not itself prove real
Health delivery; fictional receipt tests prove transfer only.

Official implementation references: [observer lifecycle and completion](https://developer.apple.com/documentation/healthkit/executing-observer-queries),
[read authorization uncertainty](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data),
[Apple processing rules](https://developer.apple.com/app-store/review/guidelines/#health-and-health-research).

### Private desktop BODY review update (2026-10-08)

Accepted HealthKit batches can now be explicitly selected at `/research/xr/body`
under **My private HealthKit data** for local playback and optional Pydantic historical
threshold review. This supersedes the earlier statement that no desktop custom
threshold review exists. No on-phone threshold, HealthKit high/low event, medical
alert, Spotify correlation or external processing is added by the BODY review.
The review stays separate from public XR scenes and the fictional capture graph.
Follow `CONTEXT-RESEARCH.md` in the sibling rehearsal-dramaturg directory for boundaries
and verification. The automatic transport described below is a separate opt-in; saved
collection opt-in alone does not mean the desktop is receiving live signals.


## Automatic paired phone-to-Mac delivery (2026-10-08)

Implemented in `AutomaticTransfer.swift`, `native-receiver.ts` and `/api/context-receiver`.
The existing generated Xcode project includes the controls in `CompanionApp.swift`;
rebuild it without regenerating the project or changing your signing team.

### Setup and first network rehearsal

1. Build and Run **StorywalkerWellbeing** on the physical iPhone to install this version.
2. On the Mac, open `/research/xr/body` → **My private HealthKit data** →
   **Automatic iPhone → Mac delivery**. Unlock the Vault locally. Choose
   **Check receiver and local addresses**, then the Mac address on the same private
   Wi-Fi/LAN as the phone. Use **Fictional network rehearsal** first.
3. **Create new pairing and start receiver**, then **Download private pairing file**.
   Transfer `storywalker-pairing.json` locally to the iPhone. It contains a bearer secret:
   keep it out of cloud sync, Git, chat and screenshots; delete the transfer copies after pairing.
4. On the phone, **Automatic Mac delivery → Import Mac pairing file**, then
   **Start automatic delivery**. Allow the app's local-network request on the phone.
   Permit the receiver through the Mac firewall if required by your approved local setup.
5. For the rehearsal, **Prepare fictional transfer** once to populate the separate mock
   queue. Delivery starts automatically. On the Mac, use **Open saved transfers**,
   review the new batch and **Accept reviewed source evidence**. The next successful
   phone request obtains and verifies the receipt, then removes just that batch from
   its queue. No batch/key/receipt file handoff is needed after pairing.
6. To switch to personal evidence, create a new **Selected HealthKit queue** pairing,
   import it on the phone and start delivery. Health authorization and **Start selected
   collection** remain separate actions. Finish or discard any pending fictional export
   first; discarding a prepared export retains its underlying queue.

The browser's status check alone does not start a listener. The receiver binds only to
one selected RFC1918 IPv4 address on port 8766; the main Next app stays on loopback.
A changed Mac address or source mode requires a new pairing. After app/server restart
or the existing 15-minute Vault session expires, unlock again and **Resume saved pairing**.
This reuses the saved certificate/token; it does not require re-pairing the phone.
The receiver does not extend the Vault unlock period.

### Protocol and retention

- TLS 1.2+; per-pairing RSA-2048/SHA-256 certificate with IP subject alternative name,
  valid for 365 days. The Swift task delegate checks the exact SHA-256 certificate pin,
  hostname and validity using Security.framework with only that certificate as anchor.
  No trust-store installation, HTTP fallback, redirect or ATS exception. Renew expired
  certificates by creating a new pairing. See [Apple's scoped trust configuration](https://developer.apple.com/documentation/security/configuring-a-trust).
- Random 256-bit bearer credential, TLS private key and certificate are persisted only
  in encrypted `native:pairing:receiver` in the existing Vault. They are excluded from
  ordinary Atlas/retrieval views. Temporary certificate-generation files are removed.
  The downloaded pairing contains the token/pin/endpoint/source, never the TLS private key.
- Phone pairing/opt-in, prepared transfer key/ciphertext and queued samples live in
  backup-excluded, platform-protected Application Support. Pairing and pending transfers
  use complete-until-first-user-authentication protection so delivery can run after first
  unlock while the phone is locked. Nothing sends before explicit delivery opt-in.
- One prepared batch of at most 200 deliveries, queue ceiling 10,000; failed or lost
  responses retain the batch. Retries are idempotent, with backoff capped at five minutes.
  Review waits apply backpressure: subsequent batches wait for the current receipt.
- Pydantic validates locally before encrypted pending-review staging. Review is explicit;
  transport never accepts evidence or meaning. Only a verified receipt for the exact
  accepted ciphertext can acknowledge phone deliveries. Source deletions invalidate
  prepared copies; replacement batches cannot be acknowledged by an old in-flight reply.
- Foreground checks run every five seconds; HealthKit callbacks schedule sends after
  durable queue commits without holding observer completion for networking. A bounded
  iOS background task allows a current request to finish. Background wakes, Watch sync,
  sampling and receipt timing are controlled by iOS; this is not a continuous live stream.
- Mac asleep/offline/locked, expired session, denied local-network access, wrong pin,
  revoked pairing and mode mismatch all retain the queue. **Stop automatic delivery**
  pauses sending; **Stop collection** separately pauses HealthKit. An already-sent request
  can still stage on the Mac after stopping. **Revoke pairing** removes Mac credentials;
  **Forget Mac pairing** removes phone credentials. Neither deletes collected evidence.
- No Health payload, transfer key, address, certificate or validation error is logged to
  Logfire, external AI or public XR. No new database or migration; manual transfer remains.

### Verification and remaining device check

The automated rehearsal invokes the actual macOS Swift sender against a temporary
loopback HTTPS receiver, validates 14 fictional observations through Pydantic, stages
an isolated encrypted sandbox, retries without duplication, rejects an incorrect pin,
accepts evidence explicitly, then verifies the returned receipt and empty queue.
It never reads the personal Vault or Apple Health.

```sh
swift test --package-path research/body-context-native
swift build --package-path research/body-context-native
node --import tsx scripts/verify-native-network.ts
npx vitest run lib/native-receiver.test.ts lib/native-transfer.test.ts lib/native-transfer-route.test.ts
```

The unsigned physical-iPhone target compiles. A macOS Swift rehearsal does not establish
physical iPhone local-network permissions, locked-device delivery, real Watch sync or
background scheduling. Run the fictional network rehearsal on the physical phone first,
then verify a selected HealthKit batch, offline/reconnect, explicit review, automatic
receipt, stop/revoke, source deletion and relaunch. Existing physical fictional *file*
transfer evidence remains separate from this new network path.

### Delivery troubleshooting update (2026-10-08)

The Mac panel rechecks receiver status every ten seconds while visible and after returning
from another tab. Expiry, shutdown and unavailable status clear the old Listening state;
checks do not prompt for unlock or extend the session. The iPhone now distinguishes
connection refusal/timeouts, unavailable network, pairing rejection, locked Vault,
busy receiver, batch rejection and unverifiable receipt using closed local messages.
No response body, URL, credential, payload or underlying error description is displayed.
All failures retain the queue and bounded retries. Install the updated iPhone build to
see these messages. If connection is refused at the still-current paired address, check
and resume the saved Mac receiver before changing or discarding queued evidence.

### Personal incoming companion feed (2026-10-08)

The first personal scenario is Watch → paired iPhone HealthKit → pinned local HTTPS
receiver → BODY. This is an as-arriving preview, not continuous sensing or an emergency
monitor. A cellular Watch plan alone does not provide a Storywalker remote transport.
The native Watch target described below adds a direct reachable-phone path. There is
still no independent cellular relay.

1. Build/run the updated iPhone app. Keep heart-rate collection on, import a HealthKit
   pairing, and Start automatic delivery. Both devices must use the same private network.
2. On the unlocked Mac, Resume saved pairing under Automatic iPhone → Mac delivery.
3. In BODY → My private HealthKit data, choose DANGER ZONE · Go live.
4. On the iPhone choose Start companion feed. For the first rehearsal keep the app open.

The phone selects the latest available Watch-attributed queued measurement (not phone-only,
simulated, future-dated or deleted readings). Its separate encrypted preview request
is not blocked by a prepared evidence export or review acknowledgement. Pydantic validates
it locally before a single sample is retained in process memory. This path writes no
Vault record, creates no receipt, and acknowledges no queue deliveries. Saved evidence
still follows the existing review/receipt flow. Raw health payloads never enter AI or Logfire;
only the separately enabled aggregate-summary exporter contacts Logfire.

The browser receives pushed SSE updates with a ten-second renewable viewer lease. Phone delivery silence beyond 15 seconds, or measurement age over two minutes, marks
the retained pose as last-known and not current. Measurement age remains visible.
The pose is retained only while the browser lease and unlocked receiver are active. These constants are presentation freshness limits, not
medical limits. Measured time, iPhone receipt, first Mac preview arrival and latest phone contact remain available for inspection; repeated packets do not reset first arrival or measurement age;
late older samples cannot turn the pose clock backwards. Hide/close/stop, session expiry,
receiver stop or revoke clears the temporary display. Phone preview opt-in is session-only.

Validation: fictional authenticated TLS integration, preview freshness/order tests,
Swift selection/deletion tests and simulator build. Real-device cadence, source metadata,
background execution and end-to-end Watch delivery still need a physical rehearsal after
installing the updated iPhone and Watch builds. The native Watch pet now preserves the
warm mineral/wire style, quiet readings and an explicit no-current-data state.

Follow-button recovery: Follow incoming Watch readings now unlocks if needed and resumes
only the existing saved HealthKit receiver before opening the waiting pet. It does not
create or replace a pairing. Missing/revoked pairing, fictional mode, changed network
address and occupied port have separate recovery messages. Polling does not restart the
receiver or extend the Vault session. The phone needs an available Watch-attributed
sample before the pet can respond; receiver-ready alone is not a verified sample arrival.

### Streaming investigation (2026-10-08)

The current pet preview already bypasses evidence acceptance: `HealthCollector.onQueued`
triggers `HealthSession.deliver` after a durable queue write, and `previewTick` sends one
Watch reading before the archive operation. The five-second foreground loop is also a
retry path; it is not the only trigger. The Mac validates each packet with local Pydantic,
and BODY originally polled the temporary result every two seconds (replaced by SSE below). Archive receipts do not gate the
preview, although both requests share the receiver busy flag and transaction queue.

The observed measured-to-iPhone-received interval precedes Mac delivery. It combines
Watch/HealthKit synchronization and collector scheduling; existing timestamps cannot
partition those causes. Source sampling gaps are another separate interval. Replacing
the Mac protocol cannot recover a sample the phone has not received.

Code-confirmed overhead, not a measured performance benchmark:

- Each preview retry re-encodes/encrypts the same reading, creates a new ephemeral
  URLSession, then cancels that session. The server explicitly closes the connection.
- Each packet starts a separate isolated Python validator process.
- While evidence awaits review, `tick` resends the complete encrypted batch every
  fifteen seconds. A small `receipt` request is implemented on the server but unused
  by the Swift sender.
- Browser polling adds up to roughly two seconds before an available update is seen,
  excluding request time and scheduling. The archive and preview share contention.

Implementation plan from the investigation (completed for items 1–4 below; item 5 remains future work):

1. Keep the durable reviewed archive, but after a confirmed staging response poll only
   the batch ID for its receipt. Retain digest verification and retry the envelope if
   staging is unavailable after reconnect. A network acknowledgement must never clear
   the evidence queue or imply Author acceptance.
2. Send new preview IDs immediately; send small liveness messages rather than repeated
   health payloads between readings. Use a latest-value slot separate from archive
   draining, preserve measured time, propagate deletion, and bound reconnect backoff.
3. Reuse a certificate-pinned ephemeral HTTPS session for the active pairing; close it
   on stop/re-pair/revoke. Benchmark this before introducing WebSockets. For sparse
   background samples, event-driven HTTPS is simpler than an always-open socket.
4. If browser polling is material, use an authenticated local SSE subscription with
   the same Vault expiry, short viewer lease, no caching/logging, and clear-on-hide rules.
   Disconnect/overflow must drop obsolete preview states, not silently lose archive data.
5. For a native Watch pet, send available Watch-local readings via WatchConnectivity
   when reachable, avoiding the wait for the iPhone Health store to synchronize.
   High-frequency heart-rate collection requires an appropriate explicitly started
   workout session; do not start a pretend workout to keep a pet alive. A cellular-only
   path would require separately designed remote transport: this private-LAN receiver
   is not reachable merely because the Watch has a mobile plan.

Before claiming improvement, use fictional packets to measure payload bytes, reconnects,
validator time, and phone-send-to-Mac/display latency. Physically verify foreground,
background, screen-off, disconnect/reconnect, revocation, deletion, duplicates and Vault
expiry. Clock differences must be separated from actual transport duration. Keep private
measurement values out of telemetry.

Apple references checked for this investigation:
[HealthKit observer queries](https://developer.apple.com/documentation/healthkit/executing-observer-queries),
[Watch background scheduling](https://developer.apple.com/documentation/watchkit/using-background-tasks),
[WatchConnectivity](https://developer.apple.com/documentation/watchconnectivity/wcsession),
[workout sessions](https://developer.apple.com/documentation/healthkit/running-workout-sessions).

### iPhone icon

`iPhone/Assets.xcassets/AppIcon.appiconset/AppIcon.png` is the opaque 1024px warm mineral
pet icon. It is included in the Xcode resources phase and selected by both the checked-in
project and `project.yml`. Artwork was generated using the built-in image generator;
the exact prompt and export provenance are in `app-icon-prompt.txt`. Rebuild/run on the
iPhone to install it. Simulator compilation does not prove physical-device installation.


### Implemented stream transport and native pet (2026-10-08)

The phone owns one certificate-pinned ephemeral URLSession per active pairing. Stop,
forget and pairing replacement cancel its tasks and close the connection. The Mac uses
bounded HTTP keep-alive connections. A durable collector change triggers the preview
immediately; overlapping changes coalesce into the newest available reading. Repeated
IDs send a tiny heartbeat instead of re-encrypting the observation. Deletions are pushed
in bounded packets before the next pose; a process-local tombstone prevents resurrection.
Preview failures back off to one minute, with no archival queue acknowledgement.

The HealthKit pairing's five-second retry/heartbeat loop is owned by the phone's
main app view while its scene is active, including when Connections & data is closed. It is cancelled
when the scene leaves the foreground. Watch and collector events remain the
immediate delivery triggers; this loop does not request more sensor samples or
promise background execution. Collection, automatic delivery and companion feed
still require their existing separate opt-ins.

After the Mac confirms staging, archive retries send only the batch ID for a receipt.
Only a verified accepted-evidence receipt can clear the durable phone queue. Missing
Mac staging causes the same retained envelope to be sent again; locked/rejected/deleted
states retain the queue and do not authorize replacement or acceptance. After a phone
process restart the first attempt safely re-stages the retained envelope.

The preview has a separate bounded processing lane from archive transactions. Local
Pydantic validation still runs on observation/deletion payloads; heartbeat messages contain
no measurement and do not start Python. Persistent validator-process reuse is not part
of this change.

BODY opens a same-origin POST SSE subscription using the HttpOnly Vault session cookie.
There is one viewer and no event replay. The stream queues one frame and coalesces
pending updates to one latest sample and one contact, so a brief consumer stall does
not disconnect the viewer or accumulate a reading history. On a transient transport
failure, the visible client clears its pose and retries the same stream up to three
times with bounded backoff. An ephemeral viewer ID prevents an automatic retry from
reclaiming a feed that another BODY view took over. Reconnection does not restart
the Mac receiver or reset threshold support/cooldowns. An open stream renews its short display lease but never the absolute Vault
expiry. Hide, cancellation, replacement, receiver stop and session expiry close the
stream and clear its pose. New observations replace historical playback in the same
companion renderer. Green means Go live is available; red with LIVE / Stop means the
stream is selected. Connection and age text distinguishes waiting, current and last-known
poses; colour is not a medical classification. A small label shows rounded BPM and
measurement time under the pet, with full source precision retained in Inspect evidence.
Research-event controls show the saved limits and context mode separately from
unsaved field edits. Saving those rules does not start or stop the live receiver.

The phone opens with a SwiftUI rendering of the warm mineral / wire companion in a
watch-sized card: paired shard fins, eight quiet antennae, wire curves, eyes and mouth.
Tap greets, drag turns, pinch zooms, and double-tap resets the view. By-reading, Soft,
Curious and Side-eye are authored expression choices; no emotion or neurotype inference.
No audio or haptic loop starts automatically. The local latest Watch reading and its
age appear in small type. Backgrounding clears this screen's temporary reading.
This initial phone-only preview has been superseded by the native Watch target and
real 3D phone geometry described below.

Verification: 25 Swift tests, authenticated fictional TLS integration (including a held
archive transaction), SSE cancellation/expiry/backpressure tests, type/lint checks,
simulator compilation and an actual Swift loopback rehearsal verifying connection reuse,
receipt-only polling, certificate pin rejection and authenticated queue acknowledgement.
The clean iOS 27 simulator's Apple datamigrator/display startup crashed during visual QA;
this is separate from the physical phone and not evidence of a USB-related app failure.
Physical phone cadence, background delivery and native appearance still require checking
the updated build on the device.


### Native Watch app, 3D phone pet and separate integrations (2026-10-08)

`StorywalkerWatch` is a watchOS 10+ single-target companion embedded in the phone app.
It shows the mineral pet with perspective-projected wire rings, a quiet rounded reading
and the original measurement time. Start pet readings requests heart-rate access on
that Watch and observes newly available local Health samples. This ordinary mode does
not force sensor sampling or register a continuous background session.

The main Watch screen reserves swipes and the Digital Crown for scrolling, including
swipes over the pet. Tap the pet to greet it. **Rotate pet** opens a separate view
where dragging turns the companion; **Reset** restores its orientation and **Done**
returns to the scrolling screen. Rotation is retained when returning.

The **Session** selector directly under the pet starts with **Meditation**, selected
by default, followed by Walking, Running and Indoor cycling. The start/end buttons
name the selected session. Meditation uses Apple's `mindAndBody` activity type and
is saved as a Mind and Body workout; it does not separately write Mindful Minutes.
The choice is pinned when Start is pressed, including across the permission prompt.

Starting a session explicitly uses HKWorkoutSession and HKLiveWorkoutBuilder for the
Author's actual meditation practice or movement activity. Stop/end finishes and
saves the session to Apple Health. No session starts at launch. Sampling remains
subject to Watch sensor availability. The ordinary **Start pet readings** path
remains available without starting a session. Expressions are visual choices, not
inferred emotions or diagnoses. Selecting Meditation does not confirm rest for
Mac-side research rules; that separate Author report remains explicit.

Fresh readings use bounded WatchConnectivity sendMessageData while the phone is
reachable. There is one request in flight and at most one coalesced latest reading;
there is no application-context/user-info health outbox or stale replay. The phone
validates version, origin, UUID, finite value, size and timestamp before showing a
single temporary sample. It acknowledges receipt before awaiting the Mac network.
Mac forwarding requires the existing selected collection, HealthKit pairing, automatic
delivery and companion-feed opt-ins. Direct samples bypass ordinary Watch-to-iPhone
Health sync and archival receipts; they never enter or acknowledge the durable queue.
Archived source evidence continues through the existing HealthKit and receipt path.

Cellular service alone does not make WatchConnectivity reachable or provide a public
Mac endpoint. The current direct route is Watch → reachable iPhone → pinned private-LAN
Mac. The Watch keeps its own local pet when the phone is unreachable. Independent
cellular Watch-to-cloud delivery and system watch-face complications are not implemented.

The phone card now uses a non-AR RealityKit scene with a solid sphere, volumetric shard
fins, tubular surface wires, perspective camera and three lights. Drag rotates the actual
meshes rather than a flat drawing; pinch adjusts camera distance. A small default tilt
retains the original silhouette. All integration controls are in Connections & data,
which opens a separate sheet below the companion. Inspect reading is optional.

### Dedicated private Storywalker Logfire project

At the Author's explicit request, a separate EU project was created and verified private:
https://logfire-eu.pydantic.dev/adinablazrx/storywalker. This is a change to the earlier
local-only telemetry boundary: maximum BPM, counts and app-receipt windows are health
summaries that leave the Mac when this feed is enabled. Raw observations, source IDs,
notes, place and music history are excluded. No validation SDK auto-instrumentation is
used. Send-only credentials and the enable flag live in ignored `.logfire/storywalker/`.
The feed was enabled for future arrivals as requested; BODY has separate check/enable/stop
controls under private HealthKit data. Vault authentication protects those controls.

Pydantic validates each summary and selects Watch-attributed records when present in
a batch, otherwise iPhone Health-store records. Maximum uses the preferred subset;
received_count and the app-receipt time window cover the full non-deleted batch.
A received-batch summary is attempted after encrypted staging. Direct incoming readings
also form bounded 20-second live windows (at most 200 observations). Receiver stop,
source deletion or Vault expiry clears the temporary window. Repeated batch exports
are suppressed in-process. Failures are visible and never clear phone evidence; there
is no persistent telemetry outbox, historical backfill or exactly-once cloud guarantee.
Stopping does not retract records already received by Logfire. A later source deletion
does not automatically retract an earlier aggregate in the external project.

Verification: both simulator targets compile, 27 native tests pass, 13 Pydantic summary/
transfer tests pass, and 17 focused web receiver/stream/summary tests pass. Typecheck
and focused lint pass. One explicitly fictional summary was accepted by Logfire and
independently found with a read-only query (count=1). No real observation was used in
that verification. Physical Watch permissions, sensor cadence and end-to-end device
streaming require on-device verification after installation.

Signed iPhone and Watch device builds also pass. The updated phone app was installed
and launched on the physical phone. Direct Watch installation failed twice while
creating the Bluetooth developer tunnel, before app installation. Check the iPhone's
Watch app for the embedded Storywalker companion; physical Watch installation and
streaming remain unverified until it is available there and opened on the Watch.

Packaging correction: the initial build placed the Watch application in `PlugIns`,
which passes generic embedded-binary validation but is not the Watch-content location.
Removed the incorrect post-generation override; the iPhone now embeds the single-target
watchOS app at `Watch/StorywalkerWatch.app`, matching Xcode 27's watchOS product
specification (`watchOSDevice.xcspec`). A fresh signed build passes at that location.
Xcode can list the paired physical Watch but cannot currently read its watchOS version;
the missing version in its destination error is a connection problem, not evidence
that the Watch needs an OS upgrade.
The corrected phone bundle was installed successfully on the physical iPhone
(installation database sequence 6128). Watch-app listing and physical Watch launch
still require checking on the devices; a successful phone install alone does not prove
Watch installation or sensor delivery.

The subsequent on-phone Install action reached the Watch installer but returned
"This app could not be installed at this time." Inspection of the embedded signed
Watch profile found one provisioned device: the paired iPhone, not the Watch. A generic
signed build therefore does not establish installability on that Watch. Device Hub
currently shows the physical Watch as Connecting without an OS version; devicectl
reports it paired but disconnected. Complete Watch developer setup and registration
in Xcode, rebuild for the physical Watch with automatic signing, then confirm the new
embedded profile includes that Watch before installing again. Never edit the signed
profile to add a device, lower the deployment target to compensate for an unknown OS
version, or treat the phone install as Watch-install proof.

### Batch timing and paused fictional rehearsals (2026-10-08)

Saved transfer rows, private BODY batch choices and selected reviews show the surviving
measurement range, app-receipt range, Mac staging time and Mac acceptance time. Dates
use the browser's named local timezone. Earlier batches derive their measurement and
receipt ranges from encrypted source evidence; missing old Mac times remain explicitly
unrecorded. Source deletion recomputes ranges instead of retaining deleted timing.
Acceptance and receipt semantics are unchanged.

No scheduled fictional collector or running fictional rehearsal job was found. The
open XR timeline is finished and sound is stopped; BODY is in private mode. Fictional
replays and the phone mock collector require explicit manual actions. New pairing
setup defaults to the selected HealthKit queue; an existing pairing is not replaced.
