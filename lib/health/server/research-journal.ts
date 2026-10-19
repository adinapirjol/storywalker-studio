import { cycleContextSchema, selectedCycleContext, cycleContextNote, type CycleContext } from "../cycle-context";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { replaceVaultRecords, readVaultRecord, vaultRecordHeaders, type OpenVault, type VaultRecord } from "@/lib/vault/private-vault";
import type { Observation } from "@/lib/native/native-transfer-contract";
import { dates, dayKey, DAY, type SleepRecord } from "../model";
import { timeline, researchTimeline } from "../analysis";
import { exampleInsights, observatoryInsights } from "../observatory-insights";
import { syntheticImport } from "../fixture";
import { ALL_SLEEP_SOURCES, type ResearchJournal, type ResearchView } from "../research-journal";

export const journalID = "native:study04:journal";
const empty = (): ResearchJournal => ({ version: 1, connected: false, mode: "healthkit", source: null, history: [], dropped: 0 });
const journalSchema = z.object({
  version: z.literal(1), connected: z.boolean(), mode: z.enum(["synthetic", "healthkit"]), source: z.string().max(220).nullable(), dropped: z.number().int().nonnegative(),
  cycleContext: cycleContextSchema.optional(),
  hypothesis: z.object({ text: z.string().min(1).max(1200), enteredAt: z.string().datetime(), from: z.string().max(10), to: z.string().max(10) }).strict().optional(),
  history: z.array(z.object({ id: z.string().uuid(), at: z.string().datetime(), algorithm: z.enum(["observatory-v1", "observatory-v2", "observatory-v3", "observatory-v4"]), source: z.string().max(220).nullable().optional(), digest: z.string().regex(/^[a-f0-9]{64}$/), change: z.string().max(500), range: z.object({ from: z.string().max(10), to: z.string().max(10), offset: z.number().min(-840).max(840) }).strict().optional(), recordCount: z.number().int().nonnegative().max(10200).optional(), omitted: z.number().int().nonnegative().max(10200).optional(),
    notes: z.array(z.object({ id: z.string().max(100), title: z.string().max(500), evidence: z.string().max(2000), uncertainty: z.string().max(2000) }).strict()).max(20),
  }).strict()).max(30),
}).strict();
export function readResearchJournal(vault: OpenVault): ResearchJournal | null {
  const record = readVaultRecord(vault, journalID);
  if (!record) return null;
  const parsed = journalSchema.safeParse(record.payload);
  if (!parsed.success) throw Error("RESEARCH_STATE_INVALID");
  return parsed.data;
}
const record = (journal: ResearchJournal): VaultRecord => ({ id: journalID, kind: "reference", capturedAt: "1970-01-01T00:00:00.000Z", payload: journal });
const sourceKey = (o: Observation) => JSON.stringify([o.source_id, o.device_revision]);
function offsetAt(at: number, zone: string) {
  if (/^[+-]\d{2}:\d{2}$/.test(zone)) {
    const minutes = Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4));
    if (minutes > 840 || Number(zone.slice(4)) > 59) throw Error("TIMEZONE_UNKNOWN");
    return zone[0] === "-" ? -minutes : minutes;
  }
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(at);
  const offset = parts.find(p => p.type === "timeZoneName")?.value.replace("GMT", "") || "+00:00";
  if (!/^[+-]\d{2}:\d{2}$/.test(offset)) throw Error("TIMEZONE_UNKNOWN");
  return (offset[0] === "-" ? -1 : 1) * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4)));
}
/** Accepted evidence only. An overlay lets source deletions and notes commit together. */
function observations(vault: OpenVault, writes: VaultRecord[] = []) {
  const headers = vaultRecordHeaders(vault).filter(h => h.id.startsWith("native:evidence:"));
  if (headers.length + writes.filter(r => r.id.startsWith("native:evidence:")).length > 10200) throw Error("RESEARCH_SOURCE_LIMIT");
  const overlay = new Map(writes.map(r => [r.id, r]));
  const ids = new Set([...headers.map(h => h.id), ...writes.filter(r => r.id.startsWith("native:evidence:")).map(r => r.id)]);
  const result: Observation[] = [];
  for (const id of ids) {
    const payload = (overlay.get(id) ?? readVaultRecord(vault, id))?.payload as { deleted?: boolean; observation?: Observation } | undefined;
    const o = payload?.observation;
    if (!payload?.deleted && o?.source_type === "healthkit" && o.payload.kind === "sleep") result.push(o);
  }
  return result;
}
function view(vault: OpenVault, journal: ResearchJournal | null, writes: VaultRecord[] = []): ResearchView {
  const range = { from: "2026-02-01", to: "2026-02-28", offset: 120 };
  if (journal?.mode === "synthetic") return { journal, records: syntheticImport().records, range, sources: [], omitted: 0 };
  const all = observations(vault, writes), sources = new Map<string, { key: string; label: string; count: number }>();
  for (const o of all) {
    const key = sourceKey(o), old = sources.get(key);
    sources.set(key, { key, label: `${o.source_id} / ${o.device_revision ?? "device unknown"}`, count: (old?.count ?? 0) + 1 });
  }
  let omitted = 0;
  const records: SleepRecord[] = [];
  for (const o of all.filter(o => journal?.source === ALL_SLEEP_SOURCES || sourceKey(o) === journal?.source)) {
    try {
      const start = Date.parse(o.event_start), end = Date.parse(o.event_end);
      if (!Number.isFinite(start + end) || end <= start || o.payload.kind !== "sleep") throw Error("INVALID_SLEEP");
      records.push({ id: o.id, source: o.source_id, sourceVersion: o.source_revision, device: o.device_revision ?? "", startRaw: o.event_start, endRaw: o.event_end, creationRaw: o.received_at,
        start, end, startOffset: offsetAt(start, o.original_offset), endOffset: offsetAt(end, o.original_offset), kind: o.payload.stage, ordinal: records.length + 1 });
    } catch { omitted++; }
  }
  records.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  records.forEach((r, index) => { r.ordinal = index + 1; });
  if (records.length) {
    range.offset = [...records].sort((a, b) => b.end - a.end || a.id.localeCompare(b.id))[0].endOffset;
    range.to = records.map(r => dayKey(r.end + r.endOffset * 60_000)).sort().at(-1)!;
    range.from = dayKey(Math.max(Math.min(...records.map(r => Date.parse(dayKey(r.end + r.endOffset * 60_000)))), Date.parse(range.to) - 89 * DAY));
  } else { range.from = ""; range.to = ""; }
  return { journal, records: records.filter(r => r.end > Date.parse(range.from) - DAY), range, sources: [...sources.values()], omitted };
}
export function researchView(vault: OpenVault) { return view(vault, readResearchJournal(vault)); }
function update(vault: OpenVault, journal: ResearchJournal, writes: VaultRecord[] = [], now = new Date().toISOString()) {
  const result = view(vault, journal, writes);
  const cycle = journal.mode === "healthkit" ? selectedCycleContext(journal.cycleContext, result.range) : undefined;
  const digest = createHash("sha256").update(JSON.stringify(["observatory-v4", journal.mode, journal.source, result.records, result.omitted, ...(cycle ? [cycle] : [])])).digest("hex");
  if (journal.history.at(-1)?.digest === digest) return journal;
  const ns = journal.mode === "healthkit" ? researchTimeline(result.records, result.range.from, result.range.to) : timeline(result.records, result.range.from, result.range.to, result.range.offset, new Set(dates(result.range.from, result.range.to)));
  const notes = (journal.mode === "synthetic" ? exampleInsights(ns) : observatoryInsights(ns)).notes;
  if (cycle) notes.push(cycleContextNote(cycle));
  if (result.omitted) notes.push({ id: "coverage", title: "Some source records could not be grouped reliably", evidence: `${result.omitted} records omitted because timestamps or original timezones are unavailable.`, uncertainty: "Missing or ungroupable records are not zero sleep. No current-device timezone is substituted for the source timezone." });
  const previous = journal.history.at(-1);
  const history = [...journal.history, { id: randomUUID(), at: now, algorithm: "observatory-v4" as const, source: journal.source, digest, notes, range: result.range, recordCount: result.records.length, omitted: result.omitted,
    change: previous ? "Source data or selected context changed; findings recalculated. Earlier findings describe earlier data, not the current state." : "First saved analysis of the available source data." }];
  return { ...journal, history: history.slice(-30), dropped: journal.dropped + Math.max(0, history.length - 30) };
}
export function configureResearch(vault: OpenVault, action: "connect" | "disconnect" | "refresh" | "example" | "delete-notes" | "set-hypothesis" | "set-cycle-context", source?: string, hypothesis?: string, cycleContext?: CycleContext | null) {
  const old = readResearchJournal(vault) ?? empty();
  let next = old;
  if (action === "set-cycle-context") {
    if (old.mode !== "healthkit" || cycleContext === undefined) throw Error("INVALID_CYCLE_CONTEXT");
    next = { ...old, cycleContext: cycleContext === null ? undefined : cycleContextSchema.parse(cycleContext) };
  } else if (action === "set-hypothesis") {
    if (old.mode !== "healthkit" || typeof hypothesis !== "string" || hypothesis.trim().length > 1200) throw Error("INVALID_HYPOTHESIS");
    const range = view(vault, old).range;
    const text = hypothesis.trim();
    next = { ...old, hypothesis: text ? (old.hypothesis?.text === text ? old.hypothesis : { text, enteredAt: new Date().toISOString(), from: range.from, to: range.to }) : undefined };
  } else if (action === "connect") {
    const choices = view(vault, old).sources;
    if (source && source !== ALL_SLEEP_SOURCES && !choices.some(s => s.key === source)) throw Error("SOURCE_UNAVAILABLE");
    next = old.mode === "healthkit"
      ? { ...old, connected: true, source: source ?? old.source, history: old.history.map(run => run.source === undefined ? { ...run, source: old.source } : run) } : { ...empty(), connected: true, source: source ?? null };
  } else if (action === "example") next = old.mode === "synthetic" ? { ...old, connected: true } : { ...empty(), connected: true, mode: "synthetic" };
  else if (action === "disconnect") next = { ...old, connected: false };
  else if (action === "delete-notes") next = { ...old, connected: false, history: [], dropped: 0, hypothesis: undefined, cycleContext: undefined };
  if (next.connected || action === "set-cycle-context") next = update(vault, next);
  if (JSON.stringify(old) !== JSON.stringify(next) || !readResearchJournal(vault)) replaceVaultRecords(vault, [record(next)], [journalID]);
  return view(vault, next);
}
/** Source and derived-history deletion are committed in the same Vault transaction. */
export function researchJournalWrite(vault: OpenVault, writes: VaultRecord[]): VaultRecord | null {
  const journal = readResearchJournal(vault);
  if (!journal || journal.mode !== "healthkit") return null;
  const deleted = writes.some(r => r.id.startsWith("native:evidence:") && (r.payload as { deleted?: boolean }).deleted);
  let base = deleted ? { ...journal, history: [], dropped: 0 } : journal;
  if (base.connected && base.source === null) {
    const watch = observations(vault, writes).filter(o => o.quality.includes("recorded_on_apple_watch"));
    const keys = [...new Set(watch.map(sourceKey))];
    if (keys.length === 1) base = { ...base, source: keys[0] };
  }
  const next = base.connected ? update(vault, base, writes) : base;
  return JSON.stringify(journal) === JSON.stringify(next) ? null : record(next);
}

/** Consent is limited to one Watch sleep source, never arbitrary native evidence. */
export function canAutoAcceptResearch(vault: OpenVault, batch: { mode: string; observations: Observation[]; deletions: string[] }) {
  if (batch.mode !== "healthkit" || (!batch.observations.length && !batch.deletions.length)) return false;
  const keys = new Set(batch.observations.map(sourceKey));
  if (keys.size > 1 || batch.observations.some(o => o.payload.kind !== "sleep" || !o.quality.includes("recorded_on_apple_watch"))) return false;
  const journal = readResearchJournal(vault);
  if (!journal?.connected || journal.mode !== "healthkit") return false;
  if (journal.source !== null && batch.observations.some(o => sourceKey(o) !== journal.source)) return false;
  for (const id of batch.deletions) {
    const key = "native:evidence:" + createHash("sha256").update("healthkit\n" + id).digest("hex");
    const value = readVaultRecord(vault, key)?.payload as { observation?: Observation; deleted?: boolean } | undefined;
    if (value?.deleted) continue;
    if (!value?.observation || value.observation.payload.kind !== "sleep" || sourceKey(value.observation) !== journal.source) return false;
  }
  return batch.observations.length > 0 || batch.deletions.length > 0;
}
