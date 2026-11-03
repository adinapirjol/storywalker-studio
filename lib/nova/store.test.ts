import { expect, it, vi } from "vitest";
import { mkdtempSync, symlinkSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

it("persists an observation-driven proposal and keeps the response if inference is paused", async () => {
  const root = process.cwd(), dir = mkdtempSync(path.join(tmpdir(), "hyperloop-observation-test-"));
  symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"));
  const cwd = vi.spyOn(process, "cwd").mockReturnValue(dir);
  try {
    vi.resetModules();
    const api = await import("@/lib/vault/private-vault");
    const loop = await import("./store");
    const { saveResearchSnapshot } = await import("@/lib/research/research-persistence");
    const { connectionEditorial } = await import("./editorial");
    await api.initialiseVault("Fictional-only credential");
    let vault = await api.openVault("Fictional-only credential");
    const at = "2026-01-01T00:00:00.000Z";
    api.putVaultRecords(vault, ["a", "b"].map(id => ({ id: `capture:${id}`, kind: "capture" as const, capturedAt: at, payload: { title: `Fictional ${id}`, when: "2026-01-01", evidenceStatus: "author-stated" } })));
    let view = loop.executeLoop(vault, { action: "configure", expectedRevision: 0, sourceIds: ["capture:a", "capture:b"], consent: true, analyze: true }, at);
    const original = view.state.hypotheses[0];
    const saved = saveResearchSnapshot(vault, connectionEditorial(original, "A fictional doorway, not an arrival.", "", at), "fictional-observation");
    const command = { action: "reconsider-reading" as const, expectedRevision: view.state.revision, hypothesisId: original.id, readingId: saved.id, consent: true as const };
    view = loop.executeLoop(vault, command, at);
    expect(view.state.hypotheses[1]).toMatchObject({ status: "proposed", readingId: saved.id, alternativeTo: original.id });
    expect(view.state.hypotheses[0]).toEqual(original);
    api.closeVault(vault);
    vault = await api.openVault("Fictional-only credential");
    view = loop.loopView(vault);
    expect(view.state.hypotheses[1].modelVersion).toBe("local-reflection-v1");
    expect(loop.executeLoop(vault, { ...command, expectedRevision: view.state.revision }, at).state.hypotheses).toHaveLength(2);
    view = loop.executeLoop(vault, { action: "pause", expectedRevision: view.state.revision, paused: true }, at);
    const second = saveResearchSnapshot(vault, connectionEditorial(original, "Another fictional observation.", "", at), "fictional-paused-response");
    expect(() => loop.executeLoop(vault, { ...command, readingId: second.id, expectedRevision: view.state.revision }, at)).toThrow("Resume");
    expect(api.readVaultRecord(vault, second.id)).toBeDefined();
    expect(loop.loopView(vault).state.hypotheses).toHaveLength(2);
    api.closeVault(vault);
  } finally { cwd.mockRestore(); rmSync(dir, { recursive: true, force: true }); }
});

it("round-trips encrypted decisions, isolates retrieval, rejects stale snapshots, propagates deletion and recovers interrupted writes", async () => {
  const root = process.cwd(), dir = mkdtempSync(path.join(tmpdir(), "nova-fictional-test-"));
  symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"));
  const cwd = vi.spyOn(process, "cwd").mockReturnValue(dir);
  try {
    vi.resetModules();
    const api = await import("@/lib/vault/private-vault");
    const loop = await import("./store");
    await api.initialiseVault("Fictional test credential only");
    let vault = await api.openVault("Fictional test credential only");
    const records = ["a", "b", "c"].map((id, i) => ({ id: `capture:${id}`, kind: "capture" as const, capturedAt: "2026-01-01T00:00:00Z", payload: { title: `Fictional ${id}`, when: "2026-01-01", evidenceStatus: "author-stated", evidence: `Fictional evidence ${i}` } }));
    api.putVaultRecords(vault, records);
    const picker = loop.loopView(vault);
    expect(picker.inventory.map(s => s.title)).toEqual(["Fictional a", "Fictional b", "Fictional c"]);
    expect(picker.state.sourceIds).toEqual([]);
    expect(picker.evidence).toEqual([]);
    expect(api.readVaultRecord(vault, "nova:loop:v1")).toBeUndefined();
    let view = loop.executeLoop(vault, { action: "configure", expectedRevision: 0, sourceIds: records.map(r => r.id), consent: true });
    view = loop.executeLoop(vault, { action: "analyze", expectedRevision: view.state.revision });
    expect(view.state.hypotheses).toHaveLength(3);
    const originalId = view.state.hypotheses[0].id;
    view = loop.executeLoop(vault, { action: "modify", expectedRevision: view.state.revision, hypothesisId: originalId, relationship: "author-association", interpretation: "PRIVATE-FIXTURE-CANARY", evidenceIds: ["capture:a", "capture:b"] });
    expect(api.readVaultRecords(vault).some(r => r.id.startsWith("nova:"))).toBe(false);
    expect(api.readVaultRecord(vault, "capture:a")).toEqual(records[0]);
    api.closeVault(vault);
    const file = path.join(dir, "private-data/vault/storywalker-vault.sqlite");
    expect(readFileSync(file).includes(Buffer.from("PRIVATE-FIXTURE-CANARY"))).toBe(false);
    // An orphan from an interrupted pre-rename write must never become the live DB.
    writeFileSync(`${file}.write-fictional-orphan`, "incomplete");
    vault = await api.openVault("Fictional test credential only");
    expect(loop.loopView(vault).state.hypotheses.at(-1)?.supersedes).toBe(originalId);
    const beforeInterrupted = loop.loopView(vault).state.revision;
    let checks = 0;
    api.setVaultAccessGuard(vault, () => { if (++checks === 2) throw new Error("Fictional interruption before atomic rename"); });
    expect(() => loop.executeLoop(vault, { action: "pause", expectedRevision: beforeInterrupted, paused: true })).toThrow("Fictional interruption");
    api.closeVault(vault);
    vault = await api.openVault("Fictional test credential only");
    expect(loop.loopView(vault).state.revision).toBe(beforeInterrupted);
    expect(loop.loopView(vault).state.paused).toBe(false);
    const stale = await api.openVault("Fictional test credential only");
    view = loop.executeLoop(vault, { action: "pause", expectedRevision: view.state.revision, paused: true });
    expect(() => loop.executeLoop(stale, { action: "pause", expectedRevision: view.state.revision - 1, paused: false })).toThrow();
    api.closeVault(stale); api.closeVault(vault);
    vault = await api.openVault("Fictional test credential only");
    api.removeVaultRecords(vault, ["capture:a"]);
    view = loop.loopView(vault);
    expect(view.state.hypotheses.filter(h => h.refs.some(r => r.id === "capture:a")).every(h => ["invalidated", "superseded"].includes(h.status))).toBe(true);
    view = loop.executeLoop(vault, { action: "delete-derived", expectedRevision: view.state.revision });
    expect(view.state.hypotheses).toEqual([]); expect(view.state.sourceIds).toEqual([]);
    expect(api.readVaultRecord(vault, "capture:b")).toEqual(records[1]);
    api.closeVault(vault); expect(existsSync(file)).toBe(true);
  } finally { cwd.mockRestore(); rmSync(dir, { recursive: true, force: true }); }
});
