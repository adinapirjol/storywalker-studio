import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { preparePrivateCandidateImport, missingCandidateRecords } from "./private-candidate-import";
import { buildAtlasNow } from "@/lib/studio/private-atlas";

function fixture() {
  const sourceText = "Fictional Aurora Coast candidate source.";
  return { deltaId: "fictional-aurora-candidate", sourceText,
    manifest: { deltaId: "fictional-aurora-candidate", privacy: "private", canonical: false, source: { sha256: createHash("sha256").update(sourceText).digest("hex") } },
    document: { schemaVersion: 1, privacy: "private", reviewStatus: "pending", purpose: "Fictional source intake", candidates: [{ id: "fictional-window", privacy: "private", canonical: false, reviewStatus: "pending", details: [{ field: "observation", value: "Fictional creative technology workshop", knowledge: "author-reported" }], proposals: [{ id: "fictional-reading", label: "possible-interpretation", originalText: "Possible study criterion", status: "pending", audit: [] }] }] } };
}
it("preserves evidence separately from pending interpretations and appears in private Atlas", () => {
  const input = fixture();
  const before = JSON.stringify(input);
  const prepared = preparePrivateCandidateImport(input);
  expect(JSON.stringify(input)).toBe(before);
  expect(prepared.records).toHaveLength(2);
  expect(prepared.records.every(r => ["import", "capture"].includes(r.kind))).toBe(true);
  for (const r of prepared.records) expect(r.payload).toMatchObject({ privacy: "private", canonical: false, reviewStatus: "pending", publicationStatus: "non-publishable" });
  expect(prepared.records[1].payload).toMatchObject({ candidate: input.document.candidates[0] });
  const atlas = buildAtlasNow(prepared.records);
  expect(atlas.imports).toEqual([expect.objectContaining({ id: prepared.snapshotId, retained: 1, label: "Candidate bundle: fictional-aurora-candidate" })]);
  expect(atlas.needsYou.find(n => n.id === "pending-captures")?.sourceRecordIds).toContain(prepared.records[1].id);
});
it("uses stable IDs across retry timestamps and never overwrites prior review decisions", () => {
  const a = preparePrivateCandidateImport(fixture(), "2030-01-01T00:00:00Z");
  const b = preparePrivateCandidateImport(fixture(), "2030-01-02T00:00:00Z");
  expect(a.records.map(r => r.id)).toEqual(b.records.map(r => r.id));
  expect(missingCandidateRecords(b.records, new Set(a.records.map(r => r.id)))).toEqual([]);
  expect(missingCandidateRecords(b.records, new Set([a.snapshotId]))).toEqual([b.records[1]]);
});
it("rejects tampered provenance, accepted interpretations, promoted candidates and duplicate IDs", () => {
  const changes = [
    (x: ReturnType<typeof fixture>) => { x.sourceText += "tampered"; },
    (x: ReturnType<typeof fixture>) => { x.manifest.deltaId = "another"; },
    (x: ReturnType<typeof fixture>) => { x.document.candidates[0].proposals[0].status = "accepted"; },
    (x: ReturnType<typeof fixture>) => { x.document.candidates[0].privacy = "public"; },
    (x: ReturnType<typeof fixture>) => { x.document.candidates[0].canonical = true; },
    (x: ReturnType<typeof fixture>) => { x.document.candidates.push(x.document.candidates[0]); },
    (x: ReturnType<typeof fixture>) => { x.sourceText = "x".repeat(1_000_001); },
  ];
  for (const mutate of changes) { const input = fixture(); mutate(input); expect(() => preparePrivateCandidateImport(input)).toThrow(); }
});

it("persists encrypted candidates and private Atlas, then verifies a fresh disk snapshot", async () => {
  const { randomUUID } = await import("node:crypto");
  const { readFileSync, rmSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { openContextSandbox, closeVault, putVaultRecords, readVaultRecord, refreshVaultDerivedViews, readAtlasNow } = await import("@/lib/vault/private-vault");
  const namespace = `context-sandbox-candidates-${randomUUID()}`;
  const prepared = preparePrivateCandidateImport(fixture());
  let vault = await openContextSandbox(namespace);
  try {
    putVaultRecords(vault, prepared.records);
    refreshVaultDerivedViews(vault);
    const bytes = readFileSync(vault.storagePath!);
    expect(bytes.includes(Buffer.from("Fictional Aurora Coast candidate source."))).toBe(false);
    closeVault(vault);
    vault = await openContextSandbox(namespace);
    for (const record of prepared.records) expect(readVaultRecord(vault, record.id)).toEqual(record);
    expect(readAtlasNow(vault)).toMatchObject({ privacy: "private", imports: [expect.objectContaining({ id: prepared.snapshotId, retained: 1 })] });
  } finally { closeVault(vault); rmSync(join(process.cwd(), "private-data", namespace), { recursive: true, force: true }); }
});
