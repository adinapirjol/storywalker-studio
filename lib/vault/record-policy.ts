import type { VaultRecord } from "./private-vault";

/** Historical copies are retained for recovery, never treated as fresh evidence. */
export function isArchivedEvidence(record: Pick<VaultRecord, "id">) {
  return record.id.startsWith("xr:spatial-draft:before-") || record.id.startsWith("xr:spatial-draft:archive:") || record.id.startsWith("lastfm:before-") || record.id.startsWith("arena:private-rehearsal:v1:archive:");
}

export function isNovaEditorialSnapshot(record: Pick<VaultRecord, "id" | "kind"> & Partial<Pick<VaultRecord, "payload">>) {
  if (record.kind !== "capture" || !record.id.startsWith("research-session:")) return false;
  // New Nova records identify themselves in the header so header-only readers
  // can exclude them without decrypting their contents.
  if (record.id.startsWith("research-session:nova:")) return true;
  const payload = record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
    ? record.payload as Record<string, unknown>
    : undefined;
  // A legacy research-session header cannot be classified without its payload.
  // Treat that incomplete view conservatively; callers with the full record can
  // still distinguish unrelated research snapshots from Nova editorials.
  if (!payload) return true;
  if (payload.title === "CTM · Hypothesis Hyperloop · Author observation") return true;
  if (typeof payload.sourceContext !== "string") return false;
  try {
    const context = JSON.parse(payload.sourceContext) as Record<string, unknown>;
    return context.origin === "nova-hypothesis-loop" ||
      Object.hasOwn(context, "proposedInterpretation") || Object.hasOwn(context, "observedCue");
  } catch {
    return false;
  }
}

/** Shared by Atlas, search, evidence packs (including Director) and local indexes. */
export function isRetrievableRecord(record: Pick<VaultRecord, "id" | "kind"> & Partial<Pick<VaultRecord, "payload">>) {
  return !record.id.startsWith("nova:") && !record.id.startsWith("automation:") && !record.id.startsWith("native:") && !record.id.startsWith("health:stage:") && !record.id.startsWith("import:google-timeline:v1:chunk:") && !isArchivedEvidence(record) && !isNovaEditorialSnapshot(record) && !record.id.startsWith("xr:spatial-draft:") && !["recovery-document", "retrieval-index", "atlas", "scenario-studio", "public-draft"].includes(record.kind);
}
