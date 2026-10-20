# Study 04: synthetic recovery, migration and deletion

14 October 2026. Fixed invented observations only. **Real imports remain disabled.**
No prediction code or collection scheduler is included. The 32-week experiment is
an uncommitted proposal, not an agreed schedule or a running experiment.

## Implemented scope

The current archive remains `private-data/health-study04-synthetic/archive.enc`.
An explicitly created recovery snapshot is `recovery.enc` in the same directory.
It is a separate, fixed-size AES-256-GCM envelope encrypted with a random 256-bit
recovery code, independent of the Vault key. Its format marker and HKDF/AAD domain
are distinct from the current archive, so swapping their roles fails authentication.
All observations, provenance, timestamps and revisions remain inside encryption.
Neither the recovery code nor a plaintext copy is written to either file.

The browser generates the code with `crypto.getRandomValues`. Use **Generate new
recovery code** for creation, not a memorable phrase padded to 64 characters. The
code is a key, not a passphrase; it does not use a password-hardening KDF. Copying
is an explicit action. Clipboard/password-manager copies are outside Storywalker.
The form and local request necessarily hold the code in memory; JavaScript strings,
browser/network debugging, swap and OS copies cannot be guaranteed erased. Clear
the form and clipboard when finished. Do not record or screenshot recovery codes.

Both inspection and recovery require the existing local-origin checks and an
active Vault session. The recovery code cannot log into or recover the personal
Vault. A reset to a new Vault key still requires authentication to that new Vault.
Recovery does not read or alter the personal Vault database or its passkeys.

- **Create:** authenticate the current archive, encrypt a recovery snapshot, fsync,
  atomically rename, fsync the directory, then authenticate the saved copy again.
  An existing recovery snapshot cannot be overwritten accidentally.
- **Preview:** authenticate the recovery copy with the supplied code; display its
  invented-observation count without replacing anything.
- **Restore:** after explicit replacement selection, authenticate the copy,
  re-encrypt under the active Vault key, and issue a fresh revision. This works when
  the current file is absent, has bounded corruption, or uses an unavailable old key.
- **Migrate with the old key:** the server-only `migrateKey` primitive authenticates
  the existing archive with the previous key and re-encrypts its latest contents
  under the destination key, atomically. It is exercised in disposable scripts/tests;
  raw Vault keys are never accepted by the HTTP API. It is not automatically wired
  to the general Vault lifecycle. In the UI, a verified recovery snapshot is the
  available migration route, limited to that snapshot's contents.
- **Delete recovery copy:** unlink only `recovery.enc`, fsync the directory, retain
  the current archive. Reload status after any uncertain result.

Status/version tokens are SHA-256 of ciphertext, returned only through the
session-protected route; no plaintext-content hash is persisted. Every recovery
command compares both file tokens under the same exclusive archive lock. A change
to either file after inspection invalidates the action. Restores never silently
merge data or replay a failed command. A fresh revision invalidates older edits.

Current source verification: `replaceRecoveryEnvelope` in `vault-recovery.ts`
rewraps the **same** data key, including legacy metadata v1 → v2. Therefore the
implemented recovery-passphrase change itself does not require re-encrypting this
HEALTH archive. Resetting/replacing the underlying data key is a different operation.
This distinction supersedes the earlier broad warning about all recovery migrations.
No personal recovery-passphrase operation was performed during verification.

## Short rehearsal

For a disposable rehearsal that never accesses the personal Vault, run:

```sh
node --import tsx scripts/rehearse-health-recovery.ts
```

Expected: four `PASS` lines covering encrypted save/backup, deletion and wrong-key
rejection, restoration under a new synthetic key, and explicit key migration plus
backup deletion. The temporary directory is removed in `finally`; keys and code
are not printed. This checks successful operations, not the whole failure suite.

To try the interface using only its fixed invented fixture:

1. Open `/research/health` on the existing local origin used for your Vault.
   Load/unlock the synthetic archive; save the fixed fixture if empty.
2. Choose **Inspect recovery storage**, **Generate new recovery code**, then
   **Copy recovery code** and save it separately. Tick the acknowledgement and
   **Create encrypted recovery snapshot**. Expect confirmation that the disk copy
   authenticated. No free-text diary or report draft is included.
3. Reload the archive; delete the stored synthetic sleep batch. Reload again:
   only the invented diary observations remain. The recovery copy still holds the
   original fixture.
4. Inspect recovery storage again, supply the saved code and choose **Preview
   recovery snapshot**. Expect the original observation count. An incorrect code
   fails without changing the archive. The generic message also covers corruption;
   it does not pretend to distinguish these from a failed response.
5. Select replacement and **Restore selected snapshot**, then reload the archive.
   Expect the original sleep and diary observations, with a new revision. Newer
   edits are replaced, and previously deleted records in the snapshot return.
6. Delete the recovery snapshot separately, clear the code from the form, and
   clear its clipboard copy. Expect the current archive to remain readable.

Do **not** reset your personal Vault to rehearse key migration. The script/tests
use two disposable keys for that case. UI/device/passkey acceptance is separate
from these automated results.

## Failure behavior and stopped-writer recovery

- Wrong keys, wrong codes, bad tags, truncation, role-swapping, unsafe directories,
  symlinks/hardlinks and oversized files fail closed. Current ciphertext remains
  untouched. Oversized/unsafe files must be quarantined manually while stopped;
  the app will not read them just to compute a restore token.
- A file-write/fsync failure **before rename** leaves the previous committed file
  intact and removes this operation's temporary ciphertext where normal cleanup
  can run. Migration still opens with the old key; no half-migrated file is used.
- A directory-fsync failure **after rename** reports `ARCHIVE_COMMIT_UNCERTAIN_RELOAD`
  (HTTP 503). The new file may already be committed. An expired session or lost
  response after commit can likewise leave a completed write. Inspect and
  authenticate the result before deciding on another action; never blindly retry.
- A process killed around rename can leave `archive.enc.lock` and `.pending-*`
  ciphertext. Automated tests kill a child process on both sides of rename and
  verify that the committed file is wholly old or wholly new. This models process
  death, not a physical power failure or every filesystem's durability behavior.
- Locks are never stolen automatically. **Stop every Storywalker server/CLI writer
  first**, confirm none remains, and preserve both committed encrypted files plus
  the saved code before cleanup. Only then remove this synthetic directory's stale
  `archive.enc.lock` and abandoned `.pending-*` files. Do not delete locks from the
  personal Vault. Restart, inspect storage, preview/authenticate and restore if
  necessary. Tests exercise this stopped-child cleanup; no automatic live-writer
  recovery or cross-device filesystem recovery is claimed.

## What deletion does and does not remove

| Action | Removed/replaced | Survives |
| --- | --- | --- |
| Delete stored diary or sleep batch | Selected records in the current encrypted snapshot; loaded drafts/report previews are cleared | Other current records; old recovery snapshots; external reports; filesystem snapshots |
| Delete all stored observations | Current observations; an empty encrypted snapshot with a fresh revision remains | Recovery copy and its observations, copied ciphertext, downloaded reports, OS history |
| Delete recovery snapshot | This local `recovery.enc` directory entry, with directory fsync | Current archive, separately copied backups and recovery codes, filesystem snapshots |
| Restore selected snapshot | Current snapshot replaced, fresh revision | Recovery file unchanged; deleted records in that backup return; other backups/exports unchanged |
| Clear code/form or close tab | Current app reference to the code/drafts | Clipboard/password manager, browser/OS memory remnants, logs made by external debugging tools |
| Delete a downloaded report in the OS | That separately selected file | Archive/backup, trash, synced/downloaded copies and OS snapshots as applicable |

Deletion is not guaranteed SSD secure erasure, cryptographic erasure of every copy,
or anti-rollback protection against a same-user attacker replacing valid encrypted
files. Codes kept with their ciphertext defeat the independent recovery boundary.
A backup copied off-device remains recoverable with its code even after local
key migration or deletion. Changing a Vault passphrase does not revoke those copies.

## Limits and next gate

This is one explicit local restore point, **not** automatic versioned or off-device
backup. Later edits are not covered. Refresh currently requires explicit deletion
and recreation, which temporarily leaves no local recovery copy; retain a separately
verified encrypted copy/code before doing so. No recovery-file upload/download UI
has been added, and real Apple imports stay disabled. The copied-backup restoration
test uses only a temporary destination and synthetic keys.

Lost Vault key + no valid recovery snapshot/code means unrecoverable data. Loss of
both files on this disk is not solved here. Recovery after key compromise, automatic
latest-state key envelopes, portable backup consent/import UX, crash-lock assistance,
and general user-authored storage still require design/review before real collection.

Independent external security review of this exact change is required before merge
by `docs/code-review-guidelines.md`. Tests and this implementer's review do not
replace it. No review, merge readiness, personal import, native acceptance or
forecast experiment commencement is claimed.

## Validation and changed files

Automated verification on 14 October: **94 test files, 458 tests passed**. This
includes 21 dedicated recovery tests and authenticated-route tests. The initial
sandbox run blocked five existing loopback TLS receiver tests with `listen EPERM`;
the permitted rerun passed. The privacy source guard was updated to allow only the
two dedicated synthetic archive/recovery clients, retaining the prohibition on
transport from personal-input components. Targeted ESLint, TypeScript in the
production review build, and `git diff --check` passed. The disposable walkthrough
printed all expected PASS results and removed its temporary directory.

Touched files for this follow-up (earlier unrelated changes preserved):

- Storage/contracts: `lib/health/server/archive-crypto.ts`,
  `lib/health/server/archive-files.ts`, `lib/health/server/encrypted-archive.ts`,
  `lib/health/synthetic-archive.ts`.
- Local route/UI: `app/api/health-rehearsal/route.ts`,
  `components/health/archive-rehearsal.tsx`, `components/health/archive-recovery.tsx`.
- Verification: `lib/health/archive-recovery.test.ts`,
  `lib/health/archive-route.test.ts`, `lib/health/health.test.ts`,
  `scripts/rehearse-health-recovery.ts`.
- Public synthetic-only documentation: this file, `storage-tracing.md`,
  `storage-rehearsal.md`, and the Study 04 `README.md`.
- Private research status: appended correction/status notes to `verification.md`,
  `privacy-audit.md`, and `build-backlog.md` in the ignored research pack. That
  research pack remains owner-only plaintext; permissions and ignore rules do
  not encrypt it. No personal history was added to public docs or fixtures.

No commit, push, merge, device installation or personal-key migration was performed.
