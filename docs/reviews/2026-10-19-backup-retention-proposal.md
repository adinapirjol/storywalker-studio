# Backup retention proposal — awaiting Author review

Status: proposed, not enabled. The Author requested a reviewable rule before
older copies can be removed. This change does not prune personal files or Vault
records. Backup growth remains an open finding until a policy is accepted and
implemented, or its impact is explicitly accepted.

## Proposed rule

For each source independently, retain the current source and the latest **7
changed daily recovery copies**, plus **4 changed weekly recovery copies**.
A weekly copy is the latest changed copy in a completed ISO week; a copy that
fills both slots is stored once. Unchanged imports should not create another
recovery copy. Historical copies that cannot be reliably assigned to a source
stay preserved and appear separately in the preview. Keep the newest available copy even if collection has stopped.

Apply this proposed rule to encrypted automatic music/Calendar recovery copies
and manual Last.fm before-import copies. Preserve original source timestamps and
provenance. Do not expire current accepted evidence, Author decisions, source
history within the current Last.fm document, or deletion tombstones. Deselection
stops collection; it is not deletion consent.

Plaintext Calendar staging needs a separate, shorter rule: retain the current
catalog, the latest **7 changed daily catalogs**, and **31 days of count-only
collection receipts**. They remain owner-only and Git-ignored. Staging is not an
encrypted backup. Never remove the last valid staged catalog after a failed or
unconfirmed Vault import. Address-repair history should contain metadata only,
without pairing tokens or TLS private keys.

## Before any removal

An implementation should first offer a local preview listing counts, age ranges,
estimated space reclaimed, and any sources lacking a verified replacement.
It must not expose record contents in reports. Removal needs explicit Author
approval of this policy and the concrete preview; elapsed time is not approval.

Pruning must hold the source's existing serialization/collection lock, recheck
consent and file revisions immediately before committing, and never follow
symlinks. Use a bounded run and preserve all copies when the replacement's
integrity or commit state is uncertain. Report confirmed removals separately
from failures; do not automatically retry a possibly completed deletion.

Credential revocation and explicit source deletion are separate security actions:
revocation removes obsolete credential copies, and source deletion invalidates
its derived calculations. They do not authorize general backup pruning.

## Decision requested

Review the 7 daily + 4 weekly encrypted-copy rule, the shorter staging rule, and
the two-step preview/approval flow. No retention implementation or removal is
approved by this document.
