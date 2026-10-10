"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { installVaultUnlock, requestVaultUnlock, safeVaultReturn } from "@/lib/vault-access";
import { browserVaultSession, vaultAuthRequest } from "@/lib/vault-auth-client";
import { VaultPasskeys } from "./vault-passkeys";
import css from "./vault-access.module.css";

export function VaultAccess() {
  const path = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const resolve = useRef<((ok: boolean) => void) | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const attempt = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const [requestId, setRequestId] = useState(0);
  const [open, setOpen] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function finish(ok: boolean) {
    epoch.current++;
    attempt.current?.abort();
    const done = resolve.current;
    resolve.current = null;
    setPassphrase("");
    setOpen(false);
    setBusy(false);
    dialog.current?.close();
    done?.(ok);
    returnFocus.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    const remove = installVaultUnlock(() => new Promise<boolean>((done) => {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      resolve.current = done;
      setMessage("");
      setRequestId(++epoch.current);
      setOpen(true);
    }));
    return () => {
      remove();
      attempt.current?.abort();
      resolve.current?.(false);
      resolve.current = null;
    };
  }, []);

  // Pending actions belong to the current page, never to a later navigation.
  useEffect(() => {
    epoch.current++;
    attempt.current?.abort();
    resolve.current?.(false);
    resolve.current = null;
    setOpen(false);
    setBusy(false);
    setPassphrase("");
    dialog.current?.close();
  }, [path]);

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
  }, [open]);

  async function confirmed(ticket: number, signal?: AbortSignal) {
    if (ticket !== epoch.current) return;
    const session = await browserVaultSession(signal);
    if (ticket !== epoch.current) return;
    if (!session.active) throw new Error("Unlock could not be confirmed. Please try again.");
    finish(true);
  }

  async function unlock() {
    const ticket = requestId;
    const controller = new AbortController();
    attempt.current = controller;
    setBusy(true);
    setMessage("");
    const entered = passphrase;
    setPassphrase("");
    try {
      await vaultAuthRequest("/api/vault", { action: "unlock", passphrase: entered }, controller.signal);
      await confirmed(ticket, controller.signal);
    } catch (error) {
      if (ticket === epoch.current && !controller.signal.aborted) {
        setMessage(error instanceof Error ? error.message : "Could not unlock the Vault.");
      }
    } finally {
      if (ticket === epoch.current) setBusy(false);
      if (attempt.current === controller) attempt.current = null;
    }
  }

  return <dialog ref={dialog} className={css.dialog} aria-labelledby="inline-vault-title"
    onCancel={(event) => { event.preventDefault(); finish(false); }}>
    {open && <>
      <header><div><p>CONTINUE WHERE YOU ARE</p><h2 id="inline-vault-title">Unlock your Vault.</h2></div>
        <button type="button" onClick={() => finish(false)} aria-label="Close Vault unlock">×</button>
      </header>
      <p>Your page and unsaved edits stay here. Actions blocked before they start can continue after unlocking. If your session ended during an action, start it again explicitly.</p>
      <VaultPasskeys key={requestId} compact active={false} onUnlocked={() => confirmed(requestId)} onLock={async () => {}} />
      <details><summary>Use recovery passphrase</summary>
        <form onSubmit={(event) => { event.preventDefault(); void unlock(); }}>
          <label>Vault passphrase<input type="password" autoComplete="current-password" minLength={12} maxLength={512}
            value={passphrase} onChange={(event) => setPassphrase(event.target.value)} required /></label>
          <button type="submit" disabled={busy || passphrase.length < 12}>{busy ? "Unlocking…" : "Unlock and continue"}</button>
        </form>
      </details>
      {message && <p role="alert">{message}</p>}
      <footer>
        <button type="button" onClick={() => finish(false)}>Keep working without unlocking</button>
        <a href={`/vault?returnTo=${encodeURIComponent(safeVaultReturn(path) ?? "/research/xr")}`}>Open full Vault settings</a>
        <small>Private access lasts 15 minutes. No passphrase or pending scene is stored in browser storage.</small>
      </footer>
    </>}
  </dialog>;
}

export function VaultUnlockButton({ onUnlocked }: { onUnlocked?: () => void }) {
  const [status, setStatus] = useState("");
  async function unlock() {
    try {
      const session = await browserVaultSession();
      if (session.active || await requestVaultUnlock()) {
        setStatus("Vault unlocked.");
        onUnlocked?.();
      }
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unlock could not complete."); }
  }
  return <><button type="button" onClick={() => void unlock()}>Unlock Vault</button>
    {status && <span role="status"> {status}</span>}</>;
}
