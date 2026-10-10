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
