# Storywalker code review guidelines

Review the final behavior, its boundaries and the evidence that it works. The
traveller is the Author; source evidence, interpretation and canon remain separate.

## Structure and clarity

- Give each module one clear responsibility. Keep UI rendering, transport,
  validation, authorization and domain decisions separate.
- Prefer named functions, explicit types, early returns and readable formatting.
  Split large components at meaningful boundaries; avoid dense one-line logic,
  nested conditionals and effects that silently coordinate unrelated operations.
- Centralize policy rather than copying it. Keep reusable mechanisms small and
  keep domain decisions with their owner. Dependencies should point toward domain
  contracts; browser components must not import private server storage.
- Choose patterns for a demonstrated need: adapters at external boundaries,
  strategies for interchangeable behavior, state machines for lifecycle rules,
  and scoped resource ownership for cleanup. Explain the tradeoff; avoid generic
  factories, inheritance trees or abstraction layers without current callers.
- Preserve contracts while refactoring. Do not mix unrelated feature work into
  cleanup or discard useful private evidence to simplify a test.

## Streaming and iteration

- Bound packet sizes, queues, caches, concurrent requests and retained history.
  Process large inputs incrementally instead of loading everything into memory.
- Use maps/sets for repeated lookup and deduplication. Avoid repeated full scans,
  sorting inside loops, quadratic copies and unbounded `Promise.all` fan-out.
  For small bounded inputs, prefer simple code over premature optimization.
- Define backpressure: pause, reject, coalesce or retain according to the contract.
  Never silently drop evidence; a latest-value visual preview may coalesce when
  the archival path independently preserves evidence.
- Preserve event ordering and idempotency. Keep event time, receipt time and
  last contact distinct. Missing samples cannot establish persistence.
- Tie streams, timers, readers, subscriptions and credential prompts to an owner.
  Abort on navigation, cancellation, expiry and teardown; release resources in
  `finally`. Use bounded retry with backoff, and never replay a possibly completed
  mutation automatically after a network failure.
- Measure before calling an optimization successful. Test duplicate, delayed,
  out-of-order, disconnected and overwhelmed consumers with fictional fixtures.

## Security and privacy

- Validate at trust boundaries; authorize before private reads and external work,
  then recheck after asynchronous work and immediately before persistence/release.
- Use the shared Vault modal, session policy and access guard. Authentication does
  not imply source consent, export consent or permission to accept evidence.
- Keep secrets and private inputs in ignored local folders. No raw private data
  in logs, public fixtures, errors, screenshots, prompts or browser storage.
- Fail closed. Reject foreign origins, expired/revoked capabilities, malformed
  inputs and unsupported passkey encryption. Never replace cryptographic checks
  with a fictional login or a UI-only gate.
- Review filesystem races, atomic writes, symlinks, session rotation, one-use
  challenges, destination constraints and cache headers where applicable.

## Verification and reporting

- Add behavioral regression coverage for meaningful bugs and security boundaries,
  not tests that merely reproduce implementation details.
- Run relevant checks, then the required suite once the change stabilizes.
  Report what passed, what remains unverified and any material limitation.
- Use deterministic Aurora Coast examples for public demonstrations. Label all
  fictional signals and keep their rehearsal disconnected from real exports.
- Before commit/push preparation, inspect the whole proposed diff and run privacy
  audits. A prepared package is not a successful device installation or deployment.

## Independent security review before merge

Recommend an independent external review for every PR. Require a security-focused
review for changes to authentication, sessions, Vault storage, cryptography,
migrations, private-data handling, consent/export boundaries, or CI security
controls. For a PR outside these areas, record the scope assessment and, if no
external review is obtained, the reason in the PR description.

- Use a reviewer independent of the implementation: another person or a separate
  AI review session, such as an Author-arranged Claude review. Self-review, passing
  tests and automated security scanners are complementary evidence, not substitutes.
- Supply the proposed diff and relevant public source, the reviewed commit SHA,
  threat assumptions, test results and known limitations. Share only public code
  and fictional fixtures. This policy does not authorize sending private Vault
  contents, credentials, health data or other private evidence to an external
  reviewer or contacting someone on the Author's behalf.
- Ask the reviewer to examine authorization and consent boundaries, key and session
  lifetimes, data preservation, races, cancellation, expiry, retries and partial
  failures. Check that the reported outcome matches the actual persisted state,
  including errors after a successful write. Distinguish credential replacement
  from recovery after a compromise and identify compatibility/rollback limits.
- Record the review link or a sanitized report, reviewer, reviewed SHA, findings,
  and any checks the reviewer could not run. A pasted Author-supplied review is
  valid evidence; do not claim independent verification the reviewer did not do.
- Reproduce actionable findings with fictional regression tests where feasible,
  fix them, and rerun the relevant checks. Map each finding to its resolution.
  Any remaining finding needs explicit Author acceptance with its impact and a
  follow-up recorded; an agent must not silently dismiss or waive it.
- Have the independent reviewer recheck security-relevant fixes and later changes.
  Record the final reviewed SHA. For later changes that do not affect security,
  document their scope and why the existing review remains applicable.
- Before merging, confirm the review evidence applies to the proposed head,
  findings are resolved or explicitly accepted, required CI checks pass on that
  head, and merge authorization exists. Pending review blocks merging, not local
  implementation, tests or PR preparation. A review is not proof of zero risk.
