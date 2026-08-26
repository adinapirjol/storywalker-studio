import type { EvidenceLedger, EpistemicState, PublicContextAdapter, PublicContextRecord } from "@/lib/public-context";

export const LINZ_EXPERIMENT_ID = "public-city-private-echoes-linz-2026";

export const LINZ_PUBLIC_RECORDS: PublicContextRecord[] = [
  { id: "ars-deep-space-cities", sourceId: "ars-39138ddb450c808b8311f9051f5d5332", sourceLabel: "Ars Electronica Festival 2026 programme", title: "Deep Space Cities: Shared Immersive Futures", observedAt: "2026-09-11T10:30:00+02:00", location: { label: "OK Linz, voestalpine OPEN SPACE", precision: "exact" }, fragment: "Festival programme record: a shared-futures session at OK Linz.", licence: "Official programme dataset; terms to be recorded with downloaded release." },
  { id: "ars-flood-zone", sourceId: "ars-flood-the-zone-2026", sourceLabel: "Ars Electronica Festival 2026 programme", title: "Flood the Zone with Courage", observedAt: "2026-09-09T00:00:00+02:00", location: { label: "Hauptplatz Linz", precision: "exact" }, fragment: "Festival programme record: a public space for dialogue, listening and negotiation.", licence: "Official programme dataset; terms to be recorded with downloaded release." },
  { id: "ars-hello-worlds", sourceId: "ars-hello-worlds-2026", sourceLabel: "Ars Electronica Festival 2026 programme", title: "Hello Worlds!", observedAt: "2026-09-01T00:00:00+02:00", location: { label: "Ars Electronica Center", precision: "exact" }, fragment: "Festival programme record: a platform for negotiating possible futures with AI.", licence: "Official programme dataset; terms to be recorded with downloaded release." },
  { id: "linz-ok-quarter", sourceId: "cdc4b373-9fee-4dc4-9aa0-182f028b2fcf", sourceLabel: "City of Linz — Parkscheinautomaten_20240207", title: "Parkscheinautomat 156", location: { label: "Museumstraße 22", precision: "generalised" }, fragment: "Recorded City fragment: parking-meter 156 at Museumstraße 22, zone 180, with NFC-card function. Coordinates were intentionally excluded from this public demo.", licence: "CC BY 4.0; Datenquelle: Stadt Linz - https://data.linz.gv.at" },
  { id: "linz-hauptplatz", sourceId: "171f4e83-73ed-4ab6-b3a8-84648b179b38", sourceLabel: "City of Linz — Parkscheinautomaten_20240207", title: "Parkscheinautomat 32", location: { label: "Untere Donaulände 22", precision: "generalised" }, fragment: "Recorded City fragment: parking-meter 32 at Untere Donaulände 22, zone 180, with NFC-card function. Coordinates were intentionally excluded from this public demo.", licence: "CC BY 4.0; Datenquelle: Stadt Linz - https://data.linz.gv.at" },
  { id: "linz-aec", sourceId: "016de4f3-cfa7-427e-9cb4-9560f031613f", sourceLabel: "City of Linz — Parkscheinautomaten_20240207", title: "Parkscheinautomat 10", location: { label: "Hauptstraße 62", precision: "generalised" }, fragment: "Recorded City fragment: parking-meter 10 at Hauptstraße 62, zone 90, with NFC-card function. Coordinates were intentionally excluded from this public demo.", licence: "CC BY 4.0; Datenquelle: Stadt Linz - https://data.linz.gv.at" },
];

export const linzPublicAdapter: PublicContextAdapter = {
  id: "linz-public-context-fixture",
  async load() { return LINZ_PUBLIC_RECORDS; },
};

export type LinzDecision = "pending" | "accepted" | "revised" | "refused";

export interface LinzProposal {
  id: string;
  location: string;
  eventId: string;
  cityFragmentId: string;
  privateTrace: { label: string; song: string; note: string; isSynthetic: true };
  proposal: string;
  ledger: EvidenceLedger;
}

const proposals: LinzProposal[] = [
  { id: "linz-echo-01", location: "OK Quarter", eventId: "ars-deep-space-cities", cityFragmentId: "linz-ok-quarter", privateTrace: { label: "Private fragment A", song: "Synthetic Spotify URI fixture", note: "A deliberately non-autobiographical time-window fragment.", isSynthetic: true }, proposal: "The shared-futures session and this remembered listening interval may both make the city feel temporarily collective.", ledger: { proposalId: "linz-echo-01", sourceRecords: [{ id: "ars-deep-space-cities", source: "Ars Electronica programme" }, { id: "linz-ok-quarter", source: "City of Linz fixture" }, { id: "synthetic-private-a", source: "Synthetic private fixture" }], timestamps: [{ value: "2026-09-11T10:30:00+02:00", timezone: "Europe/Vienna", certainty: "exact" }, { value: "2026-09-11", timezone: "Europe/Vienna", certainty: "approximate" }], location: { label: "OK Quarter", precision: "generalised" }, relationship: "temporal", certainty: "ambiguous", missingInformation: ["No private coordinate", "No proof that listening caused meaning"], transformationHistory: ["Matched an approved time interval to a programme event", "Kept an interpretive sentence as a proposal"], authorDecision: "inferred" } },
  { id: "linz-echo-02", location: "Hauptplatz", eventId: "ars-flood-zone", cityFragmentId: "linz-hauptplatz", privateTrace: { label: "Private fragment B", song: "Synthetic Spotify URI fixture", note: "A deliberately non-autobiographical walking-memory fragment.", isSynthetic: true }, proposal: "Both records concern public gathering; they do not establish why that song matters to the traveller.", ledger: { proposalId: "linz-echo-02", sourceRecords: [{ id: "ars-flood-zone", source: "Ars Electronica programme" }, { id: "linz-hauptplatz", source: "City of Linz fixture" }, { id: "synthetic-private-b", source: "Synthetic private fixture" }], timestamps: [{ value: "2026-09-09", timezone: "Europe/Vienna", certainty: "approximate" }], location: { label: "Hauptplatz", precision: "generalised" }, relationship: "spatial", certainty: "low", missingInformation: ["No source geometry in this fixture", "Private location was generalised"], transformationHistory: ["Grouped records by a named place", "Did not calculate proximity from invented coordinates"], authorDecision: "inferred" } },
  { id: "linz-echo-03", location: "Ars Electronica Center", eventId: "ars-hello-worlds", cityFragmentId: "linz-aec", privateTrace: { label: "Private fragment C", song: "Synthetic Spotify URI fixture", note: "A deliberately non-autobiographical remembered-note fragment.", isSynthetic: true }, proposal: "The system proposes an echo between an AI-facing exhibition and a personal note; the Author may leave the two records separate.", ledger: { proposalId: "linz-echo-03", sourceRecords: [{ id: "ars-hello-worlds", source: "Ars Electronica programme" }, { id: "linz-aec", source: "City of Linz fixture" }, { id: "synthetic-private-c", source: "Synthetic private fixture" }], timestamps: [{ value: "2026-09", timezone: "Europe/Vienna", certainty: "approximate" }], location: { label: "Ars Electronica Center", precision: "generalised" }, relationship: "associative", certainty: "ambiguous", missingInformation: ["Association is not a factual relationship"], transformationHistory: ["Placed approved fragment next to public context", "No model-generated conclusion"], authorDecision: "inferred" } },
];

export function getLinzProposals() { return proposals; }

export function applyLinzDecision(proposal: LinzProposal, decision: LinzDecision, revisedText?: string): LinzProposal {
  const state: EpistemicState = decision === "accepted" || decision === "revised" ? "authored" : decision === "refused" ? "refused" : "inferred";
  return { ...proposal, proposal: decision === "revised" && revisedText?.trim() ? revisedText.trim() : proposal.proposal, ledger: { ...proposal.ledger, authorDecision: state } };
}

export function locativeManifest(records = proposals) {
  return { schemaVersion: 1, kind: "storywalker-locative-echo", experimentId: LINZ_EXPERIMENT_ID, privacy: "public-synthetic-only", locationPrecision: "generalised", liveGeolocation: "explicit-opt-in-only", zones: records.map((record) => ({ id: record.id, label: record.location, trigger: "manual-or-simulated", coordinate: null, proposalState: record.ledger.authorDecision })), notes: ["No private trace content or raw coordinates are exported.", "Import into Echoes.xyz or another locative platform only after replacing a zone with approved public coordinates."] };
}
