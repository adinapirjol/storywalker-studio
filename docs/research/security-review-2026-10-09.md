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
- Passkey enrollment, expiry, explicit lock, rejection and recovery failure cases
  require acceptance against the release build. Historical basic access does not
  establish every authenticator method or failure case.
- Native installation and displayed readings are distinct from verified archive
  delivery and current-build acceptance. The **Start meditation** action maps to
  HealthKit Mind and Body and has compiled for the unsigned Watch simulator;
  physical save, sensing and background behavior remain separate checks.
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
- Import/reference searches found no removable source orphan. `lib/vault/sql-js.d.ts`
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

1. Physical-device delivery, sampling and acknowledgement need acceptance against
   the exact release build; historical demonstrations do not establish current
   state or release readiness.
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
Durable audit boundaries are recorded in `AGENTS.md`; historical test counts
describe their original runs, not current device state.

## Physical-device verification boundary

Device discovery, signing, installation, sensing, phone acknowledgement, Mac
receipt and Author acceptance are separate checks. Automated tests do not establish
physical-device readiness or current source freshness. Keep detailed device and
network diagnostics in ignored local notes, not public review records.

Do not bypass managed network protections or reset pairing during an audit.
Use Apple's [device connection guidance](https://developer.apple.com/documentation/technotes/tn3158-resolving-xcode-15-device-connection-issues),
[Developer Mode guidance](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)
and [registered-device distribution guidance](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices)
when a separately authorized deployment needs troubleshooting. A signed embedded
Watch app must include the intended device in its provisioning profile; successful
discovery alone is not proof of this.

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

## Native sampling and connection-maintenance findings

Ordinary `HKObserverQuery` / `HKSampleQuery` reads available HealthKit samples;
transport improvements cannot create missing measurements or promise continuous
cadence. Explicit workout acquisition uses `HKWorkoutSession` and
`HKLiveWorkoutBuilder`; it has separate Health permissions, storage and battery
implications. See Apple's [workout session documentation](https://developer.apple.com/documentation/healthkit/running-workout-sessions).
A phone acknowledgement establishes neither Mac receipt nor accepted Vault evidence.

Source inspection found connection maintenance owned by the Connections & data
sheet, so closing the sheet cancelled it. The repair gives the foreground app scene
ownership for HealthKit pairings and cancels when the scene becomes inactive.
Fictional pairings are excluded; no workout is started by this loop. The temporary
preview remains opt-in and is not persisted across phone restarts. No background
delivery guarantee is made.

Verification of that repair: 21 focused receiver, stream and freshness tests and
27 native core tests passed using invented readings. Physical phone/Watch continuity,
permission handling, lock/expiry and receipt dequeue still need acceptance against
the exact release build. Public test results do not establish current device state.
