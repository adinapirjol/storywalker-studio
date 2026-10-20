import type { VaultRecord } from "./private-vault";

/** Historical copies are retained for recovery, never treated as fresh evidence. */
export function isArchivedEvidence(record: Pick<VaultRecord, "id">) {
  return record.id.startsWith("xr:spatial-draft:before-") || record.id.startsWith("xr:spatial-draft:archive:") || record.id.startsWith("lastfm:before-") || record.id.startsWith("arena:private-rehearsal:v1:archive:");
}

/** Shared by Atlas, search, evidence packs (including Director) and local indexes. */
export function isRetrievableRecord(record: Pick<VaultRecord, "id" | "kind">) {
  return !record.id.startsWith("automation:") && !record.id.startsWith("native:") && !record.id.startsWith("health:stage:") && !record.id.startsWith("import:google-timeline:v1:chunk:") && !isArchivedEvidence(record) && !record.id.startsWith("xr:spatial-draft:") && !["recovery-document", "retrieval-index", "atlas", "scenario-studio", "public-draft"].includes(record.kind);
}
