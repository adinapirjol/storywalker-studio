# PR #2: M3/M4 assessment and bounded follow-ups

10 October 2026. Reviewed at `a2df4b0` and against the unstaged remediation.
No production cryptography, Vault contents, passkeys, installations or export
settings were changed. The independent review is the Notion page
“Storywalker Studio PR #2 — Independent Review”, dated 10 October 2026.

## M3 — offline database disclosure

`lib/vault/private-vault.ts:62,70,138–145` confirms plaintext record IDs, kinds, capture
times and an unkeyed SHA-256 of serialized payload alongside AES-GCM ciphertext.
The hash is not used to authenticate ciphertext or checked on reads. Known small
payloads (notably tombstones) permit equality/dictionary tests; identical payloads
in separate Vaults have identical hashes. Guessing a full health observation also
requires guessing its IDs, timestamps and other fields, so “guessable BPM” alone
overstated the attack. Record existence, categories, timing and equality remain
meaningful metadata leaks to someone with a copied SQLite file/backup.

This threat model protects encrypted payloads against offline file theft, not
malware controlling an unlocked process. OS access control and disk encryption
reduce exposure but do not remove leaks from copied backups. Existing plaintext
source exports are outside the Vault's ciphertext protection and must stay private.

The recovery KDF uses Node's default scrypt cost; parameters are absent from
`VaultMeta`. Current OWASP password-storage guidance lists scrypt N=2^17, r=8, p=1
as one baseline (128 MiB). That is useful offline-guessing guidance, not a drop-in
Vault migration specification. Benchmark memory, unlock latency and concurrent
unlock limits on supported machines before selecting costs.
Source: [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt).

### Migration-safe recommendation (not implemented)

- Version the format and persist validated KDF parameters, with strict resource
  ceilings before derivation. Retain explicit support for legacy defaults.
- Prefer a random data-encryption key wrapped by a recovery-derived key for a
  future format. Today the derived recovery key directly encrypts records and
  is wrapped by passkeys. Raising scrypt cost directly changes that key.
- Changing that key requires re-encrypting all records, updating the verifier,
  and preserving/replacing every passkey wrapper. Existing PRF wrappers cannot
  simply be regenerated without the applicable credential ceremony. Do not
  “upgrade on unlock” while leaving other access paths stranded.
- If equality hashes remain necessary, derive a domain-separated HMAC subkey
  from the per-Vault data key. Otherwise remove unused hashes in the new format.
  HMAC does not hide record IDs, kinds, timing, sizes or within-Vault equality.
  Put sensitive metadata inside encrypted records; use an encrypted index or
  narrowly defined opaque lookup tokens where required, with explicit leakage.
- Prepare a separate new file under an exclusive migration lock. Verify every
  decrypted record, both access methods, interruption recovery, backup/rollback,
  free-space and symlink boundaries before atomic replacement. Never discard the
  only recoverable copy. Revoke old in-memory sessions only after verified cutover.
- Tests: equal plaintext across independently keyed Vaults has different tokens;
  legacy files unlock unchanged; crash injection at each write boundary leaves a
  recoverable format; recovery and every retained passkey still work; oversized
  KDF inputs fail before allocation. Old backups/history still contain old leaks.

This is a larger encryption/access migration and is deliberately outside this
patch. Author approval of a separate design and recovery exercise is required.

## M4 — current-source sanitization (implemented, unstaged)

The bounded patch removes dated device/network chronology from `AGENTS.md` and
condenses the security review into verification boundaries, failure distinctions,
repair evidence and official troubleshooting references. It retains the security
findings, threat model, automated checks and manual acceptance requirements.
The native README now reflects H1 rather than the obsolete automatic-export lane.

Telemetry project identifiers are removed from production code, UI links, tests
and current documentation. BODY uses server-start `STORYWALKER_HEALTH_PROJECT_URL`;
fictional Dramaturg metrics use `DRAMATURG_TELEMETRY_PROJECT_URL`. Both require an
exact EU project URL and matching credential. The network destination remains the
fixed EU OTLP host; neither config nor a credential can select another endpoint.
BODY's existing persisted setting must also match the configured target. Restart
and fresh session consent are required after changing it. No real local setting,
credential or installation was edited, and no external event was sent.

The source/build audits now share `scripts/private-audit-markers.mjs`. It discovers
recovery inputs in their existing ignored directory without embedding a personal
recovery filename in the audit code, checks both credential locations, retains
provenance markers and rejects unsafe/unreadable/oversized inputs. Synthetic tests
exercise clean and contaminated public source, JS, HTML and RSC, including no-value
error messages. Existing forbidden-path, raw-health, share-token and credential
pattern checks remain. The historical denylist terms and legacy import/storage
paths outside the audits remain compatibility/security contracts; changing them
would require separate migration or retention decisions, not cosmetic obfuscation.

The earlier documentation-only proposal is superseded by the working-tree patch.
Do not commit that temporary patch file: its removed text would create a new public
copy. Current-file sanitization does not erase Git history, forks, caches or old PR
diffs. Project identifiers are not credentials; no credential incident or history
rewrite is claimed. M3 cryptography and data migration remain outside this patch.
See [configuration and audit bounds](health-export-consent.md#private-target-configuration-m4).

## M2 — delivery cost follow-up

Confirmed: `stageNativeTransfer` calls `listNativeTransfers`, which derives timing
from every accepted observation; `decideNativeTransfer` repeats it. Accept passes
replacement IDs to `writeVaultRecords`, causing VACUUM even without source deletion.
For B accepted batches with O surviving observations, pending-count discovery
performs roughly B + O decryptions per delivery before other lookups.

Acceptance experiment: synthetic 0/100/1,000/10,000-observation histories, ten
warm-up and 100 measured stages on the same named machine/runtime. Record p50/p95,
peak RSS, bytes rewritten, decrypt calls and VACUUM count. Target: pending-count
lookup reads one encrypted index independent of history size; p95 staging overhead
at 10,000 vs 1,000 observations <=1.25x excluding whole-file persistence cost;
no VACUUM on ordinary accept; deletion still removes recoverable SQLite remnants.
Publish measured baseline before implementation. Preserve concurrent-write guards,
tombstones, idempotent receipts and stale-review rejection. Do not introduce a
plaintext health index. Whole-file encrypted persistence remains a separate cost.

## M5 — evidence follow-up

CI currently runs JS/Python/type/lint/build/audits on Linux, with no Swift job.
Both production audits still condition real private-marker checks on local files.
M4 adds synthetic source/build canary tests to the JS suite, including HTML/RSC and
credential coverage; clean CI now exercises those checks. Passing pattern scans
alone do not prove non-disclosure. The broader transitive client-graph guard and
macOS Swift CI job remain outstanding.

Acceptance: CI creates fictional marker/credential inputs in a temporary fixture
root; clean bundles pass; each injected canary fails in JS, prerendered HTML and
RSC; failures print only artifact path/category, never canary values. Add a client
boundary guard proving that imports of server Vault, node built-ins and sql.js
cannot enter the client graph (test a deliberate transitive violation as well as
raw marker scanning). Run the complete CollectorCore Swift suite in a macOS CI job
on every PR. Upload redacted command summaries and bind them to the tested commit.
Native core tests remain distinct from signed-device acceptance. Manual Watch,
phone, session lock and receipt-dequeue checks require separate Author verification.
