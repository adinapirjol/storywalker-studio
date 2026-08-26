/** City-independent boundary between public city/festival data and Storywalker. */
export type RelationshipType = "spatial" | "temporal" | "factual" | "associative";
export type EpistemicState = "recorded" | "inferred" | "authored" | "refused";

export interface PublicContextRecord {
  id: string;
  sourceId: string;
  sourceLabel: string;
  title: string;
  observedAt?: string;
  location?: {
    label: string;
    latitude?: number;
    longitude?: number;
    precision: "exact" | "generalised" | "unknown";
  };
  fragment: string;
  licence: string;
}

export interface PrivateTraceRecord {
  id: string;
  occurredAt: string;
  timezone: string;
  locationLabel: string;
  locationPrecision: "generalised" | "unknown";
  spotifyUri?: string;
  trackLabel?: string;
  fragment: string;
  provenance: string;
  privacy: "local-private" | "synthetic";
}

export interface PublicContextAdapter {
  id: string;
  load(): Promise<PublicContextRecord[]>;
}

export interface PrivateTraceAdapter {
  id: string;
  loadMinimised(): Promise<PrivateTraceRecord[]>;
}

export interface EvidenceLedger {
  proposalId: string;
  sourceRecords: Array<{ id: string; source: string }>;
  timestamps: Array<{ value: string; timezone: string; certainty: "exact" | "approximate" }>;
  location: { label: string; precision: "exact" | "generalised" | "unknown" };
  relationship: RelationshipType;
  certainty: "high" | "moderate" | "low" | "ambiguous";
  missingInformation: string[];
  transformationHistory: string[];
  authorDecision: EpistemicState;
}
