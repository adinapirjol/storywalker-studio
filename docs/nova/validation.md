# Nova validation — 2026-10-20

## Verified

- Full JavaScript regression run: `npm test -- --testTimeout=15000`:
  126 files, 619 tests passed. This preceded the final reauthorization regression
  added below. An earlier run concurrent with production compilation hit two
  five-second timeouts and a downstream recovery-test assertion failure; these
  did not recur in the complete run without competing build work.
- Final domain/route/encrypted-store suite:
  `npm test -- lib/nova --testTimeout=15000`: 29 tests passed. Includes grounded
  generation, provenance/time gaps, rejection reasons and bounded alternatives,
  boundaries, deduplication, revision history, consent/revocation, source deletion,
  stale-write conflicts, interruption before atomic rename, encrypted reload,
  derived-store deletion, source preservation and explicit reauthorization.
- Targeted ESLint passed for Nova modules, route/page/components and the small
  Director / Vault client integration edits.
- Production review build passed with TypeScript checking:
  `STORYWALKER_REVIEW_BUILD=1 ./node_modules/.bin/next build`.
  The existing snapshot-current function emits two dynamic-filesystem tracing
  warnings. Keep tracing exclusions and the deployment-manifest audit intact.
- Public repository audit passed; whitespace/diff check passed.
- Final private-build audit passed: 123 public client/prerender artifacts and
  51 deployment manifests, with no detected private inputs or credential values.
- `/nova` rendered in the running local browser. Entry-screen contrast was
  visually checked and corrected against the existing cream background.

## Not yet verified

Actual Vault evidence did not become available: the browser's existing passkey
flow was still waiting for device verification. No authentication bypass,
credential extraction or private-record fixture was used. No real hypotheses,
real participant decisions or authenticated review-screen visual acceptance can
be claimed from this session. The real-data acceptance checklist in README.md
remains open; consequently v0.1 is not complete against the master's definition.

The fictional public Aurora demonstration is deferred until actual evidence has
validated the loop. Automated fictional fixtures do not substitute for that.
No background inference service or external model request was run.

Independent security review remains required before merge. Nothing was committed,
pushed or merged. The pre-existing working tree changes were preserved.

## Picker and interaction simplification follow-up

- Source picker now renders saved-note titles with stated date/status, and named
  Last.fm/Spotify histories. IDs sit in one collapsed reference section.
- Explore combines explicit selection and generation in a single revision/write.
  Keep/Edit/Reject is the primary review; map, gaps, history and settings collapse.
- 34 focused tests, targeted ESLint and TypeScript checks passed.
- Live authenticated picker verified using DOM counts/booleans only: ten named
  choices, both listening labels, one Explore action, no separate authorization
  button. No private titles or source content were copied into this report.
  This confirms real picker metadata, not end-to-end inference acceptance.
