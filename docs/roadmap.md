# Storywalker future work

Updated 13 October 2026. Planning only; items below do not authorize implementation,
private-data access, migrations, external export or publication.

Storywalker's priority is a usable artistic practice built around Author control:
rehearse the work, preserve irreplaceable evidence, keep interpretation distinct
from source material, and produce a reproducible public portfolio encounter.
Security should sustain that practice without turning every usability improvement
into a storage redesign.

## Recommended order

Priorities describe the next work to schedule, not vulnerability severity or a
claim that existing protections have failed. A confirmed exposure or data-loss
problem takes precedence over this order.

| Priority | Work | Why it serves Storywalker | Scope |
| --- | --- | --- | --- |
| P1 | Complete a repeatable XR rehearsal and resolve observed continuity problems | Turns the existing system into an understandable artwork and portfolio encounter | Existing rehearsal backlog; bounded fixes |
| P1 | Benchmark stronger recovery-key derivation | Improves protection of private evidence against offline guessing without replacing the data key | Separate measured investigation, then a reviewed implementation PR |
| P2 | Design full data-key rotation and compromise recovery | Makes the distinction between changing a password and recovering from exposure actionable | Separate design and recovery exercise before implementation |
| P2 | Improve passphrase form recovery after errors | Reduces friction while keeping secrets short-lived and local | Small focused UI change if testing supports it |
| P3 | Align stale-unlock conflict responses | Makes error handling predictable, with little immediate artistic benefit | Optional small API consistency change |

The Author accepted deferring the three recovery follow-ups on 13 October 2026
in [PR #5](https://github.com/adinapirjol/storywalker-studio/pull/5): stronger key
derivation, full data-key rotation and form-reset usability. HTTP-status alignment
is an additional optional reviewer suggestion, not part of that acceptance.

## P1 Rehearse the artwork and preserve continuity

- [ ] Run the existing 30-minute sequence: approach, select, enter, leave, refuse,
  recompose, audition, save and reload. Record observable failures separately from
  the participant's words and the Editor's interpretation.
- [ ] Address demonstrated save-state or access interruptions before expanding
  the installation. Verify retained decisions and explicit cancellation; do not
  silently resume possibly completed mutations.
- [ ] Use the resulting rehearsal observations for a short fictional-data video
  and installation score suitable for the portfolio. Show evidence, interpretation
  and Author decisions distinctly; keep private material out of public artifacts.

Use the [existing XR task list](research/xr/nova-report-2026-09-29.md#then--rehearse-the-artwork)
and [rehearsal score](research/ctm-2027/checkpoint-2026-10-06.md#installation-score--first-rehearsal).
These are carried-forward tasks, not a new claim about device or audience acceptance.

## P1 Benchmark stronger recovery-key derivation

- [ ] Measure unlock and wrap latency, peak memory and concurrent-request behavior
  on supported machines. Evaluate stronger versioned scrypt settings, including
  the reviewer's proposed N=2^17, without treating that value as an approved choice.
- [ ] Choose explicit resource limits and document the measured trade-off before
  changing production parameters. Preserve strict rejection of unknown KDF labels
  and excessive resource requests before expensive allocation.
- [ ] Test legacy and current-envelope access, an explicitly authorized upgrade,
  interrupted writes, and unchanged record ciphertext and passkey bindings.

Done when a separate reviewed PR includes measured costs, agreed limits and
fictional compatibility/failure tests. No silent upgrade on unlock. Refer to the
[earlier threat-model assessment](research/pr2-m3-m4-assessment.md#m3--offline-database-disclosure)
as historical design context; the current recovery-envelope behavior is documented
in [Vault passkeys](vault-passkeys.md#change-the-recovery-passphrase).

## P2 Design full data-key rotation

- [ ] Define a separate, explicit compromise-recovery action. Ordinary passphrase
  replacement preserves the data key; an old backup plus its old passphrase can
  therefore recover the key used for current records.
- [ ] Design record re-encryption, passkey wrapper replacement or re-enrollment,
  session revocation, exclusive access, disk-space checks, verified cutover and
  interruption recovery. Account for credentials whose PRF output is unavailable;
  do not promise silent preservation of every passkey.
- [ ] Rehearse with fictional Vaults: preserve every record and review decision,
  demonstrate that the old key cannot decrypt the new file, inject failure at each
  write boundary, and verify recovery and every retained access method.

Done when an independently reviewed design and recovery exercise precede a
separately authorized implementation PR. Explain that older copies remain exposed;
rollback must not be presented as restoring confidentiality after compromise.
Promote this work immediately if the Author reports suspected key/passphrase
exposure or needs compromise recovery. Planning does not authorize a real migration.

## P2 Improve form recovery after errors

- [ ] Evaluate clearing only the incorrect current passphrase while retaining the
  new entries in mounted form memory, versus the current immediate reset.
- [ ] Test wrong-current, mismatched-confirmation, success, cancellation, unmount,
  expiry and lost-response behavior. Clear secrets on success and teardown; never
  persist them to browser storage, logs or automatic retries.
- [ ] Keep the confirmed-save success behavior intact. A lost response still does
  not authorize automatic replay.

Done when the selected behavior is documented and tested with fictional inputs,
reduces unnecessary re-entry, and preserves the session and consent boundaries.

## P3 Align stale unlock responses

- [ ] Decide whether Vault write conflicts and busy writes should consistently
  return 409 across the ordinary Vault and recovery routes instead of a mixture
  of 400 and 409.
- [ ] Add route-level assertions for status, safe error text, no newly issued
  session/cookie and unchanged replay behavior. Verify callers do not retry a
  potentially completed mutation merely because its status changed.

Done when the API contract and callers agree. Keep this optional consistency fix
separate from any cryptographic migration.

## Keep each session bounded

Before implementing a reviewer suggestion, say whether it is necessary for the
current PR's safety or a useful follow-up. Explain the benefit, dependencies and
why it fits the current change. Recommend a separate PR when it requires a new
encryption format, data migration, rollback design, passkey lifecycle, hardware
benchmarks, or unrelated changes that make the current fix harder to verify.
Do not promise a same-session migration or silently expand scope. Small response
corrections and focused regression tests can stay with the finding they resolve.

All security-sensitive work follows the [independent review gate](code-review-guidelines.md#independent-security-review-before-merge).
Use fictional fixtures first. Passing automation does not establish physical-device
acceptance, and accepting a deferral does not authorize its implementation.
