"use client";
import { useEffect, useRef, useState } from "react";
import { ArchiveRecovery } from "./archive-recovery";
import { vaultFetch } from "@/lib/vault/vault-access";
import type { RehearsalCommand, SyntheticArchive } from "@/lib/health/synthetic-archive";

export function ArchiveRehearsal({ onLoad }: { onLoad: (archive: SyntheticArchive | null) => void }) {
  const [archive, setArchive] = useState<SyntheticArchive | null>(null);
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Archive has not been opened.");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => { pending.current?.abort(); pending.current = null; }, []);
  async function run(command?: RehearsalCommand) {
    if (pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    setBusy(true);
    try {
      const response = await vaultFetch("/api/health-rehearsal", {
        method: command ? "POST" : "GET", cache: "no-store", signal: controller.signal,
        ...(command ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) } : {}),
      });
      if (!response.ok) throw new Error("ARCHIVE_ACTION_FAILED");
      const result = await response.json() as { archive: SyntheticArchive | null };
      controller.signal.throwIfAborted();
      setArchive(result.archive); setLoaded(true); onLoad(result.archive);
      setMessage(command ? "Saved archive read back into the synthetic timeline." : "Encrypted archive loaded. Only the fixed invented observations are stored.");
    } catch {
      if (controller.signal.aborted) return;
      setArchive(null); setLoaded(false); onLoad(null);
      setMessage("Archive unavailable or action outcome uncertain. Reload before another action; nothing is retried automatically. If the Vault key changed, use a previously created recovery snapshot and its code below.");
    } finally {
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  }
  const expectedRevision = archive?.revision ?? null;
  function invalidateArchive() {
    setArchive(null); setLoaded(false); onLoad(null);
    setMessage("Archive view cleared. Reload to inspect the committed observations.");
  }
  return <section aria-labelledby="archive-rehearsal-title">
    <h2 id="archive-rehearsal-title">Encrypted storage rehearsal</h2>
    <p>Unlock through the existing Vault dialog to load, save or delete a fixed invented fixture in a separate local encrypted archive. This does not save anything typed into the diary or report. Real collection remains disabled.</p>
    <p>Loading replaces this tab’s timeline and clears drafts and report previews. Deletion removes the selected stored observations and reloads the timeline; backups and downloaded reports are separate copies.</p>
    <button disabled={busy} onClick={() => void run()}>Load / reload synthetic archive</button>
    <button disabled={busy || !loaded || !!archive?.observations.length} onClick={() => void run({ action: "seed", expectedRevision })}>Save fixed synthetic sleep & diary fixture</button>
    <button disabled={busy || !loaded || !archive?.observations.some(o => o.kind === "sleep")} onClick={() => void run({ action: "delete-sleep-batch", expectedRevision })}>Delete stored synthetic sleep batch</button>
    <button disabled={busy || !loaded || !archive?.observations.length} onClick={() => void run({ action: "delete-all", expectedRevision })}>Delete all stored synthetic observations</button>
    <p role="status">{busy ? "Working with the encrypted rehearsal archive…" : message}</p>
    {archive && <p>{archive.observations.length} stored invented observations. Reload after a restart to verify persistence.</p>}
    {archive?.observations.filter(o => o.kind === "diary").map(o => <p key={o.id}>
      Invented diary {o.kind === "diary" ? o.value.day : ""}{" "}
      <button disabled={busy} onClick={() => void run({ action: "delete-observation", id: o.id, expectedRevision })}>Delete stored {o.id}</button>
    </p>)}
    <ArchiveRecovery disabled={busy} onChanged={invalidateArchive} />
  </section>;
}
