"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { vaultFetch } from "@/lib/vault/vault-access";

export function PrivateCandidateImport() {
  const [file, setFile] = useState<File>();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const owner = useRef<AbortController | null>(null);
  useEffect(() => () => owner.current?.abort(), []);
  async function importBundle(event: FormEvent) {
    event.preventDefault();
    if (!file || !consent || busy) return;
    const controller = new AbortController();
    owner.current = controller;
    setBusy(true);
    setMessage("");
    try {
      if (file.size > 1_000_000) throw new Error("Choose a candidate bundle smaller than 1 MB.");
      const text = await file.text();
      controller.signal.throwIfAborted();
      const candidateBundle = JSON.parse(text) as unknown;
      const response = await vaultFetch("/api/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "import-candidate-bundle", consent: true, candidateBundle }), signal: controller.signal });
      const result = await response.json() as { candidateImport?: { candidates: number; created: number; verified: boolean; atlasVisible: boolean }; error?: string };
      if (!response.ok || !result.candidateImport) throw new Error(result.error ?? "Import could not be verified. Check Vault state before retrying.");
      const verification = await vaultFetch("/api/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify-candidate-bundle", consent: true, candidateBundle }), signal: controller.signal });
      const checked = await verification.json() as typeof result;
      if (!verification.ok || !checked.candidateImport?.verified || !checked.candidateImport.atlasVisible) throw new Error("Fresh Vault verification failed.");
      const saved = result.candidateImport;
      setMessage(`${saved.candidates} candidates verified in the encrypted Vault; ${saved.created} new records. Atlas source ${saved.atlasVisible ? "verified" : "not verified"}. Everything remains private, pending review and non-canonical. Image references remain unverified.`);
    } catch {
      if (!controller.signal.aborted) setMessage("Import was not confirmed. Check your Vault unlock and the selected bundle. If the request was interrupted, inspect Atlas before retrying.");
    } finally {
      if (owner.current === controller) owner.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return <section className="notebook-card vault-card">
    <h2>Import a private candidate bundle</h2>
    <p>Keep reported evidence and proposed interpretations separate. Importing does not accept any candidate or publish anything.</p>
    <form onSubmit={importBundle} className="vault-form">
      <label>Candidate bundle JSON<input type="file" accept="application/json,.json" disabled={busy} onChange={event => { setFile(event.target.files?.[0]); setConsent(false); setMessage(""); }} required /></label>
      <label className="consent-row"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />Encrypt this selected bundle locally, keeping every candidate private and pending review.</label>
      <button type="submit" className="primary-button" disabled={busy || !file || !consent}>{busy ? "Encrypting and verifying…" : "Import private candidates"}</button>
    </form>
    {message && <p role="status">{message}</p>}
  </section>;
}
