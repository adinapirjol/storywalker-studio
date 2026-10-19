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
