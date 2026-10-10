# Local Author access architecture

Storywalker has one local Author, not accounts, tenants or a remote identity
provider. Authentication proves access to the encrypted Vault key. Authorization
checks a current process-local session. Source consent, evidence acceptance and
external export consent remain separate domain decisions.

## Responsibilities

| Module | Responsibility |
| --- | --- |
| `lib/vault-session.ts` | Opaque session reference, fixed expiry, key erasure, rotation and revocation |
| `lib/local-origin.ts` | Loopback Host / same-origin browser boundary; no forwarded-host trust |
| `lib/vault-route-access.ts` | Scoped Vault opening, transient-key cleanup, persistence and result guards |
| `lib/vault-passkeys.ts` | Verified one-use ceremonies, PRF wrapping and locked atomic credential storage |
| `lib/vault-passkey-browser.ts` | Device API adapter with cancellation and PRF cleanup |
| `lib/vault-auth-client.ts` | Non-replayed, same-origin, uncached authentication transport |
| `lib/vault-access.ts` | Shared prompt coordination and one safe retry of a pre-execution denial |
| `components/vault-access.tsx` | One global passkey / recovery-passphrase modal with focus restoration |
| `components/use-vault-passkeys.ts` | Enrollment, encryption check and unlock lifecycle |
| `components/vault-passkeys.tsx` | Presentation and explicit Author actions |

Private views invoke `vaultFetch` for protected actions and `VaultUnlockButton`
for explicit unlock. `/vault` uses the same modal for existing Vault access; it
owns creation and passkey management. Do not add a second login form or store a
passphrase in page state for later import actions. Creation uses a new recovery
passphrase once. Never call the replaying wrapper from authentication itself.

A server route first rejects a foreign origin and a missing session before work.
Then `withBrowserVault(token, work)` binds the existing persistence guard and
checks authority again before returning. Work with awaited external operations
must also check authority after those operations, before accessing further
private sources. Existing large Vault/provider routes retain their equivalent
checks; new storage routes should use the scoped helper. A UI flag cannot grant
server authority. Every private response uses `Cache-Control: no-store`.

## State transitions and retry policy

- Locked before execution: `401 VAULT_LOCKED`; one coalesced modal may resume a
  replayable local action once after confirmed unlock.
- Cancelled or navigated away: abort owned work and device prompts; never continue
  the pending action. An already-issued server session/write cannot be recalled
  merely by cancelling its network response.
- Expired or locked during work: `401 VAULT_SESSION_EXPIRED`; block persistence and
  private output. Require a new explicit action, because a provider call may have
  happened already.
- Network failure: no implicit mutation retry; inspect current state before retry.
- Consumed `Request` or streaming request body: no implicit replay or unbounded
  cloning. The caller must explicitly restart with a new bounded input.
- Successful unlock: replace the caller's old session; other browser sessions have
  their own fixed lifetime. Lock deletes the server key and expires the cookie.

Browser session references are HttpOnly, SameSite Strict and short-lived. Keys
stay in the local Node process. Restart loses sessions and pending passkey
ceremonies. Hot reloads and route bundles share process-local stores. A future
multi-process deployment needs an explicit key/session authority redesign; this
implementation must not be treated as a distributed authentication service.

## Passkey address and storage

The default is `http://localhost:3000`, RP ID `localhost`. A configured
`STORYWALKER_PASSKEY_ORIGIN` must be an exact origin with a domain host and HTTPS,
or local HTTP `localhost`. IP addresses are not RP domain names. At another local
address the modal offers address guidance without exposing saved credential labels
or weakening verification. Recovery-passphrase access still works there.

Changing the configured origin does not migrate credentials or encrypted records.
Wrappers from an earlier origin are retained locally; use recovery access to enroll
at the chosen address. Browser sessions at `localhost` and `127.0.0.1` are separate.
Never silently broaden trusted origins or rewrite a passkey wrapper's origin.

Unlock requests require user verification and prefer the platform through
non-binding WebAuthn hints, retaining compatible cross-device credentials. The
operating system chooses the verification method; Storywalker receives no
biometric templates and cannot infer Touch ID or Face ID from a verified assertion.
PRF remains mandatory for unwrapping the existing Vault key. The shared dialog
keeps passkey unlocking primary and recovery access available. See the
[Mac/browser acceptance checklist](vault-passkeys.md#manual-macbrowser-acceptance--10-october).

The ignored sidecar uses owner-only files, rejects redirected storage, and holds
an exclusive filesystem lock through compare-and-replace. Challenges are bounded,
one-use, browser-cookie-bound and expire in five minutes. Enrollment/removal must
retain current session authority through asynchronous verification. PRF support
is tested before enrollment is stored. Removal invalidates pending unlocks; it
does not delete provider entries or revoke independent open sessions.

## Streaming boundaries

The receiver's preview stream is a bounded latest-value view, not an evidence
queue. Slow consumers coalesce preview values; the separate encrypted archive
preserves evidence. Streams stop on abort, expiry and viewer revocation. Contact,
measurement and receipt times remain distinct. The Python adapter drains stderr
privately, bounds stdout and copies output once before parsing. Request readers
count bytes before decoding and cancel on error or abort.

## Fictional coverage

`/research/xr/aurora-coast` includes a manually stepped BODY study, a timestamped
simulated batch, threshold examples and access-boundary explanations. It neither
unlocks real data nor writes to Logfire. `lib/aurora-integrations.test.ts` checks
its examples against the real local Pydantic evaluator in an isolated test.

Cryptographic tests generate synthetic P-256 credentials and real signatures;
route tests cover expiry and atomic acceptance; stream tests cover slow readers,
revocation and cancellation. These tests do not prove a real browser/provider's
PRF support. The Author's enrollment and lock/unlock check remains required.

See [passkey use and encryption](vault-passkeys.md) and
[review standards](code-review-guidelines.md).
