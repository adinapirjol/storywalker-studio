import type { VaultRecord } from "@/lib/private-vault";

export type EvidenceAuthority = "author-stated" | "source-recorded" | "editorial-proposal" | "derived-context";
type ClaimAuthority = "author-stated" | "source-recorded";
export type EvidencePackItem = {
  id: string;
  kind: string;
  title: string;
  authority: EvidenceAuthority;
  matchedTerms: string[];
  dateHints: string[];
  snippet: string;
  excerpts: Array<{ text: string; authority: ClaimAuthority }>;
};

export type EvidenceConnection = {
  fromId: string;
  toId: string;
  basis: "shared-day" | "shared-query-term";
  detail: string;
};

export type EvidencePack = {
  mode: "local-retrieval-v1";
  query: string;
  consent: "this-tab-only";
  externalModelCalled: false;
  evidence: EvidencePackItem[];
  connectionCandidates: EvidenceConnection[];
  notice: string;
};

function terms(query: string) {
  return [...new Set(query.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]{2,}/gu) ?? [])].slice(0, 12);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function boundedRecordText(record: VaultRecord) {
  const payload = objectValue(record.payload); const document = objectValue(payload.document); const records = Array.isArray(document.records) ? document.records : undefined;
  if (record.kind === "import" && records && records.length > 500) return JSON.stringify({ ...payload, document: { ...document, records: records.slice(0, 16), retrievalRecordCount: records.length, retrievalView: "bounded-import-summary" } });
  return JSON.stringify(record.payload);
}

function labelledText(value: unknown, fallback: ClaimAuthority): Array<{ text: string; authority: ClaimAuthority }> {
  const item = objectValue(value);
  const text = typeof item.claim === "string" ? item.claim : typeof item.shortExcerpt === "string" ? item.shortExcerpt : null;
  const evidenceStatus = item.evidenceStatus;
  if (!text) return [];
  if (evidenceStatus === "author-stated" || evidenceStatus === "source-recorded") return [{ text, authority: evidenceStatus }];
  return fallback === "author-stated" ? [{ text, authority: fallback }] : [];
}

function excerptsFor(record: VaultRecord): Array<{ text: string; authority: ClaimAuthority }> {
  const payload = objectValue(record.payload);
  const moment = objectValue(payload.moment);
  const corrections: Array<{ text: string; authority: ClaimAuthority }> = [];
  const original: Array<{ text: string; authority: ClaimAuthority }> = [];
  for (const item of Array.isArray(moment.claimLedger) ? moment.claimLedger : []) original.push(...labelledText(item, "source-recorded"));
  for (const item of Array.isArray(moment.provenance) ? moment.provenance : []) original.push(...labelledText(item, "source-recorded"));
  for (const update of Array.isArray(payload.postImportEvidence) ? payload.postImportEvidence : []) {
    const evidence = objectValue(update);
    for (const item of Array.isArray(evidence.claims) ? evidence.claims : []) corrections.push(...labelledText(item, "author-stated"));
  }
  if (record.kind === "capture") {
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const evidence = typeof payload.evidence === "string" ? payload.evidence.trim() : "";
    if (title || evidence) original.push({ text: [title, evidence].filter(Boolean).join(" — "), authority: "author-stated" });
  }
  if (record.kind === "import" || record.kind === "playlist-source" || record.kind === "reference") {
    const source = payload.record && typeof payload.record === "object" ? JSON.stringify(payload.record) : boundedRecordText(record);
    original.push({ text: source.slice(0, 420), authority: "source-recorded" });
  }
  // Later Author corrections are surfaced first. Earlier raw claims remain
  // visible as evidence, but never outrank a correction in a Director reading.
  return [...new Map([...corrections, ...original].map((item) => [`${item.authority}:${item.text}`, item])).values()].slice(0, 6);
}

function recordTitle(record: VaultRecord) {
  const payload = objectValue(record.payload);
  const moment = objectValue(payload.moment);
  const candidate = moment.title ?? payload.title ?? payload.name ?? payload.source;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : record.id;
}

function authority(record: VaultRecord, excerpts: Array<{ authority: ClaimAuthority }>): EvidenceAuthority {
  if (record.kind === "editorial-cut" || record.kind === "journey-proposal" || record.kind === "thread") return "editorial-proposal";
  if (excerpts.some((item) => item.authority === "author-stated")) return "author-stated";
  if (excerpts.some((item) => item.authority === "source-recorded")) return "source-recorded";
  if (record.kind === "capture") return "author-stated";
  if (record.kind === "import" || record.kind === "playlist-source" || record.kind === "reference") return "source-recorded";
  return "derived-context";
}

function dateHints(text: string) {
  return [...new Set(text.match(/20\d{2}-\d{2}-\d{2}/gu) ?? [])].slice(0, 8);
}

function snippet(text: string, matched: string[]) {
  const index = matched.map((term) => text.toLocaleLowerCase().indexOf(term)).filter((value) => value >= 0).sort((a, b) => a - b)[0] ?? 0;
  return text.slice(Math.max(0, index - 110), index + 260).replace(/\s+/gu, " ").trim();
}

/**
 * The first RAG layer deliberately stops before generation. It creates an
 * evidence packet in-process from an unlocked Vault. It is rebuildable and
 * never writes, promotes, or interprets a record.
 */
export function buildEvidencePack(records: VaultRecord[], query: string): EvidencePack {
  const requestedTerms = terms(query);
  const evidence = records
    .filter((record) => record.kind !== "recovery-document")
    .map((record) => {
      const text = boundedRecordText(record);
      const matchedTerms = requestedTerms.filter((term) => text.toLocaleLowerCase().includes(term));
      const excerpts = excerptsFor(record);
      return { id: record.id, kind: record.kind, title: recordTitle(record), authority: authority(record, excerpts), matchedTerms, dateHints: dateHints(text), snippet: excerpts[0]?.text ?? snippet(text, matchedTerms), excerpts };
    })
    .filter((record) => record.matchedTerms.length > 0)
    .sort((a, b) => b.matchedTerms.length - a.matchedTerms.length || a.id.localeCompare(b.id))
    .slice(0, 12);

  const connections: EvidenceConnection[] = [];
  for (let left = 0; left < evidence.length; left += 1) for (let right = left + 1; right < evidence.length; right += 1) {
    const a = evidence[left]; const b = evidence[right];
    const sharedDay = a.dateHints.find((day) => b.dateHints.includes(day));
    if (sharedDay) connections.push({ fromId: a.id, toId: b.id, basis: "shared-day", detail: `Both records contain ${sharedDay}. This is a retrieval cue, not proof of a relationship.` });
    else {
      const sharedTerm = a.matchedTerms.find((term) => b.matchedTerms.includes(term));
      if (sharedTerm) connections.push({ fromId: a.id, toId: b.id, basis: "shared-query-term", detail: `Both records matched “${sharedTerm}”. This is a retrieval cue, not a factual claim.` });
    }
  }
  return {
    mode: "local-retrieval-v1", query, consent: "this-tab-only", externalModelCalled: false, evidence,
    connectionCandidates: connections.slice(0, 8),
    notice: "This packet was built locally from selected private records. It has not changed evidence status, created a Journey, or made an editorial decision.",
  };
}
