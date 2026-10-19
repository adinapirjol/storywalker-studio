# Study 04 encrypted storage rehearsal

Implemented 14 October 2026. **Fixed synthetic observations only.** Real XML/ZIP
imports remain disabled; arbitrary diary/report text is never accepted by this
archive. No forecasting, collection scheduler, native installation or cloud storage.

## Try the local rehearsal

1. Open `/research/health` in the local Storywalker app.
2. Choose **Load / reload synthetic archive**. The existing Vault unlock dialog
   supplies session access; it is not consent to import personal observations.
3. If empty, choose **Save fixed synthetic sleep & diary fixture**. The server
   generates the existing invented sleep series and two invented diary entries.
   The response is read back from disk and loaded into the descriptive timeline.
4. Reload the page, then load the archive again. If the server restarted, unlock
   again. Review provenance, unknown/skipped ratings and the retrospective entry.
5. Delete one stored diary observation, the sleep batch, or all stored observations.
   Reload to check the result. These controls also clear tab drafts/report previews.

Loading replaces the tab's current synthetic timeline. Free-text diary entries
remain tab-only; the “Remove from tab” control is distinct from archive deletion.
No archive request occurs on page load. Local GET/POST requests use `no-store` and
the shared Vault modal; no health values go to external services.

## Storage and key boundary

- `lib/health/server/` owns persistence. The only route is
  `/api/health-rehearsal`; its strict, bounded command schema admits seed and
  selective deletion, not client-supplied observations. The decrypted archive is
  also validated against canonical invented values, not merely a synthetic flag.
- A separate ignored file lives at
  `private-data/health-study04-synthetic/archive.enc`. No generic Vault records,
  headers, SQLite database, Atlas index or journey data are read or written.
- An active process-local Vault session is required. Its temporary key copy is
  used with HKDF-SHA-256, a fresh 32-byte salt and a HEALTH/synthetic domain label
  to derive the AES-256-GCM key. This is domain separation, **not an independently
  recoverable key or separate authentication authority**. It uses Node's built-in
  [crypto primitives](https://nodejs.org/api/crypto.html#cryptohkdfsyncdigest-ikm-salt-info-keylen).
- A fresh 12-byte nonce and authenticated format/domain/header accompany each
  write. All observation content, IDs, dates, source details, availability times
  and revision identifiers are inside encryption. There are no exposed payload
  hashes. The 128 KiB padded plaintext gives a fixed 131,140-byte envelope.
- Plaintext outside the envelope is limited to format marker, random salt/nonce,
  tag, and ciphertext. The filesystem still exposes archive existence, purpose,
  permissions and modification/access patterns. Decrypted JS/OS copies are not
  guaranteed erased. Buffer copies of derived/session keys are cleared on exit.
- The archive directory is 0700 and files 0600; unsafe directories, symbolic links,
  hard-linked archive files and unexpected sizes are rejected. These controls
  supplement encryption. They do not defend against a hostile same-user process
  controlling the parent directory or an already-compromised local server.

The existing personal Vault is not opened for these operations. Its implemented
recovery-passphrase change preserves the data key; it does not invalidate this
archive. Actual data-key replacement is different. A separate encrypted recovery
snapshot and explicit migration/restoration are now implemented and tested with
synthetic data. See [recovery, deletion and walkthrough](storage-recovery.md) for
exact scope, failure handling and remaining prerequisites for personal persistence.

## Writes, concurrency and deletion

Every mutation compares the caller's expected encrypted revision under the shared
exclusive file lock. Stale retries fail; a populated archive cannot be seeded over.
There is no automatic mutation replay after uncertain failure. The client may
replay once only after the existing initial `VAULT_LOCKED` denial, before work.
Expiry during an operation uses a different error and cannot trigger that replay.

Reads are size-bounded. Writes use a unique exclusive 0600 temporary ciphertext,
file fsync, atomic rename and directory fsync. Cancellation/session authority is
checked before access, before commit and before release. If rename succeeds but
directory fsync fails, the route reports uncertainty and asks for a reload; it does
not claim nothing changed. A cancellation after commit likewise cannot undo it.

Deletion rewrites a snapshot without the chosen records. Delete-all keeps an empty
encrypted snapshot with a new revision, preventing a stale pre-delete writer from
restoring data. No reports/derived caches are persisted; the UI clears its report
previews and drafts when applying an archive response. Filesystem snapshots,
downloaded reports and backups remain independent copies. No secure SSD erasure
or protection against replaying an old valid encrypted backup is claimed.

A crashed process can leave ciphertext and an exclusive lock. Reads may still
inspect the committed archive; writes fail closed until explicit recovery.
Automatic lock theft/orphan deletion is deliberately absent. Stopped-writer cleanup is documented in the recovery walkthrough; locks are never stolen live. No private archive was created in the user's
workspace during automated verification; test files use isolated temporary roots.

## Validation and release gate

Behavioral tests exercise fresh-process reopening, metadata/content encryption,
randomized ciphertext, wrong keys, tampering/size limits, fixture-only enforcement,
selective deletion, stale retries, locks, session revocation/cancellation, symlinks,
and failures before/after atomic rename. Public artifact/trace audits remain
required. Application state and test results are not cryptographic certification.

The repository's independent external security review is required before merging
this private-data change. No such review is claimed, and real imports remain on
hold. Next work: independent review, automatic latest-state recovery and portable backup
policy, then selected-import transactions and durable user-authored observation revisions.
There is no model implementation in this milestone.


For the two existing Turbopack Vault file-tracing warnings and their deployment
implications, see [build tracing verification](storage-tracing.md).
