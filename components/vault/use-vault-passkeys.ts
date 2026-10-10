"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/server";
import { authenticateVaultPasskey, createVaultPasskey, passkeyError } from "@/lib/vault/vault-passkey-browser";
import { vaultAuthRequest } from "@/lib/vault/vault-auth-client";

export type SavedPasskey = { id: string; label: string; createdAt: string };
type AssertionRequest = { ceremonyId: string; salt: string; options: PublicKeyCredentialRequestOptionsJSON };
type Address = { origin: string; supportedOrigin: boolean };

/** Own the credential ceremony separately from its presentation. No automatic retries. */
export function useVaultPasskeys(active: boolean, onUnlocked: () => Promise<void>) {
  const operation = useRef<AbortController | null>(null);
  const [credentials, setCredentials] = useState<SavedPasskey[]>([]);
  const [selected, setSelected] = useState("");
  const [address, setAddress] = useState<Address>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [enrolled, setEnrolled] = useState(false);
  const [pending, setPending] = useState<AssertionRequest>();

  function request<T>(body: Record<string, unknown>, signal: AbortSignal) {
    return vaultAuthRequest<T>("/api/vault/passkeys", body, signal);
  }
  async function refresh(signal: AbortSignal) {
    const status = await request<Address & { credentials: SavedPasskey[] }>({ action: "status" }, signal);
    setAddress(status);
    setCredentials(status.credentials);
    setSelected((id) => status.credentials.some((item) => item.id === id) ? id : status.credentials[0]?.id ?? "");
  }
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal).catch((error) => {
      if (!controller.signal.aborted) setMessage(passkeyError(error));
    });
    return () => { controller.abort(); operation.current?.abort(); };
  }, [active]);

  async function run(work: (signal: AbortSignal) => Promise<void>) {
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setMessage("");
    try { await work(controller.signal); }
    catch (error) { if (!controller.signal.aborted) setMessage(passkeyError(error)); }
    finally {
      if (operation.current === controller && !controller.signal.aborted) setBusy(false);
      if (operation.current === controller) operation.current = null;
    }
  }
  function enroll(label: string, recoveryAcknowledged: boolean) {
    setPending(undefined);
    setEnrolled(false);
    return run(async (signal) => {
      const start = await request<{ ceremonyId: string; options: PublicKeyCredentialCreationOptionsJSON }>(
        { action: "begin-enroll", label, recoveryAcknowledged }, signal,
      );
      const response = await createVaultPasskey(start.options, signal);
      const next = await request<AssertionRequest>({ action: "verify-registration", ceremonyId: start.ceremonyId, response }, signal);
      setPending(next);
      setMessage("Passkey created on your device. Complete the encryption check to enable it for this Vault.");
    });
  }
  function finish() {
    const next = pending;
    if (!next) return;
    return run(async (signal) => {
      try {
        const assertion = await authenticateVaultPasskey(next.options, next.salt, signal);
        await request({ action: "finish-enroll", ceremonyId: next.ceremonyId, ...assertion }, signal);
        setPending(undefined);
        setEnrolled(true);
        setMessage("Passkey enrolled. Lock and unlock with it to verify everyday access. Your recovery passphrase still works.");
        await refresh(signal);
      } catch (error) {
        if (!signal.aborted) setPending(undefined);
        throw new Error(`${passkeyError(error)} Setup may be incomplete; check enrolled passkeys before retrying. A credential may remain in your password manager.`, { cause: error });
      }
    });
  }
  function unlock() {
    return run(async (signal) => {
      const start = await request<AssertionRequest>({ action: "begin-unlock", credentialId: selected }, signal);
      const assertion = await authenticateVaultPasskey(start.options, start.salt, signal);
      await request({ action: "finish-unlock", ceremonyId: start.ceremonyId, ...assertion }, signal);
      await onUnlocked();
    });
  }
  function remove(credential: SavedPasskey) {
    return run(async (signal) => {
      await request({ action: "remove", credentialId: credential.id }, signal);
      await refresh(signal);
      setMessage(`Removed ${credential.label} from this Vault. Its password-manager entry is separate. Open sessions retain their normal expiry.`);
    });
  }
  function cancelSetup() {
    operation.current?.abort();
    setPending(undefined);
    setBusy(false);
    setMessage("Setup cancelled. Check enrolled passkeys before retrying if the final request had already been sent. Your recovery passphrase remains available.");
  }
  return { credentials, selected, setSelected, address, busy, message, enrolled, setEnrolled, pending,
    enroll, finish, unlock, remove, cancelSetup };
}
