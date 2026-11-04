import { assertVaultSnapshotCurrent, replaceVaultRecords, putVaultRecords, readVaultRecord, vaultRecordHeaders, type OpenVault } from "@/lib/vault/private-vault";
import { isAtlasSource } from "@/lib/studio/private-atlas";
import { initialState, stateSchema, type Command, type LoopView, type Evidence } from "./contracts";
import { sourceLabel } from "./source-label";
import { normalize, supportedSource, sourceRevoked } from "./normalize";
import { LoopConflict, LoopInputError, reconcile, transition } from "./engine";
import { reconsiderReading } from "./reconsider";
const loopSupported = (r: Parameters<typeof supportedSource>[0]) => supportedSource(r) && r.id !== "import:spotify-history:v1";
const RECORD = "nova:loop:v1";
const MODEL_OUTCOME_TIMEOUT_MS = 120_000;
const limitations = [
  "Initial cues are local and deterministic. Richer model interpretation requires a saved observation, an exact preview and separate one-request consent. Spatial proximity, verified entities and automatic contradiction detection remain unsupported.",
  "Calendar requires individual-event authorization; bulk calendar, HEALTH and native records are unavailable to this adapter.",
  "No background worker is running. Analyze new evidence explicitly; at most 12 proposals per analysis, 24 pending, 1,000 historical proposals.",
  "Absent dates are unknown, not evidence of inactivity. Listening timestamps are UTC; date-only captures may have unresolved timezone differences.",
  "Contradicting evidence has not been automatically evaluated. Empty contradiction lists do not mean there is no contradiction.",
];
function saved(vault: OpenVault) {
  const record = readVaultRecord(vault, RECORD);
  const state = record ? stateSchema.parse(record.payload) : initialState();
  // Last.fm is the listening source; retain Spotify history in the Vault, outside this loop.
  state.sourceIds = state.sourceIds.filter(id => id !== "import:spotify-history:v1");
  return state;
}
export function writeLoopState(vault: OpenVault, state: LoopView["state"], now = new Date().toISOString()) {
  putVaultRecords(vault, [{ id: RECORD, kind: "nova-loop", capturedAt: now, payload: stateSchema.parse(state) }]);
}
function evidenceFor(vault: OpenVault, ids: string[]) {
  const evidence: Evidence[] = [], gaps: string[] = [];
  for (const id of ids) {
    if (id === "import:spotify-history:v1") continue;
    const source = readVaultRecord(vault, id);
    if (!source) { gaps.push("A selected source was deleted or is unavailable; its active interpretations are invalidated."); continue; }
    const result = normalize(source);
    evidence.push(...result.evidence); gaps.push(...result.gaps);
  }
  return { evidence, gaps };
}
export function loopView(vault: OpenVault, message = "Inspect selected evidence; analyze explicitly to consider new connections."): LoopView {
  const state = saved(vault);
  // A provider may have received the request even if the session expires before
  // its result can be saved. Surface that ambiguity instead of leaving "pending"
  // forever or implying that the request failed.
  const now = Date.now();
  state.modelAttempts = state.modelAttempts.map(attempt => {
    if (attempt.status !== "pending" || now - Date.parse(attempt.at) < MODEL_OUTCOME_TIMEOUT_MS) return attempt;
    return { ...attempt, status: "outcome-unknown", summary: "The session ended before the result was saved. The provider may have received this request; inspect before making a new preview." };
  });
  const { evidence, gaps } = evidenceFor(vault, state.enabled ? state.sourceIds : []);
  const inventory = vaultRecordHeaders(vault).filter(r => isAtlasSource(r) && !r.id.startsWith("nova:")).slice(0, 500).map(r => {
    // The guarded source picker may display a capture's title/date before inference
    // consent. Do not decrypt large imports or unsupported records for their labels.
    const capture = loopSupported(r) && (r.kind === "capture" || r.id.startsWith("import:spotify-playlist:")) ? readVaultRecord(vault, r.id) : undefined;
    const revoked = capture ? sourceRevoked(capture) : false;
    const supported = loopSupported(r) && !revoked && ((!r.id.startsWith("research-session:") && !r.id.startsWith("import:spotify-playlist:")) || !!(capture && normalize(capture).evidence.length));
    const label = revoked ? { title: "Unavailable saved note", description: "Source access was revoked or the record was rejected." } : sourceLabel(r, capture);
    return { id: r.id, kind: r.kind, ...label, supported, selected: state.sourceIds.includes(r.id) };
  });
  assertVaultSnapshotCurrent(vault);
  return { state: reconcile(state, evidence), evidence, inventory, gaps: [...gaps, ...limitations, "Inventory shows at most 500 source headers; each selected import shows at most 160 recent unique observations."], message };
}
export function executeLoop(vault: OpenVault, command: Command, now = new Date().toISOString()): LoopView {
  const state = saved(vault);
  if (command.expectedRevision !== state.revision) throw new LoopConflict("Reload the latest review before saving.");
  if (command.action === "delete-derived") {
    // Replace the one encrypted record, preserving a monotonic revision against stale clients.
    // Sources are never deleted. All decisions/boundaries/metrics are erased explicitly.
    const clean = { ...initialState(), revision: state.revision + 1 };
    replaceVaultRecords(vault, [{ id: RECORD, kind: "nova-loop", capturedAt: now, payload: clean }], [RECORD]);
    return loopView(vault, "All Nova derived data and boundaries erased; processing disabled. Original sources unchanged.");
  }
  const selected = command.action === "configure" ? command.sourceIds : state.sourceIds;
  if (command.action === "configure") {
    const headers = vaultRecordHeaders(vault);
    if (selected.some(id => !headers.some(h => h.id === id && loopSupported(h)))) throw new LoopInputError("Selection contains an unavailable or unsupported source.");
  }
  const { evidence } = evidenceFor(vault, selected);
  if ((command.action === "propose-reading" || command.action === "reconsider-reading")) {
    const record = readVaultRecord(vault, command.readingId);
    if (!record) throw new LoopInputError("The saved reading is unavailable.");
    const next = reconsiderReading(state, evidence, record, command, now);
    putVaultRecords(vault, [{ id: RECORD, kind: "nova-loop", capturedAt: now, payload: stateSchema.parse(next) }]);
    return loopView(vault, "New proposal saved for review. The original connection and your Author response remain in history.");
  }
  const result = transition(state, evidence, command, now);
  putVaultRecords(vault, [{ id: RECORD, kind: "nova-loop", capturedAt: now, payload: stateSchema.parse(result.state) }]);
  return loopView(vault, result.message);
}
