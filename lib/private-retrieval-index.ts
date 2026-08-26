import type { VaultRecord } from "@/lib/private-vault";

export type LocalRetrievalIndex = {
  schemaVersion: 1;
  kind: "storywalker-local-retrieval-index";
  privacy: "private";
  canonical: false;
  derivedAt: string;
  method: "normalised-keyword-time-v1";
  indexedRecordCount: number;
  uniqueTermCount: number;
  records: Array<{ id: string; kind: string; terms: string[]; dates: string[] }>;
};

function terms(value: string) { return [...new Set(value.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]{2,}/gu) ?? [])].slice(0, 320); }

/** Large account imports are kept intact in the Vault, but the always-on
 * derived index must not serialise every row on each refresh. A bounded sample
 * keeps the import visible and rebuildable without turning Timeline history
 * into an unbounded memory allocation. */
function indexText(record: VaultRecord) {
  const payload = record.payload as { document?: { records?: unknown[] } };
  const records = payload.document?.records;
  if (record.kind === "import" && Array.isArray(records) && records.length > 500) {
    return JSON.stringify({ ...payload, document: { ...payload.document, records: records.slice(0, 16), indexedRecordCount: records.length, indexing: "bounded-import-summary" } });
  }
  return JSON.stringify(record.payload);
}

/** A local, encrypted and disposable retrieval foundation. This is deliberately
 * not called an embedding/vector index: it can be rebuilt before any model or
 * external embedding provider is consented. */
export function buildLocalRetrievalIndex(records: VaultRecord[], derivedAt = new Date().toISOString()): LocalRetrievalIndex {
  const indexed = records.filter((record) => record.kind !== "recovery-document" && record.kind !== "retrieval-index" && record.kind !== "atlas").map((record) => {
    const text = indexText(record);
    return { id: record.id, kind: record.kind, terms: terms(text), dates: [...new Set(text.match(/20\d{2}-\d{2}-\d{2}/gu) ?? [])].slice(0, 64) };
  });
  return { schemaVersion: 1, kind: "storywalker-local-retrieval-index", privacy: "private", canonical: false, derivedAt, method: "normalised-keyword-time-v1", indexedRecordCount: indexed.length, uniqueTermCount: new Set(indexed.flatMap((record) => record.terms)).size, records: indexed };
}
