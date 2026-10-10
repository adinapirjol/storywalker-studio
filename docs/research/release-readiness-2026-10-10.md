# Storywalker release readiness after the 10 October refactor

**Recommendation: go for the reviewed feature-branch commits and pull request;
manual release acceptance remains pending.** The high-priority summary-consent defect identified during this
review has now been repaired with permanent regression coverage. Check the exact
contents and dependencies of each proposed commit before staging; the groups are
now checked as cumulative public-source copies, with the native limitations below.
The Author has now explicitly authorized controlled commits, a feature-branch push
and a pull request. This does not authorize a merge, release or device deployment.

This reviews the working tree, including previously uncommitted BODY/native work,
shared access and passkeys, privacy repairs, fictional Aurora coverage and the
latest presentation changes. The initial review made no Git mutations. No real
passkey ceremony, device installation, Watch session, private feed or external
health export was launched for this review. Private records were not decrypted
or reproduced in this report. The [earlier source review](review-2026-10-10.md)
and [security baseline](security-review-2026-10-09.md) provide historical context.

**Latest documentation refresh, 10 October:** the Author confirms existing
phone-assisted passkey unlocking in Safari and Codex; recovery access was also
confirmed earlier. The Bluetooth wait was temporary. Local Touch ID remains
unverified for the release build; no policy or credential was changed. README now
describes the Watch/phone companion pair and includes a paused fictional Aurora
BODY browser screenshot. Native icons are identified as icons, not device
screenshots. The checks refreshed below do not constitute a new full code review
or manual acceptance of the remaining cases.

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

## Earlier cumulative preparation checks

Only public HEAD/source files and installed dependency runtimes were copied to an
isolated temporary directory. Private storage, credentials and signing settings
were not copied. The main Git index stayed empty. The copies contain the proposed
groups in order; no intermediate Git commits or remote operations were created.

| Cumulative boundary | Fresh local result |
| --- | --- |
| Group 1 | Normal Turbopack production build, 231 tests / 56 files, lint and build privacy audit passed; 88 public build artifacts. |
| Group 2 | Normal build, 323 tests / 75 files, 66 Python contracts, lint, source/build privacy audits passed; 353 visible source files and 88 build artifacts. |
| Group 3 | Type checking and source privacy audit passed; 394 visible files. No web source changed in this group. Earlier native core tests and the latest unsigned Watch compilation remain separately recorded evidence; no new native build/install was run for this partition check. |
| Group 4 | Normal build, 354 tests / 84 files, lint, source/build privacy audits passed; 443 visible files and 109 build artifacts. |
| Group 5 | Documentation-only overlay source privacy audit passed; 448 visible files. The full working tree has 450 visible files because its two deferred paths are excluded from this copy. |

JavaScript checks used one worker and serial file execution on the host so
synthetic loopback tests could run. Initial snapshot-harness runs failed because
Git metadata was absent, test workers timed out, Python was invoked from the wrong
directory, and a temporary runtime symlink was committable. Corrected runs above
passed without changing assertions or production limits. An alternate Webpack
build failed loading `createRequire`; the project's normal Turbopack builds passed.
Do not interpret this as validation of a Webpack deployment.

The installed Next guide recommends ignoring/untracking generated `next-env.d.ts`
and running type generation before standalone type checking. The final foundation
boundary includes its index-only deletion, the ignore rule and `next typegen &&
tsc --noEmit`. The active local generated file is preserved; it is not hand-edited.

## Proposed commit groups and dependencies

These are the complete-file boundaries for the Author-authorized commit sequence.
The ignored local path/hash inventory contains **253 changed paths**, including
**one generated-file deletion**, with **one separate-scope script deferred**. Its exact paths
remain local review material. Static local TypeScript import checks found no
forward edges between the proposed groups. Cumulative builds/tests above supplement
that check; native device behavior and hosted CI remain separate gates. Compare
the actual staged snapshots with these reviewed boundaries when authorized.

| Order | Proposed group | Main contents | Dependencies and gate |
| --- | --- | --- | --- |
| 1 | Shared Vault access and privacy foundation — 56 paths | Ignore rules, origin/request guards, atomic Vault storage, sessions, shared modal/client, passkey lifecycle, protected-route adapters, patched dependencies and security tests | Foundation. Storage, session and passkey adapters refer to each other; keep them together. Basic real-provider unlock is Author-confirmed; remaining lifecycle acceptance is pending. |
| 2 | BODY evidence streaming and Pydantic research integration — 89 files | Transfer/research schemas, Python validators and locked environment, atomic acceptance/deletion, BODY mapping, pinned receiver, bounded browser stream, optional summaries/events and consent regression tests | Group 1. Keep receiver/telemetry integration and their contracts together. The changed CI preparation is included with this group. |
| 3 | Native phone and Watch companion — 41 files | Swift sources, assets, project configuration, collector tests, WatchConnectivity, Connections & data, meditation default and matching permission copy | Groups 1–2 provide the local integration contracts. Unsigned Watch simulator compilation passed; latest native behavior still needs physical acceptance. |
| 4 | Fictional Aurora and XR presentation — 56 files | Fictional fixtures, BODY fourth view, shared WORLD/TIME/MEMORY/BODY navigation, spatial/enrichment changes and public resources, including the fictional BODY screenshot | Groups 1–2 and relevant shared presentation contracts. No physical native deployment is required. Saved spatial regime/schema remains WORLD/TIME/MEMORY; Aurora enables no real feed or export. |
| 5 | Documentation and review guidance — 11 files | README, access/privacy architecture, review guidelines and review/acceptance reports | Reconcile with groups 1–4. Do not publish local inventories, signing configuration or the ignored private NOVA handoff. |

The deferred path is `scripts/spotify-snapshot-diff.py`. Its generic code contains
no private dataset, but it can write full source rows to an arbitrary output path;
ignored-output enforcement should be reviewed in its own change. The sanitized
6 October CTM checkpoint is included with documentation so the NOVA reference
resolves. Its historical verification claims remain dated. `next-env.d.ts` is
removed only from Git tracking and remains available locally.

Do not use a blanket add. Review the staged patch for every group, including
new files and binary assets, and repeat repository/build privacy audits for the
final public snapshot. A documentation commit cannot describe a blocked feature
as release-ready.

## Git privacy verification

The latest metadata checks covered 59 existing files in the known private storage and local
credential locations. **All were ignored; none were in Git's index.** No tracked
file matched the current ignore rules, and the index contained no staged changes.
Earlier bounded scans of seven configured credential/signing values, and six in
the later biometric follow-up, had no matches in publishable text. Final commit
preparation separately checked three configured provider secret values without
matches; these counts describe separate scans, not a single exhaustive scan.
The initial broader scan's configuration-type
matches were not secret values. No private-key PEM block was found in the scanned
publishable text.

| Material | Exclusion checked |
| --- | --- |
| Encrypted Vault database and passkey key wrappers | `private-data/`, including Vault storage and passkey sidecar |
| Recovery staging, private notes, review inventories and local signing settings | Ignored `private-data/` storage and private/local filename rules |
| Provider credentials and OAuth caches | Local environment files, `.logfire/`, Spotify local token/state files; `.env.example` remains intentionally public |
| Native provisioning/signing secrets and generated products | Provisioning profiles, private key/certificate containers, local signing overrides, native caches/user data and ignored build outputs |
| Raw imports, derivatives and private exports | Ignored private input/output roots and private filename rules |

The latest public repository audit passed for **450 visible files**, including
untracked publishable source and the fictional BODY screenshot. The production
privacy audit was repeated on the existing isolated build output and passed for
**110 public client/prerender artifacts**; this was not a new production build.
Known private-path searches previously found no
entries in locally reachable Git history. This is a bounded path/value audit,
not a comprehensive content audit of historical commits, remote repositories,
other backups or every possible secret pattern. Binary-content review is separate
from text scanning. The new BODY browser screenshot was visually checked as
fictional and paused, with no personal readings or credentials; private device
photos were not published as README assets.

Ignore rules prevent normal Git inclusion; they do not encrypt plaintext recovery
staging or local credentials. Source enforces owner-only storage and encrypted
Vault records, but filenames/database metadata, process memory, same-user access
and backup policy remain relevant. No blanket claim of anonymization is made:
optional aggregate heart-rate exports are sensitive data even without raw packets.

## Evidence, timing, deduplication and consent

Source inspection and regression coverage found these boundaries preserved:

- **Evidence:** incoming previews are temporary, not accepted evidence or canon.
  Encrypted archive staging, explicit review/acceptance and acknowledgement remain
  separate. Acceptance validates retained chunks before one atomic save. Health
  sources remain excluded from general Atlas/Director retrieval.
- **Timestamps:** measurement start/end, app receipt, first Mac arrival and latest
  contact remain distinct. Duplicate preview contact does not rewrite the first
  arrival. Stored measurement instants retain precision; display formatting and
  timezone conversion do not replace source timestamps. Cross-device differences
  include scheduling and clock skew and are not measured network ping times.
- **Deletion and deduplication:** batch identity/content checks, observation keys
  and tombstones protect archive replay and deletion. Derived timing uses surviving
  evidence. A displayed zero deletion count is not proof that a source never had
  deletions. Preview streams deliberately coalesce slow-consumer updates; they are
  not a durable evidence queue.
- **Research rules:** repeated support, gaps, freshness and context remain explicit;
  absent measurements do not prove persistence. Rest confirmation is authored and
  time-limited, never inferred from a meditation/workout label. Watch preference
  uses declared source metadata. Direct Watch previews and later Health archives
  can represent the same bodily measurement under different transport identifiers;
  their counts must not be added as unique beats.
- **Author consent:** authentication grants access, not evidence acceptance,
  editorial approval or export consent. Summary and event export are separate opt-ins
  and use allowlisted packets. BODY poses remain artistic choices. The confirmed
  summary-setting defect found in this review is repaired as described below.
- **Aurora:** the pet is now the fourth view beside WORLD/TIME/MEMORY. It starts
  paused with invented data; source/scene format is unchanged. Browser checks
  confirmed entry and return through all three spatial views. Switching away stops
  the mounted BODY sound/playback; returning resets its local presentation controls.
- **Native session label:** Meditation is first/default under the Watch pet and maps
  to HealthKit Mind and Body. It is a user-started workout session, not a claim that
  Mindful Minutes are written or rest context has been confirmed. Physical save and
  display behavior have not been accepted yet.

## Manual passkey acceptance checklist

**Latest Author confirmation, 10 October:** the existing phone-assisted passkey
unlocks the Vault in Safari and the Codex browser. The reported Bluetooth wait
was temporary. Keep the existing credential and recovery fallback. Local Touch
ID is deferred; this confirmation does not pass the remaining lifecycle tests.

**The Author confirmed successful basic passkey and recovery-passphrase access
on 10 October.** This does not confirm the remaining lifecycle cases below, or
Touch ID specifically. Use the configured exact
origin (default `http://localhost:3000`); `127.0.0.1` has a separate browser session
and is not an equivalent passkey relying-party address. Keep credentials and
private record contents out of screenshots, logs and the acceptance report.
Record only browser/provider, date, case and result. Preserve local recovery
access and a private backup before testing; do not delete existing credentials.

- [ ] **Recovery preparation:** verify the recovery passphrase is available locally
  and the Vault/sidecar backup is retained privately. No credentials go into chat.
- [x] **Basic access:** Author-confirmed existing phone-assisted passkey unlock
  in Safari and Codex, plus earlier recovery-passphrase access. Enrollment steps,
  failure cases and local Touch ID were not accepted by this confirmation.
- [ ] **Enrollment:** unlock through the shared recovery modal, acknowledge recovery,
  add a test passkey and approve the provider ceremony. Complete the separate
  encryption check. Enrollment is saved only after successful PRF verification.
- [ ] **Enrollment cancellation/unsupported provider:** cancel either ceremony and
  check no usable local wrapper was saved. Missing PRF fails closed and recovery
  still works. A provider-created entry may remain after a failed encryption check;
  distinguish that entry from a saved Vault wrapper.
- [ ] **Lock/unlock:** lock and confirm private views clear and protected actions
  are denied. Unlock with the enrolled passkey at the same origin. Locally verify
  existing evidence is unchanged; do not copy it into the report.
- [ ] **Expiry:** wait through the fixed 15-minute session lifetime. Interaction
  must not extend it. Private views/streams clear, and expired operations need a
  new explicit action rather than silently replaying mutations/provider calls.
- [ ] **Expiry during work:** confirm a pending protected operation cannot persist
  or release private results after expiry/lock. Separately verify the repaired
  export-setting race with a synthetic test, not a real private export.
- [ ] **Failed authentication:** provider rejection, timeout and a wrong/nonmatching
  credential leave the Vault locked. Retry succeeds only through a fresh ceremony;
  no duplicate pending action executes.
- [ ] **Cancellation/navigation:** dismiss the modal or leave during a ceremony;
  owned work stops and focus returns appropriately. Already-issued server writes
  cannot be assumed undone merely because a response was cancelled.
- [ ] **Address boundary:** another local address shows appropriate guidance and
  does not grant passkey access or leak credential labels. Do not weaken origin/RP
  verification to make a test succeed.
- [ ] **Recovery fallback:** from locked state, a wrong recovery passphrase fails
  without resetting storage; the correct one unlocks existing evidence unchanged
  even when the passkey provider is unavailable.
- [ ] **Restart:** server restart invalidates sessions and pending challenges;
  saved recovery/passkey access still works through a new unlock ceremony.
- [ ] **Optional test-credential removal:** only after recovery succeeds, remove
  the newly enrolled test wrapper. Pending unlocks for it fail; provider entries
  and independent existing sessions have separate lifecycles. Do not remove the
  Author's pre-existing credential as part of acceptance.

## Verification and remaining physical-device tests

| Check | Observed result in this review |
| --- | --- |
| JavaScript/TypeScript suite | Latest isolated cumulative source check: 354 tests / 84 files passed on the host with bounded concurrency. Earlier consent/passkey runs and their sandbox limitations remain separately recorded below. |
| Python contract suite | 66 passed; synthetic inputs |
| TypeScript, ESLint, whitespace | Passed; repeated after the consent repair |
| Production build | Passed after the consent repair in ignored isolated output, telemetry disabled; optional network-refresh prebuild hook bypassed. A stale output-directory cleanup error on the first attempt was resolved by moving that generated output into ignored temporary storage and rebuilding fresh. |
| Repository/build privacy audits | Working tree: 450 visible files and 110 existing review-build artifacts passed. Prepared source copy: 448 visible files and 109 freshly built artifacts passed. All 59 known private files were ignored and absent from the main index; zero staged files. Counts describe different outputs/scopes. |
| Summary-consent race | Initially reproduced with a mocked local test; now covered by permanent security regression tests for rename expiry, final-read expiry, paused exports, superseding Stop, rollback ordering and cleanup failure. No real network or private input used. |
| Watch simulator compilation | Unsigned simulator build passed. The latest Watch source, including the shortened session button label, was compiled again successfully during final commit preparation. Duplicate usage-description keys found in the permission plist were removed; plist validation passes. No physical install/session. |
| Native collector unit tests | 27 passed on the host. Sandbox compiler/cache restrictions required a host rerun; synthetic core tests do not prove HealthKit/device behavior. |
| Browser presentation | Four Aurora views and fictional pet verified; no real authentication ceremony |
| Hosted CI/dependency advisories | Changed CI has not run on GitHub. Installed patch versions were inspected; no new external advisory query is claimed. |

Physical acceptance still needs: the remaining passkey lifecycle cases above;
verification of the latest native revision on the signed phone/Watch installation
and relaunch when separately authorized; Health permission rejection/recovery;
Meditation start/end and the actual saved Health record's type/duration; Watch
scroll versus pet rotation and Digital Crown behavior; live builder measurement
delivery while reachable; background/unreachable transitions and phone fallback;
same-network pinned Mac delivery, stale/last-known rendering and lock/expiry;
reconnect without old preview replay; duplicate/deletion receipt handling across
real transport retries; and real opted-in Logfire capture/stop/cadence checks using
Author-approved input. None of these remaining cases is marked passed here. Historical photos/device runs
do not validate the latest build.

## Consent repair applied

The original finding was high priority: a session expiring during the settings
rename could leave a failed enable durable across restart. Summary settings now
remain paused through disk verification and the final authority/generation check.
If persistence completed but verification fails, the same serialized operation
removes the attempted configuration before a later save can run. Missing consent
defaults to off after restart. No asynchronous work occurs between the final
check and activation/result construction.

Permanent tests cover expiry at the rename and final read, no export while the
save is unconfirmed, a newer Stop superseding enable, cleanup completing before
a newer authorized enable, and filesystem rollback failure. The UI distinguishes
session expiry from an ordinary locked state, clears stale displayed status and
requires an explicit retry; it does not automatically replay the enable request.
The message describes this attempted enable as cancelled, without claiming that
any separately authorized earlier setting was changed before persistence began.

Disk cleanup failure is surfaced as an error and keeps current-process exports
paused. A process crash or filesystem failure preventing rollback cannot promise
durable cancellation; inspect saved consent before restarting a real feed after
such a failure. Existing legitimate consent was not reset by this code repair.

## Remaining risks and commit decision

The biometric-assisted unlocking follow-up reused the existing enrolled-passkey,
PRF wrapping and session architecture. Its only production changes are ordered
non-binding platform/cross-device hints, primary unlock styling, on-device
verification copy and accurate retry guidance in the shared modal. No real
credentials were enrolled or removed. Signature/origin/RP/counter verification,
PRF requirements and fixed session policy are unchanged.

Follow-up verification passed 45 focused synthetic checks, then the complete
354-test suite across 84 files on the host, type checking, lint and a fresh isolated
production build. The initial complete suite had five sandbox loopback-listener
permission failures and 349 passing tests; the permitted host rerun passed all
354. Privacy checks covered 58 known ignored private files, six configured
credential/signing values and private-key blocks with zero publishable matches.
The remaining [Mac/browser checklist](../vault-passkeys.md#manual-macbrowser-acceptance--10-october)
cases remain pending. Existing phone-assisted unlock in Safari and Codex is now
Author-confirmed; this does not establish local Touch ID or Face ID acceptance,
fresh enrollment, or the lock/expiry/failure cases.

| Severity | Risk and release condition |
| --- | --- |
| Medium | Basic passkey and recovery access are Author-confirmed; enrollment, expiry, failure and other lifecycle cases remain pending. Synthetic cryptography verifies contracts, not all provider behavior. Do not call passkeys release-accepted until the Author completes the checklist. |
| Medium | Latest native UI, meditation save, sensing and background delivery need physical verification. Do not present the simulator/core tests as device acceptance or continuous sensing. |
| Medium | Summary dedup/support state is process-local and bounded; restart, rule changes and later archives can create repeated aggregate events. No exactly-once delivery, durable outbox or exhaustive unique-beat accounting is promised. Document this when interpreting Logfire frequency. |
| Medium | Single-process sessions/file locking and browser trust are local-app boundaries. Crashed lock recovery, failed consent rollback, disk/backup protection and same-user threats need operational care; a hosted/multi-process service requires redesign. |
| Medium | Hosted CI remains pending until the pull request runs it. The fresh npm query reports zero vulnerabilities; that is an advisory-database result, not proof of absence of security defects. Native device acceptance remains separate. Current CI runs for pull requests/main pushes, not a feature-branch push alone. |
| Low | The alternate Webpack snapshot build failed route loading. Only the normal Turbopack build is validated; review compatibility before changing bundlers. |
| Low | Some large integration modules remain hard to review despite extracted access/transport owners. Avoid further feature accumulation; keep policy and cancellation ownership explicit. BODY view-local controls reset when unmounted. |

**The reproduced high-priority consent blocker is resolved. Go for controlled
feature-branch commits and a review pull request after the final checks pass.**
Publishing a release still requires the relevant manual passkey and physical
tests; basic access is recorded only from the Author's confirmation. The current
Git authorization comes directly from the Author, not from this report.
