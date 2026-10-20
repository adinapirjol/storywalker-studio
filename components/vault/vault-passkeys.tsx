"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { safeVaultReturn } from "@/lib/vault/vault-access";
import { VaultPasskeyCheck } from "./vault-passkey-check";
import { useVaultPasskeys } from "./use-vault-passkeys";

type Props = { compact?: boolean; active: boolean; onUnlocked: () => Promise<void>; onLock: () => Promise<void> };

export function VaultPasskeys({ active, onUnlocked, onLock, compact = false }: Props) {
  const path = usePathname();
  const access = useVaultPasskeys(active, onUnlocked);
  const [label, setLabel] = useState("My passkey");
  const [recovery, setRecovery] = useState(false);
  const selection = <label>Passkey<select value={access.selected} onChange={(event) => access.setSelected(event.target.value)}>
    {access.credentials.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
  </select></label>;
  const unlock = <><p>Your device chooses how to verify you. Fingerprint or face verification stays on your device; Storywalker receives no biometric data.</p>{selection}
    <button type="button" className="primary-button" disabled={access.busy || !access.selected} onClick={() => void access.unlock()}>Unlock with passkey</button></>;
  const guidance = access.address?.supportedOrigin === false ? <p>
    Passkey unlock is available at {access.address.origin}, not this page’s address. This does not mean your passkey is missing. <a target="_blank" rel="noopener noreferrer" href={`${access.address.origin}/vault?returnTo=${encodeURIComponent(safeVaultReturn(path) ?? "/research/xr")}`}>Open passkey unlock in a new tab</a>.
    Your current page and unsaved edits stay here. Continue on the new tab after unlocking; its session does not unlock this address. To continue here instead, use the Vault recovery passphrase below.
  </p> : null;

  if (compact) return <section aria-label="Passkey unlock">
    {guidance ?? (access.address ? access.credentials.length ? unlock : <p>No passkey is enrolled at this address. Use your recovery passphrase below.</p> : <p>Checking saved passkeys…</p>)}
    {access.busy && <p role="status">Waiting for your device…</p>}
    {access.message && <p role="status">{access.message}</p>}
  </section>;

  return <section className="notebook-card vault-card" aria-labelledby="vault-passkeys-title">
    <p className="section-kicker">Alternative Vault access</p><h2 id="vault-passkeys-title">Unlock with a passkey.</h2>
    <p>Use your device’s fingerprint, face, PIN or security key. Its passkey must support encryption (PRF). Your recovery passphrase remains available.</p>
    {guidance}
    {access.address?.supportedOrigin && <>
      <p className="small-note">{access.credentials.length} passkeys enrolled for this address and Vault.</p>
      {!active && access.credentials.length > 0 && <div className="vault-form">{unlock}</div>}
      {active && <div className="vault-form">
        {access.pending ? <>
          <p>One more device prompt checks encryption support. Finish within five minutes.</p>
          <button type="button" className="primary-button" disabled={access.busy} onClick={() => void access.finish()}>Complete encryption check</button>
          <button type="button" className="outline-button" disabled={access.busy} onClick={access.cancelSetup}>Cancel setup</button>
        </> : <>
          <label>Passkey name<input id="vault-passkey-name" value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} /></label>
          <label className="consent-row"><input type="checkbox" checked={recovery} onChange={(event) => setRecovery(event.target.checked)} /> I have kept my recovery passphrase for device loss or an unsupported browser.</label>
          <button type="button" className="primary-button" disabled={access.busy || !recovery || !label.trim()} onClick={() => void access.enroll(label, recovery)}>Add passkey</button>
        </>}
        {access.enrolled && <button type="button" className="outline-button" disabled={access.busy} onClick={() => void onLock().then(() => access.setEnrolled(false))}>Lock Vault to test passkey</button>}
        {access.credentials.length > 0 && <details><summary>Manage enrolled passkeys</summary>
          {access.credentials.map((item) => <p key={item.id}>{item.label} · added {new Date(item.createdAt).toLocaleDateString()} <button type="button" disabled={access.busy} onClick={() => void access.remove(item)}>Remove {item.label}</button></p>)}
        </details>}
      </div>}
    </>}
    {access.busy && <p role="status">Waiting for passkey verification…</p>}
    {access.message && <p className="live-notice" role="status">{access.message}</p>}
    <p className="small-note">Passkeys belong to this Vault and its saved address. No private scenes or sources are sent to the passkey provider.</p>
    <details><summary>Browser compatibility</summary><VaultPasskeyCheck active={active} /></details>
  </section>;
}
