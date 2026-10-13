# Vault passkeys

Passkey enrollment, unlock and removal are implemented at `/vault`. Real-device
enrollment is an Author action; the compatibility check alone does not enable it.
The existing passphrase remains the recovery method. No record migration occurs.

## Biometric-assisted unlocking

Use **Unlock with passkey** with an already enrolled credential. The shared modal
shows it as the primary authentication action when an eligible credential exists;
**Use recovery passphrase** remains available in the same dialog. No new account,
OAuth flow, refresh token or separate login form is involved.

WebAuthn authentication requires user verification. The operating system or
authenticator chooses its supported method, such as a fingerprint, face, device
PIN or security-key verification. Storywalker never requests, receives or stores
biometric templates. A verified assertion establishes user verification; it does
not tell Storywalker that Touch ID or Face ID specifically was used, so the
button retains its neutral name.

Authentication options provide ordered, non-binding hints: `client-device`,
`hybrid`, then `security-key`. Supporting browsers can prefer a platform
authenticator while compatible cross-device and security-key paths remain
available. There is no platform attachment restriction or transport filter.
Browsers may ignore the hints. Platform availability does not establish PRF
compatibility: the selected existing passkey must still return the required
32-byte PRF result and unwrap its saved Vault key. Unsupported PRF fails closed
with recovery guidance; it never switches to signature-only Vault unlocking.

These preferences follow the [WebAuthn hint definition](https://www.w3.org/TR/webauthn-3/#enumdef-publickeycredentialhint).
Apple documents [using Touch ID to approve a Mac passkey](https://support.apple.com/en-gb/guide/passwords/mchl4af65d1a/mac);
this does not prove that a particular browser/provider supports Storywalker's PRF
requirements. Existing exact-origin verification, one-use challenges, counters,
two-minute prompt timeout and five-minute server challenge expiry are preserved.

## Use

On XR and other Vault-backed pages, **Unlock Vault** opens a dialog without
leaving the page. If a protected action is denied before execution with `VAULT_LOCKED`, the same
dialog opens and that action resumes once after a confirmed unlock. Expiry during
an operation uses `VAULT_SESSION_EXPIRED` and requires an explicit retry. Cancel keeps
the current page and does not save its pending work. Network failures do not
trigger automatic retries. Passkey and recovery-passphrase access share this flow.

For full-page access, `/vault?returnTo=/research/xr` returns to the source page
after unlocking. Return destinations are restricted to known local app routes;
external URLs and API paths are rejected. This navigation path does not preserve
unsaved state from a page that was left; use the inline dialog for continuity.

1. Open `http://localhost:3000/vault` in a browser that supports WebAuthn PRF.
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
an exclusive filesystem lock and atomic rename; redirected storage is rejected. It contains public credential material, counters, names,
per-credential salts, Vault identity and authenticated key wrappers. It never
stores an unwrapped key, passphrase or PRF output. No secret is placed in URLs,
localStorage, sessionStorage, logs or analytics. Buffers are cleared where possible;
JavaScript strings/garbage collection do not provide guaranteed secure erasure.
The browser never receives the unwrapped Vault key. The passkey provider receives
no scene/source material through this implementation; its usual credential sync
behavior is controlled by that provider.

The trusted origin defaults to `http://localhost:3000` (RP ID `localhost`). An
explicit `STORYWALKER_PASSKEY_ORIGIN` can configure another HTTPS origin. The code
never trusts a request's Host header as configuration. Non-local HTTP origins,
cross-origin requests and bodies larger than 64 KiB are rejected. Keep using the
same address: changing the origin requires passphrase access and new enrollment.
At `127.0.0.1` the shared modal offers the saved-address link; recovery passphrase
access remains available. Address-specific sessions are separate. Earlier-origin
wrappers are preserved but not silently migrated; enroll again at the chosen
address using recovery access. IP-address RP IDs are rejected.
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

The shared responsibilities and future extension boundaries are documented in
[the authentication architecture](auth-architecture.md).

## Manual Mac/browser acceptance — 10 October

The Author previously confirmed basic passkey and recovery access. Touch ID
specifically and the cases below have not been confirmed. All boxes remain
unchecked. Use the existing enrolled passkey; no enrollment or removal is needed.
Record browser/macOS version, provider, date and outcome only, without credential
IDs, biometric information, recovery phrases or private record contents.

Later on 10 October, the Author confirmed that the existing phone-assisted
passkey unlock works in both Safari and the Codex browser. The reported Codex
Bluetooth wait was temporary. Retain that credential and recovery access; no
enrollment or removal is requested. This confirms cross-device basic unlocking,
not local Touch ID, enrollment, expiry, cancellation or the other cases below.

- [ ] At the configured address (default `http://localhost:3000/vault`), open the
  shared unlock dialog from locked state. **Unlock with passkey** is the primary
  available action for an eligible credential; recovery is still reachable.
- [ ] Choose the existing passkey and approve the operating system's prompt.
  Note the method actually offered (Touch ID, another local method, or a nearby
  device), without assuming a method from the device's model. Confirm successful
  Vault access and unchanged existing evidence locally.
- [ ] If a compatible cross-device credential is already available, choose the
  browser's other-device option and verify it can still unlock with PRF. Mark
  unavailable combinations as untested; do not enroll another credential for this
  checklist or weaken origin/PRF checks to make it pass.
- [ ] Cancel or reject the device prompt. The Vault stays locked, recovery remains
  available and no automatic second prompt/request occurs. Retry only by pressing
  the button again.
- [ ] Using the keyboard, reach the passkey choice, primary action, recovery
  disclosure and close control. Escape cancels; closing restores focus to the
  opener. Navigation during a prompt must not continue the abandoned action.
- [ ] Press **Lock Vault now** after successful access. Protected actions are
  denied; unlock through the same dialog with the existing passkey again.
- [ ] Observe the fixed 15-minute expiry while interacting. Private access must
  end without silent renewal. An operation that expired after starting requires
  a new explicit action after unlock; unlock alone must not repeat its provider
  request. Use a fictional/local operation for this test.
- [ ] From locked state, a wrong recovery passphrase fails. The correct recovery
  passphrase succeeds when the passkey prompt is cancelled or unavailable.
- [ ] At an alternate local address, the dialog gives saved-address guidance
  without exposing credential labels or weakening the relying-party check.
- [ ] If the existing provider lacks PRF in the tested browser, neutral recovery
  guidance appears and the Vault stays locked. If that combination is unavailable,
  record this case as synthetic-only coverage, not a manual pass.

Automated coverage uses synthetic P-256 signatures, temporary Vaults and mocked
browser prompts. It verifies required user verification, PRF rejection/cleanup,
one-use challenges, exact origin/RP and counters, explicit lock/recovery,
cancellation, fixed expiry and non-replayed expired mutations. It does not
establish real biometric hardware or browser/provider compatibility.

## Change the recovery passphrase

Unlock `/vault`, then use **Change recovery passphrase**. Enter the current
recovery passphrase and a different new one twice (12–512 characters). Keep the
new passphrase somewhere safe before submitting. Success locks every session in
the local server process; unlock again with the new passphrase or an existing
passkey. This operation cannot recover a forgotten current passphrase.

The first explicit change upgrades only recovery metadata from version 1 to
version 2. There is no automatic migration on opening the Vault. A fresh scrypt
salt derives a wrapping key with the existing parameters (N=16384, r=8, p=1).
AES-256-GCM protects the existing data key, with authenticated metadata bindings.
The data key, encrypted record rows and passkey sidecar remain unchanged. The
old stable Vault identity is retained for passkey compatibility. Strict parsing
rejects malformed/unknown metadata rather than falling back to legacy recovery.

The replacement is verified before persistence. SQLite is compacted to discard
old recovery metadata from free pages, then written using the existing exclusive
lock, stale-snapshot check, temporary-file fsync and atomic rename. Authorization
and cancellation are checked immediately before replacement. A failure before
replacement keeps the previous database. Once replacement is confirmed, the route
reports success and clears the session cookie even if cleanup or a later session
check fails. A lost response or cancellation after
replacement cannot undo the change: check by unlocking with the new passphrase,
then the previous one or an existing passkey. Never retry a change automatically.

Older backups still require their original passphrase. Version-2 Vaults cannot
be opened by older versions of the app; retain compatible app code when backing
up. This is credential replacement, not full data-key rotation or compromise
recovery: a previously copied database plus its old passphrase, an exposed data
key, filesystem snapshots or forensic remnants are not revoked. No secure disk
erasure is promised. Session revocation applies to the supported single local
server process; do not operate multiple server instances against one Vault.

Tests use disposable fictional Vaults, injected write failures and synthetic
passkey wrappers. They do not change the Author's Vault or exercise a physical
authenticator. Real-device acceptance remains an explicit Author action.
