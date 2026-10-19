import { randomUUID } from "node:crypto";
import { putVaultRecords, readVaultRecord, type OpenVault } from "@/lib/vault/private-vault";
import { researchPayload, researchSessionSchema, type ResearchSession } from "./research-session";

/** Reuse the Vault's stable-record persistence. A retry never overwrites a saved reading. */
export function saveResearchSnapshot(vault: OpenVault, input: ResearchSession, snapshotId: string = randomUUID()) {
  const session = researchSessionSchema.parse(input);
  const id = `research-session:${snapshotId}`;
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
