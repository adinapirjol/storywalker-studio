"use client";

import type { BrowserVaultSession } from "@/lib/vault-auth-client";

type Props = {
  exists: boolean | undefined;
  session: BrowserVaultSession;
  busy: boolean;
  passphrase: string;
  onPassphrase: (value: string) => void;
  onCreate: () => void;
  onUnlock: () => void;
  onLock: () => void;
};

export function VaultSessionPanel(props: Props) {
  if (props.exists === undefined) return null;
  return <section className="notebook-card vault-card">
    <p className="section-kicker">{props.session.active ? "Vault session active" : props.exists ? "Unlock existing Vault" : "Create local Vault"}</p>
    {props.session.active ? <>
      <p>Available across this browser until <b>{props.session.expiresAt ? new Date(props.session.expiresAt).toLocaleTimeString() : "the fixed expiry"}</b>.</p>
      <button type="button" className="outline-button" disabled={props.busy} onClick={props.onLock}>Lock Vault now</button>
    </> : props.exists ? <>
      <p>Use the same passkey or recovery-passphrase window as every private view.</p>
      <button type="button" className="primary-button" disabled={props.busy} onClick={props.onUnlock}>Unlock Vault</button>
    </> : <>
      <label>New recovery passphrase<input id="vault-passphrase" type="password" autoComplete="new-password"
        value={props.passphrase} onChange={(event) => props.onPassphrase(event.target.value)} minLength={12} maxLength={512} /></label>
      <button type="button" className="primary-button" disabled={props.busy || props.passphrase.length < 12} onClick={props.onCreate}>Create encrypted Vault</button>
      <p>Keep this unique recovery passphrase. Losing it and access through every enrolled passkey makes recovery impossible.</p>
    </>}
    <p className="small-note">No passphrase is stored in browser storage. Private access expires exactly 15 minutes after unlock.</p>
  </section>;
}
