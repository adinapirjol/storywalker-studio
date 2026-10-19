# Study 04: the two Vault tracing warnings

Verified against the 14 October 2026 production review build, Next.js 16.3.8 with
Turbopack. These warnings predate the HEALTH recovery changes and remain visible.

## Exact cause

Both originate at `lib/vault/private-vault.ts:163` in
`assertVaultSnapshotCurrent`, via `app/api/vault/passkeys/route.ts`:

| Warning location | Expression | Actual purpose |
| --- | --- | --- |
| 163:45 | `existsSync(file)` | Ensure the currently opened Vault still has an on-disk snapshot |
| 163:114 | `readFileSync(file)` | Hash that snapshot and compare with the version opened earlier, rejecting stale authority |

Here `file = vault.storagePath ?? VAULT_PATH`. `storagePath` is a runtime override
used by isolated/test Vaults, so Turbopack cannot statically confine either access.
It warns: “Dynamic filesystem access causes tracing of the whole project.”
The two warnings are two calls in the same guard, not two observed data disclosures.

This is **output dependency tracing**, not distributed telemetry, health-event
logging, or an LLM call. A `.nft.json` manifest lists files needed by a server route.
It contains paths, not decrypted record contents. The warning itself prints source
locations, code and an import chain; it did not print keys, observations or Vault
payloads in this build. At runtime, the guard reads the local database to hash it;
that operation does not itself send or log its bytes.

## Why it still matters

Broad tracing can cause deployment tooling to copy unrelated source files and
private inputs into a server artifact. A manifest could expose a sensitive filename;
a deployed referenced file could expose its actual bytes. Server-only packaging
is not permission to ship personal records. Git-ignore and 0600 permissions do
not prevent this. Encryption does not authorize shipping ciphertext either.

`next.config.ts` explicitly excludes `private-data`, `tmp`, `*.private.*`, Apple
export names/directories, private report downloads, `.env*`, `.logfire`, `.git`,
and build directories from all route traces. `sql.js` remains external so its
SQLite WASM runtime can still be resolved. No `turbopackIgnore` suppression was
added and no cryptographic/session guard was removed to silence the warnings.

## Verification performed

```sh
STORYWALKER_REVIEW_BUILD=1 npx next build
STORYWALKER_REVIEW_BUILD=1 npm run audit:build-private
npm run audit:public
```

The direct build skips the unrelated network-refresh `prebuild` script and uses
`.next-review`, preserving the separate development build.

- Production build and TypeScript passed, with exactly these two warnings.
- All **45** generated `.nft.json` manifests were inspected; **1,542** unique
  resolved file references contained **zero** matches for the checked private
  path classes (including `tmp`). `sql-wasm.wasm` was still referenced.
- The privacy audit passed across **116** browser/prerender artifacts and all
  **45** manifests. It checks selected private markers/credentials locally and
  reports counts, not their values.
- An additional local scan found no matches for **10** private research-document
  heading markers across **779** build text files. Those headings were not printed.
- The public-repository audit passed. The negative regression test deliberately
  inserts a fictional private deployment reference and verifies audit rejection.

These checks support **no excluded private inputs identified in this build's
manifests and no checked content markers identified in the scanned artifacts**.
They do not prove that arbitrary future secrets are absent, validate an external
hosting pipeline, or certify runtime observability. No live health requests were
performed during the build, and the workspace HEALTH archive was never created
by the automated rehearsal. Never enable request-body logging for this route:
recovery codes, if captured by debugging/proxy tooling, are sensitive.

A later cleanup can make the snapshot guard's path statically bounded while
preserving its isolated-storage tests and runtime WASM dependency. That is a
separate security-reviewed change to the shared Vault. Until then, keep the
exclusions and artifact audits as release checks; do not treat warnings as either
proof of a leak or proof of safety.
