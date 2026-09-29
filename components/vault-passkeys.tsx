"use client";
import { useEffect, useState } from "react";
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/server";
import { authenticateVaultPasskey, createVaultPasskey, passkeyError } from "@/lib/vault-passkey-browser";
import { VaultPasskeyCheck } from "./vault-passkey-check";

type SavedPasskey = { id: string; label: string; createdAt: string };
async function request<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/vault/passkeys", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Passkey request failed.");
  return result as T;
}
type AssertionRequest = { ceremonyId: string; salt: string; options: PublicKeyCredentialRequestOptionsJSON };
export function VaultPasskeys({ active, onUnlocked, onLock, compact=false }: { compact?:boolean; active: boolean; onUnlocked: () => Promise<void>; onLock: () => Promise<void> }) {
  const [credentials, setCredentials] = useState<SavedPasskey[]>([]), [selected, setSelected] = useState("");
  const [label, setLabel] = useState("My passkey"), [recovery, setRecovery] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""), [loaded, setLoaded] = useState(false), [enrolled, setEnrolled] = useState(false);
  // Keep the second device prompt on its own click, preserving browser user activation.
  const [pending, setPending] = useState<AssertionRequest>();
  async function refresh() {
    const status = await request<{ credentials: SavedPasskey[] }>({ action: "status" });
    setCredentials(status.credentials); setSelected((id) => status.credentials.some((item) => item.id === id) ? id : status.credentials[0]?.id ?? ""); setLoaded(true);
  }
  useEffect(() => { void refresh().catch((error) => setMessage(passkeyError(error))); }, [active]);
  async function enroll() {
    setBusy(true); setMessage(""); setPending(undefined); setEnrolled(false);
    try {
      const start = await request<{ ceremonyId: string; options: PublicKeyCredentialCreationOptionsJSON }>({ action: "begin-enroll", label, recoveryAcknowledged: recovery });
      const response = await createVaultPasskey(start.options);
      const next = await request<AssertionRequest>({ action: "verify-registration", ceremonyId: start.ceremonyId, response });
      setPending(next); setMessage("Passkey created on your device. Complete the encryption check below to enable it for this Vault.");
    } catch (error) { setMessage(passkeyError(error)); } finally { setBusy(false); }
  }
  async function finish() {
    if (!pending) return;
    setBusy(true);
    try {
      const assertion = await authenticateVaultPasskey(pending.options, pending.salt);
      await request({ action: "finish-enroll", ceremonyId: pending.ceremonyId, ...assertion });
      setPending(undefined); setEnrolled(true); setRecovery(false);
      setMessage("Passkey enrolled. Your recovery passphrase still works. Lock the Vault and try unlocking with this passkey to verify everyday access."); await refresh();
    } catch (error) { setPending(undefined); setMessage(`${passkeyError(error)} Setup is incomplete. A credential may remain in your password manager, but Vault access was not enabled for it.`); }
    finally { setBusy(false); }
  }
  async function unlock() {
    setBusy(true); setMessage("");
    try {
      const start = await request<AssertionRequest>({ action: "begin-unlock", credentialId: selected });
      const assertion = await authenticateVaultPasskey(start.options, start.salt);
      await request({ action: "finish-unlock", ceremonyId: start.ceremonyId, ...assertion });
      await onUnlocked(); setMessage("Vault unlocked with your passkey. The same 15-minute private session is active.");
    } catch (error) { setMessage(passkeyError(error)); } finally { setBusy(false); }
  }
  async function remove(credential: SavedPasskey) {
    setBusy(true);
    try { await request({ action: "remove", credentialId: credential.id }); await refresh(); setMessage(`Removed ${credential.label} from this Vault. You can also delete its entry in your password manager. Existing open sessions keep their normal expiry.`); }
    catch (error) { setMessage(passkeyError(error)); } finally { setBusy(false); }
  }
  if(compact)return <section aria-label="Passkey unlock"><p>{loaded?(credentials.length?'Use your enrolled passkey to continue.':'No passkey is enrolled yet. Use your recovery passphrase below.'):'Checking saved passkeys…'}</p>{credentials.length>0&&<><label>Passkey<select value={selected} onChange={e=>setSelected(e.target.value)}>{credentials.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button type="button" disabled={busy||!selected} onClick={()=>void unlock()}>{busy?'Waiting for your device…':'Unlock with passkey'}</button></>}{message&&<p role="status">{message}</p>}</section>;
  return <section className="notebook-card vault-card" aria-labelledby="vault-passkeys-title">
    <p className="section-kicker">Alternative Vault access</p><h2 id="vault-passkeys-title">Unlock with a passkey.</h2>
    <p>Use your device’s fingerprint, face, PIN or security key. Your passkey must also support encryption (PRF). Your recovery passphrase remains available.</p>
    {loaded && <p className="small-note">{credentials.length ? `${credentials.length} passkey${credentials.length === 1 ? "" : "s"} enrolled for this local Vault.` : active ? "No passkey enrolled yet. Add one below." : "No passkey enrolled yet. Unlock with your passphrase once to add one."}</p>}
    {!active && credentials.length > 0 && <div className="vault-form"><label>Passkey<select value={selected} onChange={(event) => setSelected(event.target.value)}>{credentials.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button className="primary-button" disabled={busy || !selected} onClick={() => void unlock()}>Unlock with passkey</button></div>}
    {active && <div className="vault-form">
      {pending ? <><p className="small-note">One more device prompt checks that this passkey can protect the encryption key. Finish within five minutes.</p><button className="primary-button" disabled={busy} onClick={() => void finish()}>Complete encryption check</button><button className="outline-button" disabled={busy} onClick={() => { setPending(undefined); setMessage("Setup cancelled. No Vault passkey was enabled. You may remove the new credential from your password manager."); }}>Cancel setup</button></> : <><label>Passkey name<input id="vault-passkey-name" value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} /></label><label className="consent-row"><input type="checkbox" checked={recovery} onChange={(event) => setRecovery(event.target.checked)} /> I have kept my recovery passphrase for device loss or an unsupported browser.</label><button className="primary-button" disabled={busy || !recovery || !label.trim()} onClick={() => void enroll()}>Add passkey</button></>}
      {enrolled && <button className="outline-button" disabled={busy} onClick={() => void onLock().then(() => setEnrolled(false))}>Lock Vault to test passkey</button>}
      {credentials.length > 0 && <details><summary>Manage enrolled passkeys</summary>{credentials.map((item) => <p key={item.id}>{item.label} · added {new Date(item.createdAt).toLocaleDateString()} <button className="outline-button" disabled={busy} onClick={() => void remove(item)}>Remove {item.label}</button></p>)}</details>}
    </div>}
    {busy && <p role="status">Waiting for passkey verification…</p>}
    {message && <p className="live-notice" role="status">{message}</p>}
    <p className="small-note">Passkeys are tied to this Vault and its local address. Keep using the same address. No private scenes or sources are sent to your passkey provider.</p>
    <details><summary>Browser compatibility</summary><VaultPasskeyCheck active={active} /></details>
  </section>;
}
