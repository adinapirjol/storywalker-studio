# Consent-controlled model interpretation

Save an observation, load its saved reading, then use **Preview model request**.
The form allows an exact observation excerpt, optional prior interpretation,
optional Author editorial reading, and up to four checked evidence excerpts.
The preview shows the exact request body, instructions, destination and model.
Changing a selection invalidates the preview and resets consent.

Only **Send this preview & propose**, with the unchecked-by-default one-request
consent box checked, sends data. Saving or loading observations never sends data.
The old deterministic prompt is now optional and off by default.

## Model and output

Uses the existing `OPENAI_API_KEY` and `NOVA_DIRECTOR_MODEL` configuration (default
`gpt-5`) against the fixed OpenAI Responses API endpoint. This is separately billed
API access, not this conversation's session. Secrets remain server-side.
`store: false` is set; this does not promise zero provider retention.
No tools, browsing, files, background execution or conversation identifier are sent.

The model must interpret the observation's conceptual shift, distinguish it from
platform records and historical claims, provide a concrete creative experiment,
explain uncertainty, and cite exact supplied text. It can return no proposal.
The response uses [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).
Local validation independently checks schema, allowed aliases, exact quotations
and required grounding in the Author observation. These checks do not prove every
semantic claim correct: the Author still reviews the pending hypothesis.

Successful proposals retain the original and saved response, with model identity,
request fingerprint and citation-to-source revision mapping. New proposals are
never approved automatically. No-proposal outcomes preserve their explanation.
The most recent 50 attempt receipts remain encrypted and inspectable; the existing
delete-derived control clears them. Exact duplicate packets and near-duplicate
directions are blocked, including previously rejected directions.

## Boundaries and failure behavior

- Local same-origin request, active Vault session and an enabled, unpaused loop.
- Exact preview bound to current source revisions, original, decisions and model.
- Durable one-use reservation before export. One pending request at a time,
  three-second rate limit, 45-second timeout, no retries.
  Reservation advances the loop revision, so an old request remains stale even
  after its receipt ages out of the 50-entry display. After a failed send, refresh
  the evidence view before preparing a new preview and giving new consent.
- Session and snapshot rechecked immediately before export and after generation.
  Changed sources, revoked access or changed decisions discard the result.
- Output is capped at 256 KiB and errors at 32 KiB. Raw provider errors, keys and
  private text never enter logs or error responses. Quota/authentication failures
  have fixed, safe messages.
- Cancelling aborts the request and stops waiting; it cannot recall content that
  has already reached the provider. Network failure does not erase the observation.
- Source and queue limits apply before export. Explicit rejection boundaries
  remain enforced across interpretation ancestry.

## Validation status

Fictional regression tests cover selection/consent, stale revisions, changed
snapshots, duplicate reservations, paused/revoked access, fabricated citations,
refusal, no-alternative outcomes, oversized output and provider error redaction.
The real local UI preview was inspected with consent unchecked and send disabled.
No private evidence was sent.

The full regression suite passed 650 tests across 131 files (the native receiver's
temporary loopback fixtures required permission to bind test sockets). The review
build, targeted lint/type checks, public repository audit and private build audit
passed. The latter checked 124 public artifacts and 52 deployment manifests.
Two existing dynamic-filesystem tracing warnings remain in the Vault snapshot
guard; the deployment audit found no private input references.

The live fictional-only provider check on 20 October 2026 reached OpenAI but
returned HTTP 429, `credit_balance_exhausted`. Successful live semantic generation
remains unverified until API billing is restored. Do not replace this with a
fictional success or call the generic prompt model reasoning.

This changes private-data export boundaries. Independent security review is
required before merge under `docs/code-review-guidelines.md`; automated tests
and implementer verification do not satisfy that review gate.
