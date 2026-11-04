import type { VaultRecord } from "./private-vault";

/** Historical copies are retained for recovery, never treated as fresh evidence. */
export function isArchivedEvidence(record: Pick<VaultRecord, "id">) {
  return record.id.startsWith("xr:spatial-draft:before-") || record.id.startsWith("xr:spatial-draft:archive:") || record.id.startsWith("lastfm:before-") || record.id.startsWith("arena:private-rehearsal:v1:archive:");
}

function isNovaEditorialSnapshot(record: Pick<VaultRecord, "id" | "kind"> & Partial<Pick<VaultRecord, "payload">>) {
  if (record.kind !== "capture" || !record.id.startsWith("research-session:")) return false;
  const payload = record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
    ? record.payload as Record<string, unknown>
    : undefined;
  if (!payload) return false;
  if (payload.title === "CTM · Hypothesis Hyperloop · Author observation") return true;
  if (typeof payload.sourceContext !== "string") return false;
  try {
    const context = JSON.parse(payload.sourceContext) as { origin?: unknown };
    return context.origin === "nova-hypothesis-loop";
  } catch {
    return false;
  }
}

/** Shared by Atlas, search, evidence packs (including Director) and local indexes. */
export function isRetrievableRecord(record: Pick<VaultRecord, "id" | "kind"> & Partial<Pick<VaultRecord, "payload">>) {
  return !record.id.startsWith("nova:") && !record.id.startsWith("automation:") && !record.id.startsWith("native:") && !record.id.startsWith("health:stage:") && !record.id.startsWith("import:google-timeline:v1:chunk:") && !isArchivedEvidence(record) && !isNovaEditorialSnapshot(record) && !record.id.startsWith("xr:spatial-draft:") && !["recovery-document", "retrieval-index", "atlas", "scenario-studio", "public-draft"].includes(record.kind);
}
