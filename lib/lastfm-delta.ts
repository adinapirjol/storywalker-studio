import { minimisedLastFmHistorySchema, minimiseLastFmHistory } from "./private-ingest";
export function mergeLastFmDelta(existing: unknown, raw: unknown, from: string, to: string, importedAt: string) {
  const previous = minimisedLastFmHistorySchema.parse(existing);
  const delta = minimiseLastFmHistory(raw, importedAt);
  const lower = Date.parse(from), upper = Date.parse(to);
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower > upper) throw new Error("Invalid delta window");
  const key = (r: typeof previous.records[number]) => JSON.stringify([r.playedAt, r.trackName, r.artistName, r.albumName ?? ""]);
  const records = new Map(previous.records.map(r => [key(r), r]));
  let added = 0, overlap = 0, outsideWindow = 0;
  for (const row of delta.document.records) {
    if (Date.parse(row.playedAt) < lower || Date.parse(row.playedAt) > upper) { outsideWindow++; continue; }
    if (records.has(key(row))) { overlap++; continue; }
    records.set(key(row), row); added++;
  }
  const merged = minimisedLastFmHistorySchema.parse({ ...previous, importedAt, records: [...records.values()].sort((a, b) => a.playedAt.localeCompare(b.playedAt) || key(a).localeCompare(key(b))) });
  return { document: merged, added, overlap, outsideWindow, previousCount: previous.records.length, total: merged.records.length, discardedFields: delta.summary.discardedFields };
}
