"use client";
import { useEffect, useRef, useState } from "react";
import { vaultFetch } from "@/lib/vault/vault-access";
import type { RecoveryCommand, RecoveryPreview, RecoveryStatus } from "@/lib/health/synthetic-archive";

export function ArchiveRecovery({ disabled, onChanged }: { disabled: boolean; onChanged: () => void }) {
  const [status, setStatus] = useState<RecoveryStatus | null>(null);
  const [preview, setPreview] = useState<RecoveryPreview | null>(null);
  const [code, setCode] = useState("");
  const [saved, setSaved] = useState(false), [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("Recovery storage has not been inspected.");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => { pending.current?.abort(); pending.current = null; }, []);
  const validCode = /^[a-f0-9]{64}$/.test(code);
  const blocked = busy || disabled;

  async function run(command?: RecoveryCommand) {
    if (pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setPreview(null); setConfirmed(false);
    try {
      const response = await vaultFetch("/api/health-rehearsal?recovery=1", {
        method: command ? "POST" : "GET", cache: "no-store", signal: controller.signal,
        ...(command ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) } : {}),
      });
      if (!response.ok) throw new Error("RECOVERY_UNAVAILABLE");
      const result = await response.json() as { recovery: RecoveryStatus; preview?: RecoveryPreview };
      controller.signal.throwIfAborted();
      setStatus(result.recovery);
      if (command?.action === "preview-restore") {
        setPreview(result.preview ?? null);
        setMessage("Recovery code authenticated the snapshot. Inspect the replacement below.");
      } else if (command) {
        onChanged();
        setMessage(command.action === "create-backup"
          ? "Encrypted recovery snapshot saved and authenticated from disk. Keep its code separately; later edits are not backed up automatically."
          : command.action === "restore-backup" ? "Snapshot restored under the active Vault key. Reload the archive to inspect it."
          : "Local recovery snapshot deleted. Other copies and their codes are unaffected.");
      } else setMessage("Storage inspected. This does not establish that either file can be decrypted.");
    } catch {
      if (controller.signal.aborted) return;
      setStatus(null); onChanged();
      setMessage("Recovery failed or its outcome is uncertain. Keep the code, inspect storage again, then preview before restoring. Nothing is retried automatically.");
    } finally {
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  }
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setMessage("Code copied. Your clipboard is now a separate sensitive copy.");
    } catch {
      setMessage("Clipboard unavailable. Select the recovery code and copy it manually.");
    }
  }
  function generateCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    setCode(Array.from(bytes, b => b.toString(16).padStart(2, "0")).join(""));
    bytes.fill(0); setSaved(false); setPreview(null); setConfirmed(false);
  }
  const expected = { expectedCurrentToken: status?.currentToken ?? null, expectedBackupToken: status?.backupToken ?? null };
  return <fieldset disabled={blocked}>
    <legend>Synthetic recovery snapshot</legend>
    <p>This local encrypted copy has an independent recovery code. It protects only the observations present when created. It cannot unlock the personal Vault and does not protect against loss of this disk. Keep the code separately; it is not saved by Storywalker.</p>
    <button onClick={() => void run()}>Inspect recovery storage</button>
    {status && <p>Current archive: {status.currentToken ? "present" : "absent"}. Recovery snapshot: {status.backupToken ? "present" : "absent"}.</p>}
    <button disabled={!status || !!status.backupToken} onClick={generateCode}>Generate new recovery code</button>
    <label>Recovery code (64 hexadecimal characters)
      <input type="password" autoComplete="off" spellCheck={false} value={code} onChange={e => { setCode(e.target.value.trim()); setSaved(false); setPreview(null); setConfirmed(false); }} />
    </label>
    <button disabled={!validCode} onClick={() => void copyCode()}>Copy recovery code</button>
    <button onClick={() => { setCode(""); setSaved(false); setPreview(null); setConfirmed(false); }}>Clear code from this form</button>
    <label><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} />I saved this code separately and understand later edits require another snapshot.</label>
    <button disabled={!status?.currentToken || !!status.backupToken || !validCode || !saved} onClick={() => void run({ action: "create-backup", ...expected, recoveryCode: code })}>Create encrypted recovery snapshot</button>
    <button disabled={!status?.backupToken || !validCode} onClick={() => void run({ action: "preview-restore", ...expected, recoveryCode: code })}>Preview recovery snapshot</button>
    {preview && <>
      <p>This snapshot contains {preview.observations} invented observations. Restoring replaces the current archive, loses changes made since the snapshot, and may bring back deleted records. A fresh revision prevents stale edits.</p>
      <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Replace the current synthetic archive with this snapshot.</label>
      <button disabled={!confirmed} onClick={() => void run({ action: "restore-backup", ...expected, recoveryCode: code, confirmReplace: true })}>Restore selected snapshot</button>
    </>}
    <details><summary>Delete the local recovery copy</summary>
      <p>This leaves the current archive intact and removes this recovery path. Copies in filesystem backups or exports survive.</p>
      <button disabled={!status?.backupToken} onClick={() => void run({ action: "delete-backup", ...expected, confirmDelete: true })}>Delete local recovery snapshot</button>
    </details>
    <p role="status">{busy ? "Working with the encrypted recovery snapshot…" : message}</p>
  </fieldset>;
}
