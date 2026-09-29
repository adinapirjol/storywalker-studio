# Vault passkeys

Passkey enrollment, unlock and removal are implemented at `/vault`. Real-device
enrollment is an Author action; the compatibility check alone does not enable it.
The existing passphrase remains the recovery method. No record migration occurs.

## Use

On XR and other Vault-backed pages, **Unlock Vault** opens a dialog without
leaving the page. If a protected action encounters an expired session, the same
dialog opens and that action resumes once after a confirmed unlock. Cancel keeps
the current page and does not save its pending work. Network failures do not
trigger automatic retries. Passkey and recovery-passphrase access share this flow.

For full-page access, `/vault?returnTo=/research/xr` returns to the source page
after unlocking. Return destinations are restricted to known local app routes;
external URLs and API paths are rejected. This navigation path does not preserve
unsaved state from a page that was left; use the inline dialog for continuity.

1. Open `http://localhost:3011/vault` in a browser that supports WebAuthn PRF.
2. Unlock with the existing passphrase. Under **Unlock with a passkey**, name it
   and acknowledge that the recovery passphrase is retained, then **Add passkey**.
3. Complete your device/provider prompt. Click **Complete encryption check** and
   approve the second prompt. Only a successful encryption check saves enrollment.
4. **Lock Vault to test passkey**, then **Unlock with passkey**. A successful real
   unlock is the final device acceptance check; synthetic tests cannot prove it.

Cancellation or missing PRF leaves passphrase access unchanged. A passkey created
on the device before a failed encryption check may remain in its password manager;
it has no saved Vault key wrapper and can be deleted there or a different provider
chosen. Enrollment challenges expire after five minutes. Vault sessions keep their
existing fixed 15-minute lifetime and disappear when the local server restarts.

**Manage enrolled passkeys** removes a credential's local wrapper. It does not
remove the provider's credential or end already-open Vault sessions; lock those
sessions normally. Keep the SQLite Vault and passkey sidecar together when backing
up locally. Without the sidecar, use the recovery passphrase and enroll again.
Without the passkey, use the recovery passphrase. Without both access methods,
there is no recovery bypass.

## Encryption and trust boundary

The existing Vault uses scrypt to derive a 256-bit key from the passphrase and a
per-Vault salt, then AES-256-GCM for records. Its database stores a key verifier,
not the passphrase. Enrolling a passkey wraps that same key; records and their
passphrase recovery are not rewritten.

SimpleWebAuthn Server 13.3.2 verifies registration and assertion signatures,
challenge, exact origin, RP ID, counters, presence and required user verification.
Challenges are random, single-use, browser-cookie-bound, process-local and expire
after five minutes. Enrollment also binds them to the active Vault session. The
local server rechecks enrollment session validity before saving. Unlock rechecks
the persisted credential to reject removed/changed credentials during a ceremony.

The authenticator's 32-byte PRF output is delivered transiently to the **local Node
server** in a same-origin POST. HKDF-SHA256 derives a wrapping key with a random
per-credential salt and a context binding the Vault identity, credential and
origin. AES-256-GCM stores an encrypted copy of the Vault key. The server verifies
the unwrapped key against the Vault verifier before issuing its ordinary opaque
HttpOnly session cookie. PRF is secret material, not a replacement for signature
verification. The browser's PRF extension result is not itself signed; trust in
the browser and local server is the same boundary as entering a passphrase here.

`private-data/vault/passkeys.json` is ignored by Git, mode 0600, and written with
an atomic rename. It contains public credential material, counters, names,
per-credential salts, Vault identity and authenticated key wrappers. It never
stores an unwrapped key, passphrase or PRF output. No secret is placed in URLs,
localStorage, sessionStorage, logs or analytics. Buffers are cleared where possible;
JavaScript strings/garbage collection do not provide guaranteed secure erasure.
The browser never receives the unwrapped Vault key. The passkey provider receives
no scene/source material through this implementation; its usual credential sync
behavior is controlled by that provider.

The trusted origin defaults to `http://localhost:3011` (RP ID `localhost`). An
explicit `STORYWALKER_PASSKEY_ORIGIN` can configure another HTTPS origin. The code
never trusts a request's Host header as configuration. Non-local HTTP origins,
cross-origin requests and bodies larger than 64 KiB are rejected. Keep using the
same address: changing the origin requires passphrase access and new enrollment.
This is a single-process local Vault, not a multi-user or multi-server auth service.

## Verification

Tests use generated P-256 credentials and real signatures, including attestation,
wrong origin/RP/challenge, missing verification/presence, signature tampering,
counter replay, challenge reuse/expiry/browser/session mismatch, PRF validation,
and authenticated wrapper tampering. Device/provider compatibility still requires
the Author's enrollment and lock/unlock test.

Sources:
- https://www.w3.org/TR/webauthn-3/#prf-extension
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API/WebAuthn_extensions
- https://simplewebauthn.dev/docs/packages/server
