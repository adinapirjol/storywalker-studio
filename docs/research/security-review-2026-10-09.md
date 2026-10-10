# Development freeze and local security review

Historical record: review started 8 October and completed 9 October 2026. During this review BODY/Watch feature work and
physical-device installation were frozen at the Author's request. Only audit,
bounded security repairs, tests and safe cleanup were performed. No commit, push,
device reset, beta-channel change or new hardware installation was made.

The Author subsequently resumed integration work. See the
[10 October review and commit preparation](review-2026-10-10.md) for current changes
and verification; the observations below remain the historical audit baseline.

## Current status — 10 October follow-up

The [release-readiness report](release-readiness-2026-10-10.md) owns the current
commit recommendation, partitions and acceptance checklist. Historical findings,
test counts and device failures below describe their original checks; they are
not asserted as today's blockers.

- High-priority local authorization, stale-write and origin defects were repaired.
  The later summary-enable consent race was also repaired with regression tests.
  Cancellation still cannot recall an already-issued provider request or write.
- Shared WebAuthn/PRF access retains required user verification, exact origin/RP
  checks, one-use challenges, credential counters, fixed 15-minute sessions and
  explicit lock revocation. Expired private mutations are not automatically
  replayed after unlock. OAuth provider access remains a separate consent boundary.
- The Author confirms existing phone-assisted passkey unlocking in Safari and
  Codex, plus earlier recovery access. The Bluetooth wait was temporary. Local
  Touch ID is deferred on the managed Mac; no restriction was changed. Enrollment,
  expiry, explicit lock, rejection and recovery failure cases remain unaccepted.
- Historical Watch installation, reading and phone acknowledgement are established
  by the earlier evidence below. The latest source's **Start meditation** action
  maps to HealthKit Mind and Body and has compiled for the unsigned Watch simulator.
  That does not accept its latest physical save, sensing or background behavior.
  No native installation was performed during this documentation refresh.
- README now describes the native pair with public app icons and includes a paused
  fictional BODY browser screenshot. Private device photos/readings were not added.
  Fictional playback and external exports were not enabled for this refresh; no
  claim about the Author's current saved export settings is made from this audit.
- Fresh repository audit: **450 visible files passed**. The audit on existing
  isolated production output passed for **110 public artifacts**. Metadata checks
  covered **59 known private/credential files**, all ignored and absent from the
  index; no tracked files matched ignore rules and nothing was staged. Subsequent
  commit preparation checked cumulative isolated public-source copies: the newest
  normal build and **354 tests / 84 files** passed, with **448 visible source
  files** and **109 fresh build artifacts** passing privacy audits. The two deferred
  paths are absent from that copy. Privacy audits remain bounded checks.

The Author has now authorized controlled commits, feature-branch publication and
a PR. The final foundation ignores/untracks Next's generated type file while
preserving the local copy. A fresh npm advisory query reports zero vulnerabilities.
The sanitized CTM checkpoint is included to resolve the NOVA link; the generic
Spotify diff script is deferred for separate output-privacy review. Hosted CI and
remaining manual/device acceptance are still pending. This is a go for source
review in a PR, not a release or physical-device acceptance decision.

## Final publication checks — 10 October

The Author explicitly authorized controlled commits, a feature-branch push and a
pull request. The final scope is **253 changed paths in five commits**: 56 foundation
paths (including index-only removal of generated `next-env.d.ts`), 89 BODY/Pydantic
files, 41 native files, 56 fictional XR/presentation files and 11 documentation
files. The sanitized CTM checkpoint resolves the NOVA link. The Spotify diff script
remains deferred; its output must be confined to ignored storage in a separate change.

Fresh checks in the public-only source copy passed: **354 JavaScript tests / 84
files, 66 Python tests and 27 Swift core tests**, deterministic Aurora verification,
route-type generation, TypeScript, ESLint and the normal Turbopack production
compilation. The optional Are.na network-refresh prebuild hook was not run.
Privacy audits passed for **448 prepared source files and 109 freshly built public
artifacts**. All **59 known private/credential files** were ignored and absent from
the proposed Git scope. Three configured secret values had zero public matches;
no private-key blocks or forbidden private paths were found in the bounded scans.
All local Markdown file references resolved. The fresh npm advisory query reports
**zero vulnerabilities**; historical Python advisory checks were not rerun.

Staging uses explicit paths and compares each staged blob with the reviewed hash
inventory before committing. The generated file remains on disk. Hosted CI is
pending the PR; real passkey lifecycle and latest physical-device checks remain
unconfirmed. These checks establish readiness for source review, not a release,
automatic merge or native deployment. Earlier sections retain their dated scopes.

## Working-tree inventory

The baseline contained **17 modified tracked files and 167 untracked files**:
184 dirty files, including approximately 3.35 MB of untracked material. The 413
files initially reported were all committable files, not 413 changed files. There
were no staged changes. The original tracked diff was 276 additions / 83 removals.

The baseline inventory (retained locally under ignored `private-data/reviews/`) records every
dirty path, size and SHA-256 without copying source contents or private inputs.

| Area | Dirty baseline files | Work present |
| --- | ---: | --- |
| Native research | 40 | iPhone/Watch app, pet assets, HealthKit queue, TLS pairing, protected export, tests, Xcode project |
| Python research | 35 | Fictional graph service, Pydantic transfer/review/summary contracts, XML importer, telemetry, tests, lockfile |
| `lib` | 58 | BODY playback, incoming feed, native review/receiver, Atlas exclusions, Vault changes, tests |
| `components` | 26 | Creature, rhythm, private review, streaming and integration controls, XR/Atlas changes |
| `app` | 12 | New research pages and local data routes; existing Vault route changes |
| Documentation | 5 | Research/career notes and fictional XR screenshots |
| Scripts | 5 | Snapshot analysis, health staging, fictional transfer/network verification and one bytecode file |
| Root files | 3 | Ignore rules, README and package scripts |

Review covered the tracked diff, dirty-path inventory, data-flow and authorization
boundaries, native transport/storage, Python validation/export paths, dependency
advisories, public artifacts, screenshot content/metadata and resource references.
Automated scans are not proof that every possible sensitive string is absent.

## Findings and repairs

Severity below is the local review's prioritization; it is not a claim of proven
remote exploitation.

| Priority | Finding | Repair / evidence |
| --- | --- | --- |
| High | `/api/private-review` returned plaintext recovery material and accepted edits without an unlocked Vault or origin guard | Require an active session, loopback Host for reads, matching Origin for writes and bounded request bytes. Recheck authorization when queued work starts, after file reads, before new writes and before returning private results. Tests cover denial before file access and locking during reads/queued edits. |
| High | Most `/api/vault` actions lacked the origin protection used by newer private routes | Check Origin before cookies, payload parsing or Vault access for every POST; guard GET Host/site; bound import request bytes. Revalidate sessions after async opening/provider work, bind a persistence guard to browser-authenticated snapshots, and recheck immediately before disk replacement. Expired results use a distinct error code that never triggers automatic provider replay. |
| High | Spotify selection/preview/import routes could use private account state without consistent local guards | Require local origin/Host and unlocked sessions for private selection/preview; open authenticated Vault before import provider requests; bound request sizes. Revalidate cookie-authenticated requests after provider work and before persistence; explicitly supplied passphrases remain request-scoped authorization. Private provider/validation errors are replaced with controlled messages. Connector status GETs reject foreign hosts. OAuth callback remains a state-validated redirect flow. |
| High | Installed Next.js and two transitive packages matched current npm advisories | Patch Next 16.3.6 → 16.3.8, brace-expansion 5.0.9 → 5.0.12 and source-map-js 1.2.1 → 1.2.2. Preserve exact Next pin; synchronized lockfile. Earlier audit returned zero matches; the follow-up verified installed versions locally. A fresh advisory query requires approval (see follow-up below). |
| High integrity | Independent sql.js snapshots could replace newer encrypted Vault saves | Hold an exclusive mode-0600 local lock through disk fingerprint comparison, temporary export/fsync and atomic rename. Stale snapshots and busy writers fail without overwriting evidence. Tests cover competing OS processes, stale snapshots, lock cleanup on exceptions, symlink lock rejection and authorization expiring before rename. |
| Medium | Disabling summary export could race with credential lookup or a pending enable, leaving export work active | Immediate cancellation generation, abort signals, serialized configuration writes and fresh consent checks. Tests cover credential-wait cancellation, in-flight abort, delayed enable vs later stop and symlink rejection. Already received external requests cannot be recalled. |
| Medium | Summary config writing followed a symlink and existing credential directories were mode 0755 | Reject symlink paths; write config through a fresh exclusive mode-0600 temporary file and atomic rename. Set local Logfire directories to 0700; credential files remain 0600. |
| Medium | Owned encryption-key buffers were discarded without being overwritten | Erase stored session keys on lock/checked expiry and open Vault keys on close; clean temporary route copies. Tests verify owned-buffer erasure without erasing the caller's key. Runtime memory copies remain a limitation. |
| Medium | Public privacy scan skipped Swift, Python and native project formats | Include native/Python/config/XML text, credential/cache paths, symlinks, large-text review and corrected token prefixes. Temporary negative controls prove a Swift token-shaped fixture and credential path are rejected without printing their contents. |
| Medium privacy | Older privacy wording suggested there was no external telemetry despite optional aggregate health export | Document the separate opt-in accurately: maximum BPM, counts, source category, opaque summary ID and app receipt range remain sensitive data. Raw readings, notes, location and listening context stay local. |

Next advisories include a development-server disclosure fixed in 16.3.8:
[maintainer advisory](https://github.com/vercel/next.js/security/advisories/GHSA-39w2-rjm5-chcv).
The existing brace-expansion override matched denial-of-service advisories:
[maintainer advisory](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-q2hr-2g5m-vwhr).
Advisory matches describe affected dependencies; not every advisory's exploit
conditions are present in Storywalker.

## Privacy and resource conclusions

- No credential values, known staged recovery markers, physical-device IDs or raw
  HealthKit exports were found in the committable paths scanned. Ignored Vault,
  raw-import and credential directories were preserved; their contents were not
  copied into the report or sent to advisory services.
- Native HTTPS uses a pairing token, pinned certificate, bounded payloads and
  private-address binding. Swift rejects redirects. Receipts remain separate from
  fresh temporary previews and Author evidence acceptance. Tests use fictional
  inputs, not physical Watch collection.
- Native phone queue/pairing files use iOS file protection and are excluded from
  backups; the macOS test path uses owner-only files. Pydantic subprocesses receive
  selected packets via stdin with provider credentials removed from their env;
  raw stderr is not exposed as a browser error or telemetry label.
- Health and receiver records are excluded from general Atlas/Director retrieval.
  Optional aggregate summaries are external health data, not anonymized readings.
  The previously enabled summary feed was explicitly paused during this review;
  existing Logfire exports were not deleted or inspected.
- Public screenshots reviewed show fictional Aurora Coast material. PNG EXIF
  contains color-space/dimension tags, not GPS, artist or user-comment tags. JPEG
  screenshots contain no EXIF/XMP containers. The portfolio's existing Author
  credit is intentional public identity, not a provider secret.
- Import/reference searches found no removable source orphan. `lib/sql-js.d.ts`
  is an ambient declaration; routes, schemes, asset catalogs, tests and scripts
  have framework/build/manual uses. Matching phone and Watch icons are required
  target assets, not accidental duplication.
- Removed regenerated script bytecode, the inactive pytest cache and about
  **1.08 GB** of stopped development-server cache. Retained production artifacts,
  reusable compiler caches, app resources and private evidence.
- The unpatched running preview was stopped after the dependency repair. No
  listener was present on ports 3000, 8765 or 8766 at the freeze check. Browser
  preview is intentionally unavailable until development is resumed.

## Verification

| Check | Result |
| --- | --- |
| npm advisory database | Earlier post-patch query: zero reported vulnerabilities. Follow-up confirmed installed patched versions; fresh external advisory query not approved. |
| OSV Python check | 54 installed packages queried; zero advisory matches |
| TypeScript | Passed |
| ESLint | Passed |
| Production compilation | Passed; run directly with Next telemetry disabled, avoiding the network-refresh prebuild script |
| Native collector unit tests | 27 passed; no device install |
| Python tests | 57 passed; mocked exports |
| Focused security tests | Follow-up: 46 passed across 12 files, including provider lock/expiry, private queued operations, non-replay, cross-process exclusion, stale saves, guards, summary cancellation and passkeys |
| Broader JavaScript suite | 266 passed / one timed out in a 73-file run; fork runs also had worker startup errors. The affected native BODY review passed in an isolated process run, whose separate error-canary test then timed out. That canary passed alone. Do not label these mixed runs as one clean full-suite pass. |
| Isolated Python review | Invented review returned one marker in 1.73 seconds; no network or real input |
| Public source/build privacy audits | Passed; build audit now covers client files plus public HTML/RSC and checks local private markers/credential values |

## Remaining validation and release conditions

1. **Latest Author photo confirms the companion installed and open on the Watch.**
   Earlier tunnel/profile failures remain historical findings, not current proof
   of an installation blocker for the launched build. A newer photo shows a
   timestamped reading and a phone receipt acknowledgement. Subsequent evidence
   and the Author's explicit bounded resumption are recorded below; those do not
   establish continuous sampling or a release-ready end-to-end system.
2. The test environment exhibited large scheduling/timeouts. Get a clean complete
   suite in an uninterrupted run before release; do not suppress failing assertions
   or extend the production validator timeout just to make checks green.
3. Keep one local Vault server as the normal workflow. Cooperative writers now
   share an exclusive local filesystem lock, but busy/stale snapshots require
   explicit reload/retry; no automatic merge is claimed. Never automatically
   delete or steal a lock: after a crash, stop all writers and verify no process
   can still own it before explicitly removing only the `.sqlite.lock` file.
   Browser authorization is rechecked around asynchronous operations and before
   persistence. Already issued provider requests or file writes cannot be recalled.
4. Older recovery staging and source exports are plaintext ignored files. Vault
   payload encryption does not encrypt their source copies or SQLite record
   metadata. File permissions/disk encryption and the Author's retention decisions
   remain necessary. Downloads containing pairing tokens were not deleted as
   allegedly unused while the installation issue is still open.
5. Local browser guards do not isolate data from arbitrary software running as
   the same macOS user. Before any hosted/multi-user/cellular relay deployment,
   separately review authentication, rate limits, TLS, secret lifecycle and
   deployment exposure. The Python Docker service must remain published through
   a loopback host mapping for this local workflow.
6. Public career notes contain a learner skills baseline, and native project
   configuration contains the local signing-team identifier. Neither is a secret
   token, but review whether those identifiers belong in a public repository
   before committing this large pending work set. Health observations and actual
   personal research annotations must remain ignored/private.

Security and privacy repairs do not themselves certify physical-device delivery.
The current bounded resumption is recorded in `AGENTS.md`; historical freeze
references below describe the state at the time of each earlier review.

## Read-only device follow-up after OS updates

On 9 October, the Author supplied screenshots of iOS 27.2 and watchOS 27.0.1.
Two read-only CoreDevice discovery checks with access to the macOS service now
report the physical phone on iOS 27.2, wired/connected, paired, with Developer
Mode enabled. The physical Series 11 Watch reports watchOS 27.0.1, paired,
local-network tunnel initially **connecting**, then **connected** on the second
check, and Developer Mode **disabled**. Simulator
entries were excluded from these conclusions. Xcode reports 27.0 (27A266a).

This improves on the earlier missing Watch OS metadata and discovery connection,
but does not establish deployment readiness, valid provisioning or successful installation. The
initial sandboxed query timed out initializing CoreDevice; normal host discovery
succeeded, so that timeout is not evidence of a physical-device failure.

The next user-side check is the Watch's Settings → Privacy & Security → Developer
Mode control, following [Apple's instructions](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device).
No device setting, pairing, app installation, feature or data feed was changed.
The development freeze remains in place.

After the Author enabled Watch Developer Mode, a further read-only CoreDevice
check confirmed the physical Watch as **connected**, **paired**, on watchOS
27.0.1 with Developer Mode **enabled**. The physical phone remains connected on
iOS 27.2 with Developer Mode enabled. The earlier connection and Developer Mode
blockers are therefore cleared at discovery level.

A successful read-only installed-app query, filtered to `Storywalker` and
including default apps, returned **zero matching apps** on the physical Watch.
This does not validate signing/provisioning or establish deployment success.
Storywalker installation remains pending. No app was installed or launched, no
data feed was started, and the development/installation freeze remains in place.

Following the Author's manual Watch-app Install attempt, another successful
read-only query again found zero Storywalker apps on the connected physical Watch.
Both physical devices still report Developer Mode enabled. Inspection of the
existing `Debug-iphoneos` bundle confirms its Watch app is correctly embedded at
`Watch/StorywalkerWatch.app`, and both app signatures pass strict verification.
However, the embedded Watch development profile contains one device: the connected
iPhone. It **does not include the connected Watch**. That profile was created on
8 October and expires on 15 October, so expiration is not the observed defect.

This confirms an installability defect in the last built package and is consistent
with the Install button returning. The installed phone's package was not extracted,
and installer failure logs were not captured, so the precise failed attempt is not
independently attributed to this profile. The appropriate next repair is physical
Watch registration, automatic-signing rebuild, verification that the new embedded
profile includes the Watch, then deployment verification. That repair requires the
Author to lift the existing installation freeze for this bounded operation. No
profile was edited, device registered, app rebuilt, installed or launched during
these checks. Device identifiers and certificate contents were not printed.

## Authorized signing/install repair and remaining blocker

On 9 October the Author explicitly approved a bounded exception to the freeze:
register the physical Watch, rebuild with automatic signing, verify the profile,
and install. Feature changes and health/data feeds remain frozen.

The Mac initially had approximately 117 MiB available. Removed only reproducible
task download/build caches and verified older temporary Xcode builds, preserving
the current signed app and its profiles. Space initially recovered to about
2.4 GiB, then filled again during developer preparation. Xcode's iOS device-support
caches occupied approximately 22 GiB; the current iOS 27.2 cache was unfinished.
The completed old iOS 26.7 and 26.7.1 system-symbol caches were each about 5.7 GiB.
Those regenerable caches were removed with permission; current OS support,
signing credentials, app sources and all private evidence were preserved. Free
space subsequently reached approximately 17 GiB. This resolves the observed storage shortage,
but is not proof of completed device-support preparation.

Physical-Watch automatic-signing builds failed before a successful signing/build:
Xcode repeatedly timed out waiting for the Watch destination, reporting
`Connecting`. One retry also exited with code 74 during the disk-space shortage.
Read-only discovery can report the Watch available while the developer service
still cannot establish its tunnel. The Watch lock-state check succeeded after the
Author unlocked it. Apple's installed watchOS DDI metadata reports compatible,
usable support; this does not prove that image is mounted on the physical Watch.
An attempt to prepare it failed with CoreDevice error 4000, nested
RemotePairingError 1001: timeout establishing the negotiated developer tunnel.
The Author confirmed both devices are connected to the same private Wi-Fi.

The Mac has an active tunnel interface and GlobalProtect visibly reports connected.
Apple documents VPN/filter interference with Xcode device communication in
[TN3158](https://developer.apple.com/documentation/technotes/tn3158-resolving-xcode-15-device-connection-issues).
This is a candidate cause, not a confirmed diagnosis. The Author approved a brief
normal VPN disconnect/reconnect test, but GlobalProtect requires a valid ticket
before disconnecting. No ticket/code was entered. The Author asked to cancel the
test; the prompt was cancelled and GlobalProtect was visibly verified still
connected. No VPN, firewall, network filter or managed protection was bypassed.

No replacement app was successfully built or installed, no app was launched, and
no data feed was started. The next external dependency is an IT-approved review
of local Xcode device traffic or an authorized short VPN disconnect test. Signing
profile repair and physical installation remain pending. Temporary command logs
were kept locally; documentation omits device IDs, request codes and credentials.

## High-priority repair follow-up — 9 October 2026

The remaining high-priority code gaps were repaired within the development freeze:

- Vault persistence now excludes competing local OS processes for the entire
  compare-and-replace operation. Existing locks (including symlinks) fail closed;
  exceptional exits release only the lock owned by that operation. Stale snapshots
  are rejected rather than merged or allowed to replace newer evidence.
- Recovery reads/queued edits and Vault/Spotify provider operations revalidate
  their original browser session around asynchronous work. Browser-authorized
  Vault persistence checks again before replacing the encrypted file. Lock/expiry
  prevents disclosure of late provider results and stops new unauthorized writes.
- `VAULT_SESSION_EXPIRED` is intentionally different from `VAULT_LOCKED`.
  An action that already contacted a provider is not automatically replayed after
  unlocking. Private provider and validation errors are not echoed to the browser.

Verification: **46 focused tests across 12 files passed**, along with TypeScript,
ESLint, production compilation and both privacy scans (421 visible source files
and 109 public client/prerender artifacts). After the final route cleanup, all 11
affected route tests passed again. This is a focused result, not a replacement
claim for the earlier mixed full-suite run.
Tests used invented provider responses, mocked recovery I/O and isolated encrypted
sandbox/temp files; no personal evidence was imported, accepted or deleted.

Installed Next 16.3.8, brace-expansion 5.0.12 and source-map-js 1.2.2 were verified
locally. A fresh npm advisory query failed under restricted networking; automatic
approval review then rejected escalation because sending project dependency
metadata to the external npm registry had not been explicitly approved. No
workaround query was made. The earlier zero-advisory result remains historical;
a new result requires the Author's approval of that metadata transmission.

No commit, feed launch, device installation or network/VPN change was made in this
follow-up. Existing private plaintext source copies and SQLite metadata remain
subject to the retention/privacy limitations above.

## Watch-side integrity rejection — new Author evidence

The Author's photo shows the Watch rejecting Storywalker with: “This app cannot
be installed because its integrity could not be verified.” This establishes an
on-device installation verification failure, not an installed/running companion.

The message is consistent with the already documented development-profile defect:
the inspected embedded Watch profile includes the iPhone but excludes the Watch.
That is the leading identified signing/provisioning blocker; the photo alone does
not identify the precise verification error or prove which build was attempted.
The developer tunnel timeout remains a separate obstacle to registration/rebuild.

Apple's [registered-device distribution guidance](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices)
requires registering test devices and including them in the provisioning profile.
The repair path remains: establish the developer connection, register the Watch,
regenerate its development profile, rebuild/sign the embedded Watch app, verify
the Watch is included, and only then attempt deployment under an explicit freeze
exception. This photo review made no device, signing, installation or VPN changes.

## Watch installation and launch — latest Author evidence

A subsequent Author photo shows BODY's mineral pet visibly open on the physical
Watch, with “Waiting for a reading” below it. This confirms installation and UI
launch for the displayed build, superseding the earlier installation-blocked
status. It does not identify the build revision, prove that the previously
inspected profile changed, or establish HealthKit permission/sample receipt or
Watch → phone → Mac transmission.

Read-only source inspection finds the next existing control below the pet:
`Start pet readings`, which requests heart-rate read permission and queries the
latest sample within two minutes. When reading is enabled, the button becomes
`Check available reading`. No returned sample does not establish permission denial.
`Start workout + pet` is a distinct, explicit actual-workout action, with Apple
Health workout storage and higher battery use; it is not needed to start ordinary
pet readings. No device action or code change was made during this documentation
update, and the feature-development freeze remains in place.

## Watch reading and phone acknowledgement — latest Author evidence

The next photo shows a heart-rate reading with its measurement timestamp, the
ordinary “Watch Health reading · latest available” mode and “Received by phone”.
The Watch source sets the latter message only after the phone replies `received`;
the phone bridge emits that reply when its collector accepts the incoming message.
This establishes a displayed Watch reading and phone acknowledgement, not a
verified Mac receipt or accepted Vault evidence. Personal values/times are omitted
from this review.

The Author observes that updates do not match Apple's Heart Rate app in real time.
Source inspection explains the current mode: `HKObserverQuery` and `HKSampleQuery`
read available HealthKit samples; they do not initiate continuous sensor sampling.
Each accepted fresh reading is forwarded using WatchConnectivity without waiting
for an encrypted archive batch. Faster transport cannot create missing samples.

The existing `Start workout + pet` path uses `HKWorkoutSession` with
`HKLiveWorkoutBuilder` callbacks. Apple's [workout session documentation](https://developer.apple.com/documentation/healthkit/running-workout-sessions)
describes higher-frequency heart-rate samples during workouts. That path is for
actual walking/running/indoor cycling, records a workout in Apple Health and has
greater battery cost. No fixed sample cadence, matching of every Apple Heart Rate
UI refresh, or on-device live-workout result is claimed. No session was started or
feature code changed during this review.

## Bounded resumption and foreground connection repair — 9 October

The Author explicitly resumed work after showing a native live-workout-builder
reading and a phone acknowledgement, then reported completing the actual workout.
These establish displayed workout-mode acquisition and phone acknowledgement;
continuous cadence, workout save completion and every-hop latency are not inferred.
Ordinary HealthKit queries resume after the Watch's existing End workout path.

The local BODY server was restarted with Next telemetry disabled. The Author
reopened BODY in Safari and reported a last-registered reading labelled last-known.
The paired private-LAN receiver was verified listening. This is bounded evidence
of the reported display state, not a claim of a currently fresh measurement or
accepted archive evidence. Values and precise personal timestamps are omitted.
Browser automation could not reload its existing error-page address because the
browser policy blocked that protocol; the Author manually reopened the local page.

Source inspection found the phone's retry/heartbeat task attached to the
Connections & data sheet. Closing that sheet cancelled connection maintenance.
The task now belongs to the main foreground app scene for HealthKit pairings,
continues while viewing the pet, and cancels when the scene becomes inactive.
Fresh Watch/collector events still trigger immediate preview delivery. Fictional
pairings are excluded from this maintenance loop; no workout is started by it.
It does not increase ordinary Watch sampling or guarantee background delivery.

Validation: all 21 focused receiver, stream and freshness tests and all 27 native
core tests passed with invented readings. The final signed iPhone/embedded Watch
build succeeded; both signatures and the profile device inclusion and bundle
identifiers were verified. The updated phone package was successfully installed
through CoreDevice. No Watch-target install command, pairing reset, beta change,
VPN change or external health-summary export was performed. The existing
summary-export setting was verified off. The public source audit passed across
421 visible files, and the working diff whitespace check passed.

The temporary companion feed is deliberately not persisted across phone app
restarts. The Author must re-enable it after this phone update. Verifying
phone connection continuity while the Connections sheet is closed remains an
on-device acceptance check; test/build success is not substituted for that check.
