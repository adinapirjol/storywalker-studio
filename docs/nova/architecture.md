# Hypothesis Hyperloop v0.1 — architecture assessment

## Reuse

- `lib/vault/private-vault.ts`: AES-256-GCM encrypted records, sql.js persistence,
  atomic replacement, file lock, disk fingerprint conflicts and deletion/VACUUM.
- `vault-route-access.ts`, `vault-session.ts`, `http/local-origin.ts`: guarded
  browser sessions, authority rechecks and loopback/same-origin requests.
- `components/vault/vault-access.tsx`: shared unlock modal; no new credentials.
- `lib/evidence/private-ingest.ts`: minimised Spotify/Last.fm/calendar contracts.
- `private-signal-engine.ts`, `studio/nova-director.ts`: local retrieval and
  explicitly consented external Director path. Date hints scan arbitrary text;
  Nova instead reads typed event-time fields. No external model in this slice.
- Atlas (`studio/private-atlas.ts`) derives source inventory, temporal coverage and
  uncertain place readings. Scenario Studio preserves independent pathway/source
  selections. Neither currently stores hypothesis rejection constraints.
- `studio/schema.ts`, `review-state.ts`, `correlation.ts`: useful review lifecycle,
  but schemas constrain IDs to fictional Aurora data; cannot accept real records.
- `xr/journey-episode.ts`, `xr/xr-listening.ts` and XR components preserve episode
  time/place grounding and listening observations, WORLD/TIME/MEMORY composition,
  spatial sound rendering, keyboard controls and reduced motion. Nova does not
  activate their audio, camera, native collection or export flows.
- Existing experiments include CTM/Listening Again, Linz, refusal, HEALTH, Are.na,
  native BODY and rehearsal dramaturg. Preserve their separate consent boundaries.

## Existing flow and blocker

Source -> minimisation/staging -> explicit import -> encrypted Vault -> Atlas /
retrieval -> Director preview -> optional accepted working Thread. Staging is not
Vault ingestion. Unlock is required before every private operation. The missing
link is a durable selected-source policy, source-version-aware proposal lifecycle,
reason-specific rejection constraints, revision history and gap reporting.

## Minimum extension

`/nova` and `/api/nova` add a local loop. A bounded adapter reads only selected
supported records. Selection explicitly consents to local inference on future
revisions of those records; it does not authorize new sources or external calls.
The guarded picker reads only supported capture titles, stated dates and statuses
for display before inference selection; it does not copy full note bodies or
index unselected records. Import labels are static and need no payload read.
Explore combines explicit selection consent and analysis in one atomic write.
Calendar needs individual-event selection and is unsupported in this version.
Native, HEALTH, recovery and other derived records are excluded.

One new `nova-loop` Vault kind stores selected references, version fingerprints,
hypotheses, decisions, boundaries and optional aggregate metrics. Source content
is reconstructed on demand, not copied into an index. No SQL migration or new
storage engine. Generic Vault retrieval excludes the `nova:` namespace to prevent
feedback into other interpreters. GET reconciles in memory; analyze/decision writes
persist reconciliation atomically. Old decisions stay historical; changed, deleted
or revoked evidence cannot back active connections on the next request.

## Constraints

No credentials/key extraction; no bypass of locked sessions; no private browser
storage, logs, analytics, external model or public exports. Real validation requires
an unlocked browser and source selection. No fabricated records when unavailable.
Independent security review is required before merging this private-data change.

## Integration boundaries

Read-only inspection of separate career-analysis and content-analysis projects
found useful typed skill and experiment records. XP/readiness are game mechanics,
not verified competence. Future adapters must separate effort, demonstrated work
and external outcomes, retain source IDs/revisions, and obtain separate consent.
Content metrics must stay bound to experiment, dataset, split and artifact
versions; a smoke-test metric is not a general performance claim.

Shared boundary: evidence reference -> grounded proposal -> participant decision
-> invalidation/reconsideration. Each project owns its evidence schema. No repository
merge, automatic import, achievement scoring or semantic inference adapter yet.

## Sequence

1. Guarded inventory and explicit selection; normalize available real records.
2. Reconstruct bounded evidence graph; generate grounded deterministic proposals.
3. Persist approve/modify/reject and enforce revision-aware constraints.
4. Explicit Analyze new evidence (no background daemon claim), pause/disable,
   gaps, opt-in local aggregate research metrics, accessible graph and history.
5. Fixture regressions/security checks and real browser acceptance.
6. Only after real acceptance, design a separate genuinely fictional Aurora demo.
