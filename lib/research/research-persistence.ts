import { randomUUID } from "node:crypto";
import { putVaultRecords, readVaultRecord, vaultRecordHeaders, type OpenVault, type VaultRecord } from "@/lib/vault/private-vault";
import { isNovaEditorialSnapshot } from "@/lib/vault/record-policy";
import { researchPayload, researchSessionSchema, type ResearchSession } from "./research-session";

/** Reuse the Vault's stable-record persistence. A retry never overwrites a saved reading. */
export function saveResearchSnapshot(vault: OpenVault, input: ResearchSession, snapshotId: string = randomUUID()) {
  const session = researchSessionSchema.parse(input);
  const isNovaEditorial = isNovaEditorialSnapshot({ id: "research-session:candidate", kind: "capture", payload: session });
  const id = `research-session:${isNovaEditorial ? "nova:" : ""}${snapshotId}`;
  const existing = readVaultRecord(vault, id);
  if (existing) {
    if (JSON.stringify(researchSessionSchema.parse(existing.payload)) !== JSON.stringify(session)) {
      throw new Error("This snapshot identifier already belongs to a different reading. Reload saved sessions before saving again.");
    }
    return { id, savedAt: existing.capturedAt, duplicate: true };
  }
  const savedAt = new Date().toISOString();
  putVaultRecords(vault, [{ id, kind: "capture", capturedAt: savedAt, payload: researchPayload(session, savedAt) }]);
  return { id, savedAt, duplicate: false };
}

/**
 * On explicit deletion of Nova-derived history, preserve Author-authored notes
 * while removing model text copied into legacy Nova snapshot metadata.
 */
export function sanitizedLegacyNovaSnapshots(vault: OpenVault): VaultRecord[] {
  return vaultRecordHeaders(vault)
    .filter(header => header.kind === "capture" && header.id.startsWith("research-session:") && !header.id.startsWith("research-session:nova:"))
    .map(header => readVaultRecord(vault, header.id))
    .filter((record): record is VaultRecord => !!record && isNovaEditorialSnapshot(record))
    .map(record => {
      const payload = researchSessionSchema.parse(record.payload);
      const safeSession = {
        ...payload,
        sourceContext: JSON.stringify({
          origin: "nova-hypothesis-loop",
          boundary: "This Author response is linked to a proposal; it does not approve that proposal or verify listening, attendance, artist identity or intent.",
        }),
      };
      return { ...record, payload: researchPayload(safeSession, record.capturedAt) };
    });
}
