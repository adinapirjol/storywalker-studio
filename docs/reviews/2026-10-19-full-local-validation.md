# Expanded local review package — validation, 19 October 2026

This is implementer verification of the expanded draft PR, not independent
security approval. The Author selected all current committable development
changes, including Vault, Watch and HEALTH, for the same review PR. The
[Claude brief](2026-10-19-listening-again-claude.md) maps the full scope.

## Snapshot and exclusions

Preparation base: `8f0754c0a6353f3a732c99706f39d7987b330e92`. The PR description
records the proposed head; the reviewer must report the exact SHA examined.
The 194 meaningful changed/new development paths were copied and byte-checked
against the active checkout, then tested in a separate public-source worktree.
A stray trailing character in the Claude instruction stub was removed; its
AGENTS reference remains unchanged. The only additional review files are the
brief and this receipt. No feature source changed after the recorded test runs.

Private data, environment credentials, account exports, sampled audio, Ableton
projects, production receipts and native pairing/queue state were excluded.
No live account fetch, Vault unlock/import, receiver activation, native install,
pairing reset or external export was performed for this validation. The active
checkout's branch and index were preserved. Publication of the code/documentation
package does not authorise publication of its private inputs or recordings.

## Fresh local results

| Check | Result |
|---|---|
| JavaScript regression suite with coverage | 570 tests in 120 files passed. Lines 55.77%, above the configured 50% threshold. Statements 45.58%, branches 42.99%, functions 42.54%; those are not the configured gate. |
| Python validator suite with coverage | 84 tests passed; coverage 88.64%, above its 50% threshold. |
| Swift collector package | 29 tests passed, zero failures. |
| iPhone and embedded Watch | Unsigned generic iOS Simulator build succeeded, without installation. Each target used its own SDK. |
| TypeScript and lint | Both passed. |
| Fictional Aurora Coast demo | Passed: synthetic source counts and confirmation/rejection/revision invalidation remained stable. |
| CI scope selector | 11 tests passed, including full-PR comparison and fail-closed selection. |
| Public source audit | Passed in the active checkout, including its local private-marker guard, and in the isolated review copy. No forbidden private paths or credential values reported. |
| Production build | Next 16.3.8 Turbopack build passed using the isolated review output. Direct build deliberately skipped the unrelated Are.na prebuild refresh. |
| Generated artifact privacy | 122 public client/prerender artifacts passed; 49 deployment trace manifests contained no private input references. |
| Vendor integrity | Five tracking runtime/model files matched the SHA256 values in their existing provenance README. This is an integrity comparison, not an independent source/license audit. |
| Documentation | 50 relative links checked at preparation time; no missing targets. Staged whitespace validation passed. |

Locked dependencies were installed without lifecycle scripts. Local JavaScript
checks used Node 25.6.1; Python used 3.14.8. CI uses its configured Node 22 and
Python 3.13; do not treat local results as proof those remote jobs passed.

The production build emitted two existing dynamic-filesystem tracing warnings
in the Vault snapshot guard. Tracing exclusions and the artifact audit passed;
the warning remains a review consideration, not a claim of absent dynamic access.
Xcode reported that the running CoreSimulator service was older than the selected
toolchain and disabled simulator device support; unsigned compilation still
completed successfully. No simulator launch/runtime trial is claimed. AppIntents
metadata was skipped because those targets do not depend on that framework.

## Acceptance evidence and remaining work

The [revised 13 October direction](../research/ctm-2027/direction-2026-10-13.md)
records earlier Author-confirmed trials of the corrected source section,
keyboard chops and XR hand-shaped playback. These first-party confirmations are
separate from this automated verification. The IOANA source and audio are not
bundled. No hands, microphone, personal Health records or real phone delivery
were exercised during PR preparation.

Historical reports retain their dates and counts. They do not replace the fresh
results above. This receipt does not reverify account collection, scheduled
execution, real delivery, audio release permission, clinical claims, broad
accessibility or later-date revisits. Device/network/session variations still
need appropriately scoped acceptance evidence.

Required CI results must be checked on the proposed head, including each
applicable Actions, JavaScript/TypeScript, Python and Swift CodeQL lane. A green
aggregate or a prior documentation-only run is insufficient. Independent Claude
security review, finding resolution/recheck and explicit merge authorisation
remain pending under the [review policy](../code-review-guidelines.md).
The PR remains a draft and has not been merged.

## CI portability follow-up — 19 October 2026

The first remote quality run on `7a28fe40460d4b78a9a13cf74fa777a2362a0ec9`
passed 84 Python tests, then failed one of 570 JavaScript tests because the
HEALTH source-boundary test spawned `rg`, which was not installed on the runner.
This failure did not establish a private-data leak; the guard could not execute.

The test now enumerates committable app/component paths with the already-required
Git tool, then reads and checks them with Node. Its original HEALTH allowlist and
transport/storage checks are retained. An explicit expected-page assertion prevents
an empty scan from passing. No runtime, cryptography, session, collector, consent,
workflow or permission policy was changed.

Reproduction and follow-up used only fictional inputs in the isolated worktree:

- With `PATH=/usr/bin:/bin`, the original test reproduced `spawnSync rg ENOENT`.
- With the same restricted PATH, the corrected HEALTH suite passed all 17 tests.
- The complete JavaScript coverage suite then passed all 570 tests in 120 files;
  line coverage remained 55.77%, above the unchanged 50% threshold.
- A disposable unapproved HEALTH reference outside the allowed paths was correctly
  rejected by the guard. The probe was removed and the clean guard passed again.
- Typecheck, lint, whitespace and public source privacy audit passed.

Only the test and this receipt changed. Earlier production/Python/native results
above remain dated evidence for the unchanged runtime source; they were not rerun
or represented as new device acceptance. Remote CI must still pass on the updated
head, and Claude's review must identify which revision and follow-up diff it covers.
Artistic CTM critique is separate from the software security review and is not a
PR merge gate. Independent security review and merge authorisation remain pending.

## Security remediation follow-up — 19 October 2026

Claude's independent [report](2026-10-19-claude-pr6-security-report.md) covers
`7a28fe40460d4b78a9a13cf74fa777a2362a0ec9`, not this follow-up. All CI checks,
including each of the four CodeQL language lanes, subsequently passed on the
CI-portability head `4d8a661ab94c19732be6fb042ac6fb3b152363e1`. Those results
do not validate later runtime changes. The proposed final SHA and its current
CI status belong in the PR description; independent recheck is still required.

All remediation and verification used the isolated public-source worktree,
fictional encrypted sandboxes and temporary catalogs. The running app, personal
Vault, accounts, staged personal sources, native pairing and devices were not
opened or modified. No general retention pruning was enabled or performed.

| Claude finding | Implemented behavior and regression evidence | Status |
| --- | --- | --- |
| 1 — HEALTH implicitly accepts while BODY says Off | Removed the legacy HEALTH acceptance fallback. Only explicit receiver acceptance can accept matching paired batches. `pr6-security-regressions.test.ts` verifies unset/Off stays pending with research connected. Existing mixed-batch/receipt tests retain explicit opt-in coverage. | Implementer verified; independent recheck pending |
| 2 — research key limit blocks deletion | Count live sleep records after applying the overlay once; heart-rate rows/tombstones do not consume the limit. Analysis errors invalidate derived runs in the same transaction as source writes, preserve authored context, and mark refresh required. Tests cover 10,201 tombstones and a true live-sleep overflow during deletion. | Implementer verified; independent recheck pending |
| 3 — administrative/recovery copies enter retrieval | `record-policy.ts` is shared by Atlas, search, evidence packs (including Director choices) and local indexes. Canary tests reject backups/admin records while an ordinary reference remains searchable. Existing accepted source evidence remains available after deselection. | Implementer verified; independent recheck pending |
| 4 — backup growth | [Concrete retention proposal](2026-10-19-backup-retention-proposal.md), with preview and approval before pruning. Existing copies are unchanged. | Open; no deletion policy accepted |
| 5 — revoked credential copies survive | Future address history contains metadata only. Explicit Revoke removes previous address-repair copies and receiver credentials with encrypted replacement/compaction. Fictional repair/revoke tests cover both paths. Separate OS snapshots/backups are outside that erasure claim. | Implementer verified; independent recheck pending |
| 6 — sync precedes delivery of the session cookie | Authentication returns its cookie before any sync. Successful browser unlock dispatches delivery; run/poll retain session checks and request cancellation. A cancelled run stops only its session's receiver. Auth/route/access/unlock tests cover ordering, cancellation and late access loss. | Implementer verified; independent recheck pending |
| 7 — successful writes reported as failed | Receipt failure retains confirmed source results; Calendar reports saved/missing separately; committed review/candidate/Control Room writes return a content-free saved/reload acknowledgement after access ends. Guards remain in place. Calendar staging fsyncs contents and the catalog directory, and reports post-rename uncertainty without retrying. Fault and expiry tests verify saved state without releasing private payloads. | Implementer verified; independent recheck pending |
| 8 — Safari permission-prompt blur | No new physical Safari permission trial was performed. Existing resource ownership is unchanged. | Unverified usability concern; no waiver recorded |
| 9 — legacy batch ownership | Unknown receiver identity now requires manual review, rather than adopting the current pairing's grant. New paired deliveries still work; a fictional legacy batch can still be accepted explicitly. Queue/evidence is preserved. | Implementer verified; independent recheck pending |

Before fixes, four isolated regressions reproduced findings 1–3 and 5 against
the old behavior. A later controlled comparison temporarily loaded the previous
public source for the newly added outcome/ordering tests: 11 tests failed across
7 files, including unlock ordering, cancelled sync, receipt failure, partial
Calendar, late committed review/import outcomes and legacy ownership. All edited
sources were restored in `finally`; no Git reset, personal-data mutation or real
receiver operation was used. The Calendar directory-fsync fault uses an injected
filesystem failure in temporary fictional storage; it was not a real disk crash.

Final local checks after restoration and fixes:

- **592 JavaScript tests in 123 files passed**, with **56.27% line coverage**;
  the configured 50% threshold is unchanged.
- Explicit typecheck and lint passed. Production Next build passed with the same
  two existing dynamic-filesystem tracing warnings; the unrelated Are.na refresh
  was not invoked.
- Generated-artifact privacy audit passed: **122 public artifacts and 49 server
  deployment traces**. Public source audit passed for **600 visible files**.
- No Python/Swift contract, native source, dependency lock or CI workflow was
  changed by this follow-up. Prior Python/native checks remain dated evidence;
  required remote CI must pass again on the proposed head.

This is implementation evidence, not an independent security approval. The PR
stays a draft, retention and the Safari concern are unresolved, and final Claude
recheck plus explicit merge authorization remain required. CTM artistic critique
is separate and does not block the software merge.
