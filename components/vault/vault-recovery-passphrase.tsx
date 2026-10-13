"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { vaultAuthRequest } from "@/lib/vault/vault-auth-client";

export function VaultRecoveryPassphrase({ disabled, onChanged }: { disabled: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || disabled) return;
    const fields = new FormData(event.currentTarget);
    const body = Object.fromEntries(fields.entries());
    if (body.newPassphrase !== body.confirmation) { setMessage("The new passphrases must match."); return; }
    if (body.newPassphrase === body.currentPassphrase) { setMessage("Choose a different recovery passphrase."); return; }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setMessage("");
    form.current?.reset();
    try {
      await vaultAuthRequest("/api/vault/recovery-passphrase", body, controller.signal);
      onChanged();
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error && error.message !== "Failed to fetch"
        ? error.message : "The change could not be confirmed. Try unlocking with the new passphrase, then the previous one or an existing passkey. Do not submit the change again automatically.");
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <section className="notebook-card vault-card" aria-labelledby="recovery-change-title">
    <h2 id="recovery-change-title">Change recovery passphrase</h2>
    <p>Your encrypted records and existing passkeys stay in place. Changing the passphrase locks all current Vault sessions.</p>
    <p className="small-note">Save the new passphrase somewhere safe. Older backups still need their original passphrase. This does not protect copies already taken with the old credentials.</p>
    <form ref={form} onSubmit={submit} className="vault-form">
      <fieldset disabled={busy || disabled}>
        <label>Current recovery passphrase<input name="currentPassphrase" type="password" autoComplete="current-password" required minLength={12} maxLength={512} /></label>
        <label>New recovery passphrase<input name="newPassphrase" type="password" autoComplete="new-password" required minLength={12} maxLength={512} /></label>
        <label>Confirm new recovery passphrase<input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={512} /></label>
        <button type="submit" className="primary-button">{busy ? "Changing passphrase…" : "Change passphrase and lock Vault"}</button>
      </fieldset>
    </form>
    {message && <p role="alert">{message}</p>}
  </section>;
}
