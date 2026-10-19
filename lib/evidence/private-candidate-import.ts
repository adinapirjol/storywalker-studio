import { createHash } from "node:crypto";
import { z } from "zod";
import { privateAuthorReviewDocumentSchema } from "./private-author-review";
import type { VaultRecord } from "@/lib/vault/private-vault";

const bundleSchema = z.object({
  deltaId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/u),
  document: privateAuthorReviewDocumentSchema.strict(),
  manifest: z.object({
    deltaId: z.string(), privacy: z.literal("private"), canonical: z.literal(false),
    source: z.object({ sha256: z.string().regex(/^[a-f0-9]{64}$/u) }).passthrough(),
  }).passthrough(),
  sourceText: z.string().min(1).max(250_000),
}).strict();

/** Preserve a selected candidate source; never accept its interpretations or links. */
export function preparePrivateCandidateImport(input: unknown, importedAt = new Date().toISOString()) {
  if (Buffer.byteLength(JSON.stringify(input) ?? "") > 1_000_000) throw new Error("Candidate bundle exceeds 1 MB.");
  const bundle = bundleSchema.parse(input);
  const candidates = bundle.document.candidates;
  if (!candidates.length || candidates.length > 100 || new Set(candidates.map(c => c.id)).size !== candidates.length) throw new Error("Invalid candidate count or duplicate IDs.");
  if (bundle.deltaId !== bundle.manifest.deltaId || createHash("sha256").update(bundle.sourceText).digest("hex") !== bundle.manifest.source.sha256) throw new Error("Candidate provenance mismatch.");
  if (candidates.some(c => c.proposals.some(p => p.status !== "pending" || p.audit.length))) throw new Error("Only pending interpretations may be imported.");
  const bundleHash = createHash("sha256").update(JSON.stringify(bundle)).digest("hex");
  const snapshotId = `candidate-bundle:${bundle.deltaId}:${bundleHash}`;
  const common = { source: "private-candidate-bundle", privacy: "private", sensitivity: "restricted", canonical: false, reviewStatus: "pending", publicationStatus: "non-publishable", consent: "explicit-selected-local-candidate-import", importedAt, bundleHash };
  const snapshot: VaultRecord = {
    id: snapshotId, kind: "import", capturedAt: importedAt,
    payload: { ...common, title: bundle.deltaId, summary: { retained: candidates.length }, bundle },
  };
  const records: VaultRecord[] = candidates.map(candidate => ({
    id: `${snapshotId}:candidate:${createHash("sha256").update(candidate.id).digest("hex")}`,
    kind: "capture", capturedAt: importedAt,
    payload: { ...common, title: candidate.id, sourceRecordId: snapshotId, sourceEntityId: candidate.id, status: "uncertain", candidate },
  }));
  return { records: [snapshot, ...records], snapshotId, bundleHash, candidates: candidates.length };
}

/** A retry must not overwrite review decisions already saved on an imported record. */
export function missingCandidateRecords(records: VaultRecord[], existingIds: ReadonlySet<string>) {
  return records.filter(record => !existingIds.has(record.id));
}
