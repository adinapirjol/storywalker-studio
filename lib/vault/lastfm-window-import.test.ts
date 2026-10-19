import { afterEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { closeVault, importLastFmHistory, openContextSandbox, putVaultRecords, readVaultRecord, readVaultRecords, type OpenVault } from "./private-vault";

const namespace = `context-sandbox-lastfm-test-${randomUUID()}`;
let vault: OpenVault | undefined;
afterEach(() => {
  if (vault) closeVault(vault);
  rmSync(path.join(process.cwd(), "private-data", namespace), { recursive: true, force: true });
});

it("preserves encrypted history and the XR draft while deduplicating repeated windows", async () => {
  vault = await openContextSandbox(namespace);
  const old = { playedAt: "2026-08-01T00:00:00.000Z", trackName: "Fictional old track", artistName: "Example", importerProvenance: "fixture" };
  const document = { schemaVersion: 1, source: "lastfm-scrobbles", importedAt: old.playedAt, records: [old] };
  putVaultRecords(vault, [
    { id: "import:lastfm-history:v1", kind: "import", capturedAt: old.playedAt, payload: { document, deltaWindows: [{ to: old.playedAt }] } },
    { id: "xr:spatial-draft:v1", kind: "reference", capturedAt: old.playedAt, payload: { fictional: true, unchanged: true } },
  ]);
  const row = { name: "Fictional new track", artist: { "#text": "Example" }, date: { uts: String(Date.parse("2026-10-01T00:00:00Z") / 1000) } };
  const raw = { recenttracks: { track: [row, row, { ...row, name: "Live only", "@attr": { nowplaying: "true" } }] } };
  expect(importLastFmHistory(vault, raw)).toMatchObject({ previousCount: 1, added: 1, retained: 2 });
  expect(importLastFmHistory(vault, raw)).toMatchObject({ previousCount: 2, added: 0, retained: 2 });
  expect(readVaultRecords(vault).filter(r => r.id.startsWith("lastfm:before-window-import:"))).toHaveLength(1);
  expect(readVaultRecord(vault, "xr:spatial-draft:v1")?.payload).toEqual({ fictional: true, unchanged: true });
  expect(readFileSync(vault.storagePath!).includes(Buffer.from("Fictional new track"))).toBe(false);
  closeVault(vault); vault = await openContextSandbox(namespace);
  expect(readVaultRecord(vault, "import:lastfm-history:v1")?.payload).toMatchObject({ document: { records: [old, expect.objectContaining({ trackName: row.name })] }, deltaWindows: [{ to: old.playedAt }] });
});
