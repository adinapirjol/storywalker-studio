# Claude independent review of PR 6 — Author-supplied report

Reviewer: Claude, in an independent review session. Report pasted by the Author
on 19 October 2026. Reviewed SHA:
`7a28fe40460d4b78a9a13cf74fa777a2362a0ec9`.
Base/merge base: `8f0754c0a6353f3a732c99706f39d7987b330e92`.
Scope: the complete 2-commit, 196-file diff (+10,110 / -250).
Verdict: **not mergeable as reviewed**. This is not merge authorization.

This sanitized record paraphrases the supplied report. It does not imply that
Claude tested the defects or approved subsequent fixes.

## Findings and required follow-up

1. **Blocker, high:** an unset receiver acceptance setting falls back to HEALTH
   connection consent. Watch sleep can be accepted while BODY displays Off.
   Require explicit receiver acceptance; analysis consent is separate.
2. **Blocker, medium-high:** the research limit counts all native evidence keys,
   including heart-rate records, tombstones and overlay duplicates. At about
   10,200 keys, research recalculation can block acceptance and deletion.
   Count live sleep only; disposable calculation failure must not prevent a
   source write/deletion, and obsolete derived notes must be invalidated.
3. **Blocker, medium:** recovery/admin copies excluded from Atlas still enter
   search, evidence packs and Director choices. External model use still requires
   explicit selection and consent. Share one retrieval exclusion policy.
4. **Fix soon:** backup growth is unbounded across encrypted source versions,
   manual history imports, Calendar staging and pairing address repair.
   The Author requested a retention proposal before any older copies are removed;
   see [the proposal](2026-10-19-backup-retention-proposal.md). No pruning approved.
5. **Fix soon, security-relevant:** revocation leaves pairing tokens/TLS private
   keys in address-repair copies. Remove credential copies on explicit revoke;
   avoid adding credentials to future address history.
6. **Fix soon, security-relevant:** unlock rotates the session then awaits sync
   before returning its cookie. Abort/expiry can leave an inaccessible session
   and active receiver. Return authentication first; run delivery from the browser
   only after receiving the session, with cancellation and ownership checks.
7. **Fix soon:** successful writes can be reported as failures: unlock receipt
   errors lose confirmed source results, missing Calendar items hide partial
   success, post-commit access checks hide committed review/import writes, and
   Calendar staging lacks fsync. Preserve authorization checks and report a
   content-free committed/reload outcome after access is lost.
8. **Hypothesis, not reproduced:** Safari permission-prompt blur might stop a
   newly granted XR input. A usability concern, not a confirmed leak.
9. **Documented trust widening, not confirmed defect:** pending legacy batches
   without receiver identity can be accepted by the current pairing. Needs an
   explicit compatibility decision; do not imply it was independently approved.

## Reviewer's positive observations

Claude found the local origin/session rechecks, disabled/malformed consent
handling, selected-identity constraints, bounded staged reads, TLS address repair,
replay/tombstone rules, optional cycle context, bounded Apple Health parser,
synthetic archive key separation/concurrency, XR resource ownership, and native
exclusion from general retrieval sound within the inspected source scope.
These observations are limited by the checks below.

## Checks and limitations reported by Claude

No finding was executed as a reproduction. Claude described 1–7 as confirmed by
source tracing and 8–9 as hypotheses/concerns. CI was not visible with anonymous
repository access. JS/TS tests, typecheck, lint, build and Swift compilation were
not run because dependency access was blocked. Python validation covered the
new Sleep contract with fictional JSON; neither full pytest nor a native-device
trial was run. Vendor hashes matched the README, but upstream provenance could
not be checked. The review used no personal data, accounts, receiver or devices;
it made no edits, commits, pushes or merges.

## Remediation evidence

The implementer reproduced 1, 2, 3 and 5 in an isolated checkout with fictional
fixtures before fixing them: all four failed on the old behavior. Regression
coverage is in `lib/vault/pr6-security-regressions.test.ts`. Additional outcomes
and final local validation are mapped in the
[follow-up receipt](2026-10-19-full-local-validation.md#security-remediation-follow-up--19-october-2026).
This is implementer evidence, not independent approval.

An independent recheck is required on the final proposed SHA, including findings
1–3, 5–7 and any related changes. Finding 9 is now tightened to manual review for unowned legacy batches, with
fictional coverage; it still needs independent recheck. Retention and the Safari
concern require
resolution or explicit Author acceptance with follow-up before merge. CTM
artistic critique is separate, advisory, and not a merge blocker.
