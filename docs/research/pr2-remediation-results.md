# PR #2 — independent-review remediation results

10 October 2026. Existing branch `codex/xr-atlas-aurora-preview`, unchanged HEAD
`a2df4b00bbf5223a9c3d32b405937fc4e4ec01bf`, verified against GitHub PR #2.
Source: [Independent Review in Notion](https://app.notion.com/p/3f5264f90c2881bb9054cd148304ef89).
All changes remain unstaged. No commit, push or merge was performed.

## Reproduction before production changes

The new tests ran against the original PR code before the fixes:

| Finding | Observed failure | Regression evidence |
| --- | --- | --- |
| H1 | Browser stage and native delivery invoked the summary exporter before review; delivery also invoked the threshold path | `lib/native/pr2-consent.test.ts:15–26`; two failing cases, with Accept/Delete already passing |
| M1 | Negative BPM, 9,000 BPM, measurement in 2046, and receipt six years before measurement all failed to raise `ValueError` | `research/rehearsal-dramaturg/tests/test_pr2_validation.py:16–18`; four failing parameter cases |
| L1 | Capture opened the Vault, rotated the session and mutated; lock revoked the session; probe accepted a forbidden passphrase | `lib/vault/pr2-passphrase.test.ts:9–17`; three failing cases |

Original run: **5 JS failures / 2 passes**, **4 Python failures**. Local logs:
`/tmp/pr2-red-js.log`, `/tmp/pr2-red-python.log`. These contain fictional inputs
and fictional session tokens only. They are not public artifacts or real credentials.

## Fixes and file/line evidence

| Fix | Source evidence | Behavioral verification |
| --- | --- | --- |
| Stage stays private/pending; neither stage nor Accept exports | `app/api/context-native/route.ts:30`; `lib/native/native-receiver.ts:160`; Accept/Delete still delegate only to the local decision function | `lib/native/pr2-consent.test.ts:15`; real fictional encrypted sandbox in `lib/body/pr2-reviewed-export.test.ts:33` |
| Separate explicit export selects accepted surviving evidence and checks revision | `app/api/context-native/route.ts:39–42`; `lib/body/health-summary.ts:130–136`, using `privateBodyEvidence` | `lib/body/pr2-reviewed-export.test.ts:33–55`: pending, refused/deleted, accepted, no consent, consent, stale revision and repeated delivery |
| Current consent, legacy reconfirmation, Stop/expiry and bounded repeated sends | `lib/body/health-summary.ts:26–33,63–74,101–125`; versioned request policy in `app/api/context-summary/route.ts:19,23` | `lib/body/pr2-reviewed-export.test.ts:46,57,68`; `lib/body/health-summary-security.test.ts:23–154` |
| Remove live-window summaries and batch-driven threshold export; retain separately consented unreviewed live lane | `lib/native/native-receiver.ts:97–98,160–162`; `lib/body/health-threshold.ts:16–23,53–59,94–106,122–124` | `lib/body/health-threshold.test.ts` tests default-off, legacy/restart, consent expiry before evaluation and during transport, Stop and receiver-validity checks |
| Explicit Author-facing consent labels | `components/body/connections/context-native-transfer.tsx:23–25,40,47`; `components/body/connections/health-summary-feed.tsx:26–34`; `components/body/connections/health-threshold-feed.tsx:28,45–46` | Production compilation/typecheck; no live-browser or real-export acceptance claimed |
| Research BPM envelope 0 < BPM <= 300 | `research/rehearsal-dramaturg/dramaturg/context/models.py:10–11` | M1 tests plus adjusted prior 500/999.5 BPM tests; three JSON schemas regenerated with `scripts/contracts.py` |
| Injectable validation clock; bounded receipt/future skew; original timestamps retained | `context/models.py:51–58`; `dramaturg/native_transfer.py:38–39,62–68,74–75`; `lib/native/native-transfer.ts:23`; `lib/validation/private-validator.ts:8–13` | `test_pr2_validation.py:37–48` checks exact 120-second boundary, rejection at 121 seconds and original offset/string preservation |
| Passphrase rejected before cookies, session operations or Vault access except initialise/unlock | `app/api/vault/route.ts:167–169` | `lib/vault/pr2-passphrase.test.ts:9–17` verifies unchanged session IDs/count, valid old token, no Vault open/mutation, no response cookie |

The [consent and validation contract](health-export-consent.md) records the
separate decisions, reconfirmation policy, timestamp semantics, research bounds,
and the inability to recall already delivered external events.

## Final verification

Full runs used a public-source copy under `/tmp/storywalker-pr2-verification`,
with no real Vault, passkey files, `.env`, research exports or `.logfire` settings.
Installed dependencies were reused, not reinstalled or upgraded. Runtime:
Node 25.6.1, Python 3.14.8, Apple Swift 6.4; Next 16.3.8 / Vitest 4.1.11.
The existing native installation and running development output were untouched.

| Check | Final result | Local log |
| --- | --- | --- |
| Focused JS (before broader suite) | 48 passed; subsequent cancellation/dedupe-focused rerun 32 passed | `/tmp/pr2-focused-final.log`, `/tmp/pr2-final-focus.log` |
| Complete JS, `npm test -- --maxWorkers=2` | **371 passed / 87 files** | `/tmp/pr2-full-js-final.log` |
| Complete Python, `NODE_ENV=test .venv/bin/python -m pytest tests -q` | **75 passed** | `/tmp/pr2-full-python-final.log` |
| Complete Swift package, `swift test --scratch-path /tmp/pr2-swift-build` | **27 passed** | `/tmp/pr2-full-swift.log` |
| `npm run typecheck` | Passed | `/tmp/pr2-typecheck-final.log` |
| `npm run lint` | Passed | `/tmp/pr2-lint-final.log` |
| Normal Turbopack production build | Passed | `/tmp/pr2-build-final.log` |
| Public-source privacy audit | Passed on final working tree | `/tmp/pr2-audit-public-final.log` |
| Fresh build privacy audit | Passed, 109 public JS/HTML/RSC artifacts | `/tmp/pr2-audit-build.log` |
| Same fresh build checked against existing local private markers and credential values | Passed; no marker/credential values printed | `/tmp/pr2-audit-build-local-markers.log` |
| `git diff --check`; proposed M4 patch apply-check | Passed | Command exit 0 |

Build command: `NEXT_TELEMETRY_DISABLED=1 STORYWALKER_REVIEW_BUILD=1 node
node_modules/next/dist/bin/next build`. The optional Are.na network-refresh prebuild
hook was deliberately bypassed; the production compiler itself ran normally.
Swift initially failed because the sandbox denied compiler-cache writes; the
permitted rerun passed. An initial typecheck found a missing nullable property in
one new fictional fixture; fixed before final validation. The first Python full
run exposed two old tests deliberately accepting 500 BPM; those expectations now
match the new contract. No unrelated test was disabled or skipped to get green.

New health-shaped fixtures are explicitly fictional. Storage tests use disposable
sandboxes; transport and credentials are mocked. No real health data, credential,
precise private location or listening history was added to tests or emitted in logs.
Audits are bounded checks, not proof against every possible disclosure; M5's CI
coverage limitations remain documented.

## Separate assessments and remaining merge conditions

[M3/M4 assessment](pr2-m3-m4-assessment.md) contains the offline threat model,
migration-safe recommendation, current-public-content inventory and M2/M5 measured
acceptance criteria. No production cryptography or existing evidence was migrated.
The initial documentation-only M4 proposal was superseded by the subsequent
unstaged sanitization patch described below. Do not commit the temporary proposal
file: its removed context would become a new public copy. Current-file edits
cannot erase Git history.

Remaining conditions before treating this PR as merge-ready:

- Author review of this unstaged diff, research skew/plausibility policy and new
  export scope. No merge authorization is assumed.
- Review the subsequent M4 current-source sanitization patch and its explicit
  compatibility limits. Existing public Git history is not erased.
- Explicitly track/accept M3's existing metadata/KDF risk while a separately
  authorized migration is designed. A stronger KDF cannot safely be dropped into
  the old format without addressing data keys and passkey recovery.
- Physical Watch/phone/browser acceptance is not covered by synthetic suites.
  No live external export was performed. Existing manual release conditions remain.

Known limits: dedupe is bounded/process-local, with possible duplicate external
records after restart/eviction and renewed consent; no persistent outbox or
exactly-once delivery is claimed. Abort cannot recall a delivered event. Existing
Vault evidence is not retroactively revalidated. M2/M5 remain follow-ups, not fixed
performance/CI claims. Dependency installation from a clean lockfile was not repeated.

## Proposed commit boundaries (none staged)

1. **L1 — enforce passphrase action boundary:** Vault route and focused session
   regression. Independently reviewable and does not change authentication format.
2. **M1 — bound research observations:** Python model/native validator, injectable
   TS subprocess clock, generated schemas, corrected fictional fixtures and
   validation documentation.
3. **H1 — require current explicit reviewed-export consent:** receiver/routes,
   summary and live-threshold boundaries, UI copy, consent tests and docs.
   Include current-session expiry/Stop tests in the same commit as the policy.
4. **Review record:** this report and M3/M4/M2/M5 assessment. The subsequent M4
   sanitization belongs in its own commit; any M3 migration remains future work.

Preserve the pre-existing untracked `scripts/spotify-snapshot-diff.py`; it is not
part of remediation and was not edited or included in the verification copy.

## Subsequent feature-folder reorganization

The Author requested feature organization for `components/` and then `lib/`.
The library move relocates 185 files, with tests and generated contracts beside
their feature. Import, mock, fixture, subprocess and generator paths follow the
new locations. A pre-move snapshot comparison verified every relocated library
file differs only at the recorded path replacements; remediation behavior is
preserved. See [library conventions](../../lib/README.md) and
[component conventions](../../components/README.md).

After the library move: 23 focused remediation/security tests passed, followed
by all 371 JS tests in 87 files and all 75 Python tests. Typecheck, lint, the
fictional Aurora Coast CLI rehearsal, contract regeneration byte comparison and
the production build passed. The build used the direct Next compiler in the
public-only verification copy, skipping the optional network Are.na prebuild.
The real-workspace public audit passed (702 visible files), as did the production
privacy audit (109 public artifacts). The copy's public audit initially flagged
its temporary `.venv` symlink; the workspace audit has no such finding. Swift
sources did not change during these moves; the earlier 27-test result still
applies and was not rerun for the TypeScript reorganization.

Keep component and library reorganization as separate proposed commit boundaries
after the remediation changes, so the policy changes remain independently
reviewable. All changes remain unstaged; no commit, push or merge was performed.

## Full unstaged review after both reorganizations

10 October 2026, fresh review and verification: no new actionable regression found
in the remediation or feature-folder moves. Reviewed tracked modifications and
untracked replacement files together, rather than treating the old paths' apparent
deletions as removed behavior. Verified all 62 component files retain their content
apart from module specifiers; all 185 library files match the pre-move snapshot
plus recorded path changes. Cross-feature consumer edits match the recorded
replacements, and no old flat library file references remain in public source.
Inspected the pre-existing Spotify comparison script without executing it against
private inputs; it remains separate from the proposed changes.

Rechecked H1's accepted-evidence selection, revision guard, separate consent,
legacy/restart reconfirmation, Stop/expiry and live-preview boundaries; M1's
injectable clock, 120-second allowance and exact original timestamp retention;
and L1's rejection before cookies or session mutations. Existing regression
coverage remains intact. No production source changes were needed during review.

Fresh results:

| Check | Result | Local log |
| --- | --- | --- |
| Focused H1/L1/security | 23 passed | `/tmp/review-focused.log` |
| Complete JS | 371 passed / 87 files | `/tmp/review-js.log` |
| Complete Python, including M1 | 75 passed | `/tmp/review-python.log` |
| Complete Swift package | 27 passed | `/tmp/review-swift.log` |
| Typecheck / lint | Both passed | `/tmp/review-typecheck.log`, `/tmp/review-lint.log` |
| Production build | Passed | `/tmp/review-build.log` |
| Public / build privacy audits | Passed: 702 files / 109 artifacts | `/tmp/review-public.log`, `/tmp/review-private-build.log` |
| Generated contracts / fictional Aurora Coast CLI | Identical bytes / passed | Command exit 0 |

Full suites and production compilation used the public-only temporary copy.
The focused tests used only mocked effects and a disposable fictional encrypted
sandbox. No real Vault contents, credentials, precise private locations or listening
history were introduced into fixtures or logs. The optional network refresh,
clean dependency installation and signed-device/browser acceptance were not run.
The existing Vite config-loader warning is non-failing. Passing suites do not
replace the M3/M4 risk decisions or manual acceptance listed above.

Proposed sequence remains: L1, M1, H1, review/consent documentation, component
reorganization, library reorganization. When preparing commits later, reconstruct
the remediation against the original paths before applying each move; avoid
mixing policy changes into rename-only commits. Exclude the unrelated Spotify
script and unapplied M4 proposal. Each intermediate commit should pass its relevant
checks; this review verifies the cumulative working tree, not yet-created commits.


## Subsequent M4 sanitization

M4 is now implemented as a separate unstaged patch; the earlier unapplied proposal
is superseded. Current operational notes were condensed while retaining security
findings and test/manual-acceptance distinctions. Hard-coded telemetry project
identifiers are replaced by private server-start configuration with exact target
matching and fixed ingestion hosts. Missing configuration fails closed; BODY target
changes require restart and fresh consent. No real settings were migrated.

Both audits retain their previous checks and use shared bounded local marker and
credential discovery. Synthetic canaries verify public-source and JS/HTML/RSC
leaks are rejected without printing values. Existing legacy input paths and
security denylist terms remain intentionally unchanged. This does not erase prior
public history. Cryptographic implementation, persisted evidence and passkeys are
unchanged. M3 still needs its separate risk/migration decision.

M4 verification: **385 JS tests / 89 files**, **78 Python tests**, typecheck,
lint and the normal production compiler passed. The public audit passed across
705 visible files; the fresh build audit passed across 109 public artifacts using
local marker/credential inputs without printing their values. Logs are
`/tmp/m4-js.log`, `/tmp/m4-python-final.log`, `/tmp/m4-typecheck-final.log`,
`/tmp/m4-lint-final.log`, `/tmp/m4-build.log`, `/tmp/m4-public.log` and
`/tmp/m4-build-audit.log`. The first unconstrained focused run timed out two tests;
the bounded rerun passed all 51 focused tests, and the final full suite includes
the additional malformed-input/dangling-symlink cases. A test-harness environment
type error and an unused audit import were corrected before the final checks.
No assertion or production timeout was relaxed. Swift source is unchanged; the
preceding fresh 27-test result applies and was not rerun for this patch.

Source evidence: target pinning and matching in `lib/body/health-summary.ts:10–12,31,39`
and `lib/body/health-threshold.ts:21`; authenticated UI link in
`components/body/connections/health-summary-feed.tsx:27`; independent fictional
telemetry target in `research/rehearsal-dramaturg/dramaturg/telemetry.py:10–12`;
shared marker/credential discovery in `scripts/private-audit-markers.mjs:5–61`.
Regression evidence is in `lib/body/health-export-target.test.ts`,
`scripts/private-audit-markers.test.ts` and the Python telemetry tests. All 25 Vault
files were compared with the pre-M4 content and are unchanged. Everything remains
unstaged; the M4 patch should be a separate proposed commit after the library move.
