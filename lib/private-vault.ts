import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import initialiseSqlJs, { type SqlDatabase } from "sql.js/dist/sql-wasm.js";
import { migrateStagedRecovery } from "@/lib/private-recovery";
import { inspectAndMinimiseTimeline, minimiseEchoesExport, minimisedGoogleCalendarSchema, minimisedGoogleMapsSchema, minimisedTimelineSchema, minimisedYouTubeHistorySchema, minimiseLastFmHistory, minimiseSpotifyHistory } from "@/lib/private-ingest";
import { minimiseGoogleMapsSavedListCsv, minimisedGoogleMapsSavedListSchema, validateGoogleMapsListUrl } from "@/lib/google-maps-list";
import { buildEvidencePack } from "@/lib/private-signal-engine";
import { buildLocalRetrievalIndex } from "@/lib/private-retrieval-index";
import { buildAtlasNow, type AtlasNow } from "@/lib/private-atlas";

const VAULT_DIR = path.join(process.cwd(), "private-data", "vault");
const VAULT_PATH = path.join(VAULT_DIR, "storywalker-vault.sqlite");
const VERIFIER = "storywalker-vault:v1:passphrase-check";
const runtimeRequire = createRequire(path.join(process.cwd(), "package.json"));
const SQL_WASM_PATH = runtimeRequire.resolve("sql.js/dist/sql-wasm.wasm");
const TIMELINE_RECORD_ID = "import:google-timeline:v1";
const TIMELINE_CHUNK_PREFIX = `${TIMELINE_RECORD_ID}:chunk:`;
const TIMELINE_CHUNK_SIZE = 256;

export type VaultKind = "recovery-document" | "moment" | "journey" | "journey-proposal" | "thread" | "playlist-source" | "capture" | "reference" | "import" | "editorial-cut" | "editorial-draft" | "retrieval-index" | "atlas" | "scenario-studio" | "public-draft";
export type VaultRecord = { id: string; kind: VaultKind; capturedAt: string; payload: unknown };
type VaultMeta = { schemaVersion: 1; salt: string; verifier: string; createdAt: string };
export type OpenVault = { database: SqlDatabase; key: Buffer };

function vaultDirectory() { mkdirSync(VAULT_DIR, { recursive: true, mode: 0o700 }); try { chmodSync(VAULT_DIR, 0o700); } catch { /* best-effort */ } }
function persistDatabase(database: SqlDatabase) { writeFileSync(VAULT_PATH, Buffer.from(database.export()), { mode: 0o600 }); try { chmodSync(VAULT_PATH, 0o600); } catch { /* best-effort */ } }

async function openDatabase() {
  vaultDirectory();
  const SQL = await initialiseSqlJs({ locateFile: () => SQL_WASM_PATH });
  const database = new SQL.Database(existsSync(VAULT_PATH) ? new Uint8Array(readFileSync(VAULT_PATH)) : undefined);
  database.run("CREATE TABLE IF NOT EXISTS vault_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS vault_records (record_id TEXT PRIMARY KEY, kind TEXT NOT NULL, captured_at TEXT NOT NULL, content_hash TEXT NOT NULL, iv BLOB NOT NULL, auth_tag BLOB NOT NULL, ciphertext BLOB NOT NULL);");
  return database;
}

function rows(database: SqlDatabase, sql: string, values: unknown[] = []) {
  const statement = database.prepare(sql);
  try { statement.bind(values); const result: Array<Record<string, unknown>> = []; while (statement.step()) result.push(statement.getAsObject()); return result; } finally { statement.free(); }
}
function keyFrom(passphrase: string, salt: string) { if (passphrase.length < 12) throw new Error("Choose a Vault passphrase with at least 12 characters."); return scryptSync(passphrase, Buffer.from(salt, "base64url"), 32); }
function metadata(database: SqlDatabase): VaultMeta | undefined { const row = rows(database, "SELECT value FROM vault_meta WHERE key = 'metadata'")[0] as { value?: string } | undefined; return row?.value ? JSON.parse(row.value) as VaultMeta : undefined; }
function keyVerifier(key: Buffer) { return createHmac("sha256", key).update(VERIFIER).digest("base64url"); }
function crypt(key: Buffer, payload: unknown) { const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key, iv); const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]); return { iv, authTag: cipher.getAuthTag(), ciphertext }; }
function decrypt(key: Buffer, row: { ciphertext: Uint8Array; iv: Uint8Array; auth_tag: Uint8Array }) { const cipher = createDecipheriv("aes-256-gcm", key, Buffer.from(row.iv)); cipher.setAuthTag(Buffer.from(row.auth_tag)); return JSON.parse(Buffer.concat([cipher.update(Buffer.from(row.ciphertext)), cipher.final()]).toString("utf8")) as unknown; }

export function vaultExists() { return existsSync(VAULT_PATH); }
export async function vaultDriverReady() { await initialiseSqlJs({ locateFile: () => SQL_WASM_PATH }); return true; }
/** These are local, non-content markers only. They let the Vault confirm that
 * a consented import survived a refresh without decrypting or exposing data. */
export async function vaultImportMarkers() {
  if (!vaultExists()) return { calendarPrepared: false, mapsPrepared: false, mapsListPrepared: false, timelinePrepared: false, youtubePrepared: false, lastFmHistory: false, sideQuestControlRoom: false };
  const database = await openDatabase();
  try {
    const ids = new Set((rows(database, "SELECT record_id FROM vault_records WHERE record_id IN ('import:google-takeout-calendar:v1', 'import:google-takeout-maps:v1', 'import:google-takeout-maps-selected-saved-list:v1', 'import:google-timeline:v1', 'import:youtube-watch-history:v1', 'import:lastfm-history:v1')") as Array<{ record_id: string }>).map((row) => row.record_id));
    const sideQuestControlRoom = rows(database, "SELECT 1 FROM vault_records WHERE record_id LIKE 'side-quest:snapshot:%' LIMIT 1").length > 0;
    const mapsListPrepared = rows(database, "SELECT 1 FROM vault_records WHERE record_id LIKE 'import:google-maps-list:%' LIMIT 1").length > 0;
    return { calendarPrepared: ids.has("import:google-takeout-calendar:v1"), mapsPrepared: ids.has("import:google-takeout-maps:v1"), mapsListPrepared: mapsListPrepared || ids.has("import:google-takeout-maps-selected-saved-list:v1"), timelinePrepared: ids.has("import:google-timeline:v1"), youtubePrepared: ids.has("import:youtube-watch-history:v1"), lastFmHistory: ids.has("import:lastfm-history:v1"), sideQuestControlRoom };
  } finally { database.close(); }
}

export async function initialiseVault(passphrase: string) {
  const database = await openDatabase();
  if (metadata(database)) { database.close(); throw new Error("This device already has a Storywalker Vault. Unlock it instead of creating a new one."); }
  const salt = randomBytes(16).toString("base64url"); const key = keyFrom(passphrase, salt); const next: VaultMeta = { schemaVersion: 1, salt, verifier: keyVerifier(key), createdAt: new Date().toISOString() };
  database.run("INSERT INTO vault_meta (key, value) VALUES ('metadata', ?)", [JSON.stringify(next)]); persistDatabase(database); database.close(); return { createdAt: next.createdAt };
}

export async function openVault(passphrase: string): Promise<OpenVault> {
  if (!vaultExists()) throw new Error("Create the local Vault before unlocking it.");
  const database = await openDatabase(); const meta = metadata(database); if (!meta) { database.close(); throw new Error("Vault metadata is missing."); }
  const key = keyFrom(passphrase, meta.salt); const expected = Buffer.from(meta.verifier, "base64url"); const actual = Buffer.from(keyVerifier(key), "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) { database.close(); throw new Error("That passphrase cannot unlock this Vault."); }
  return { database, key };
}

/** A previously verified, process-local session key. Never accept this from a client. */
export async function openVaultWithKey(key: Buffer): Promise<OpenVault> {
  if (!vaultExists()) throw new Error("Create the local Vault before unlocking it.");
  return { database: await openDatabase(), key: Buffer.from(key) };
}

export function closeVault(vault: OpenVault) { vault.database.close(); }
function writeVaultRecords(vault: OpenVault, records: VaultRecord[], removeRecordIds: string[] = []) {
  const insert = "INSERT INTO vault_records (record_id, kind, captured_at, content_hash, iv, auth_tag, ciphertext) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(record_id) DO UPDATE SET kind = excluded.kind, captured_at = excluded.captured_at, content_hash = excluded.content_hash, iv = excluded.iv, auth_tag = excluded.auth_tag, ciphertext = excluded.ciphertext";
  vault.database.run("BEGIN IMMEDIATE");
  try {
    for (const recordId of removeRecordIds) vault.database.run("DELETE FROM vault_records WHERE record_id = ?", [recordId]);
    for (const record of records) { const secured = crypt(vault.key, record); vault.database.run(insert, [record.id, record.kind, record.capturedAt, createHash("sha256").update(JSON.stringify(record.payload)).digest("hex"), secured.iv, secured.authTag, secured.ciphertext]); }
    vault.database.run("COMMIT"); persistDatabase(vault.database);
  } catch (error) { vault.database.run("ROLLBACK"); throw error; }
  return records.length;
}
export function putVaultRecords(vault: OpenVault, records: VaultRecord[]) { return writeVaultRecords(vault, records); }
function readVaultRecord(vault: OpenVault, id: string) { const row = rows(vault.database, "SELECT ciphertext, iv, auth_tag FROM vault_records WHERE record_id = ?", [id])[0] as { ciphertext: Uint8Array; iv: Uint8Array; auth_tag: Uint8Array } | undefined; return row ? decrypt(vault.key, row) as VaultRecord : undefined; }
/** Timeline chunks are intentionally omitted from general derived views. They
 * are decrypted one small chunk at a time when Atlas needs a place reading. */
export function readVaultRecords(vault: OpenVault, includeTimelineChunks = false) {
  const query = includeTimelineChunks ? "SELECT ciphertext, iv, auth_tag FROM vault_records ORDER BY captured_at DESC, record_id ASC" : "SELECT ciphertext, iv, auth_tag FROM vault_records WHERE record_id NOT LIKE ? ORDER BY captured_at DESC, record_id ASC";
  const selected = rows(vault.database, query, includeTimelineChunks ? [] : [`${TIMELINE_CHUNK_PREFIX}%`]) as Array<{ ciphertext: Uint8Array; iv: Uint8Array; auth_tag: Uint8Array }>;
  return selected.map((row) => decrypt(vault.key, row) as VaultRecord);
}

function timelineChunkRecords(record: VaultRecord) {
  const payload = record.payload as Record<string, unknown>; const document = payload.document as Record<string, unknown> | undefined;
  const windows = Array.isArray(document?.records) ? document.records : [];
  const chunks = Array.from({ length: Math.ceil(windows.length / TIMELINE_CHUNK_SIZE) }, (_, index) => ({
    id: `${TIMELINE_CHUNK_PREFIX}${String(index).padStart(5, "0")}`, kind: "import" as const, capturedAt: record.capturedAt,
    payload: { schemaVersion: 1, privacy: "private", canonical: false, consent: payload.consent, source: "google-timeline-chunk", parentSource: "google-timeline", parentRecordId: TIMELINE_RECORD_ID, importedAt: payload.importedAt, chunk: { index, total: Math.ceil(windows.length / TIMELINE_CHUNK_SIZE), size: TIMELINE_CHUNK_SIZE }, document: { schemaVersion: 1, source: "google-timeline", importedAt: document?.importedAt, schemaEncountered: document?.schemaEncountered, records: windows.slice(index * TIMELINE_CHUNK_SIZE, (index + 1) * TIMELINE_CHUNK_SIZE) } },
  }));
  const manifest: VaultRecord = { ...record, id: TIMELINE_RECORD_ID, payload: { ...payload, storage: "timeline-chunk-manifest-v1", document: { schemaVersion: 2, source: "google-timeline", importedAt: document?.importedAt, schemaEncountered: document?.schemaEncountered, recordCount: windows.length, chunkCount: chunks.length, chunkSize: TIMELINE_CHUNK_SIZE } } };
  return [manifest, ...chunks];
}

/** Converts the historical one-record Timeline import in place. This is a
 * storage migration, not a re-import: source rows, source id and consent are
 * retained while future Atlas work can stream bounded chunks. */
function ensureTimelineChunks(vault: OpenVault) {
  const timeline = readVaultRecord(vault, TIMELINE_RECORD_ID); if (!timeline) return;
  const payload = timeline.payload as Record<string, unknown>; const document = payload.document as Record<string, unknown> | undefined;
  if (payload.storage === "timeline-chunk-manifest-v1" || payload.source !== "google-timeline" || !Array.isArray(document?.records)) return;
  const chunks = timelineChunkRecords(timeline);
  const priorChunkIds = (rows(vault.database, "SELECT record_id FROM vault_records WHERE record_id LIKE ?", [`${TIMELINE_CHUNK_PREFIX}%`]) as Array<{ record_id: string }>).map((row) => row.record_id);
  writeVaultRecords(vault, chunks, priorChunkIds);
}

function* readTimelineWindows(vault: OpenVault) {
  const statement = vault.database.prepare("SELECT ciphertext, iv, auth_tag FROM vault_records WHERE record_id LIKE ? ORDER BY record_id ASC");
  try { statement.bind([`${TIMELINE_CHUNK_PREFIX}%`]); while (statement.step()) { const record = decrypt(vault.key, statement.getAsObject() as { ciphertext: Uint8Array; iv: Uint8Array; auth_tag: Uint8Array }) as VaultRecord; const document = (record.payload as { document?: { records?: unknown[] } }).document; for (const window of document?.records ?? []) yield window; } } finally { statement.free(); }
}
export function vaultSummary(vault: OpenVault) { const result = rows(vault.database, "SELECT kind, COUNT(*) AS count FROM vault_records GROUP BY kind ORDER BY kind") as Array<{ kind: VaultKind; count: number }>; return { exists: true, records: result.reduce<Record<string, number>>((summary, row) => ({ ...summary, [row.kind]: Number(row.count) }), {}) }; }
export function searchVault(vault: OpenVault, query: string) {
  const terms = [...new Set(query.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]{2,}/gu) ?? [])].slice(0, 12); if (!terms.length) return [];
  return readVaultRecords(vault).filter((record) => record.kind !== "recovery-document").map((record) => { const payload = record.payload as { document?: { records?: unknown[] } }; const records = payload.document?.records; const text = record.kind === "import" && Array.isArray(records) && records.length > 500 ? JSON.stringify({ ...payload, document: { ...payload.document, records: records.slice(0, 16), searchRecordCount: records.length, searchView: "bounded-import-summary" } }) : JSON.stringify(record.payload); const normalised = text.toLocaleLowerCase(); const matches = terms.flatMap((term) => normalised.includes(term) ? [term] : []); const firstMatch = matches.map((term) => normalised.indexOf(term)).filter((index) => index >= 0).sort((a, b) => a - b)[0]; return { id: record.id, kind: record.kind, score: matches.length, matchedTerms: matches, snippet: firstMatch === undefined ? "" : text.slice(Math.max(0, firstMatch - 100), firstMatch + 180) }; }).filter((record) => record.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 12);
}
export function retrieveVaultEvidence(vault: OpenVault, query: string) { return buildEvidencePack(readVaultRecords(vault), query); }
export function rebuildVaultRetrievalIndex(vault: OpenVault) {
  const index = buildLocalRetrievalIndex(readVaultRecords(vault));
  putVaultRecords(vault, [{ id: "retrieval-index:local-v1", kind: "retrieval-index", capturedAt: index.derivedAt, payload: index }]);
  return { indexedRecords: index.indexedRecordCount, uniqueTerms: index.uniqueTermCount, method: index.method };
}

/** Derived views are local encrypted aids, not additional evidence or canon.
 * Rebuilding them after a source write keeps Director and Atlas current without
 * asking the Author to perform index administration. */
export function refreshVaultDerivedViews(vault: OpenVault, acknowledgeAtlasChanges = false) {
  // A Timeline import may contain many thousands of private windows. Migrate
  // the original encrypted source to a local manifest once, then keep chunks
  // out of the always-on retrieval snapshot and stream them only into Atlas.
  ensureTimelineChunks(vault);
  const records = readVaultRecords(vault);
  const previousAtlas = records.find((record) => record.id === "atlas:now:v1" && record.kind === "atlas")?.payload as AtlasNow | undefined;
  const retrievalIndex = buildLocalRetrievalIndex(records);
  const derivedAtlas = buildAtlasNow(records, new Date().toISOString(), previousAtlas, { timelineWindows: readTimelineWindows(vault) });
  const atlas = acknowledgeAtlasChanges ? { ...derivedAtlas, acknowledgedImports: derivedAtlas.imports, acknowledgedSourceIds: records.filter((record) => record.kind === "editorial-draft" || record.kind === "capture").map((record) => record.id) } : { ...derivedAtlas, acknowledgedImports: previousAtlas?.acknowledgedImports, acknowledgedSourceIds: previousAtlas?.acknowledgedSourceIds };
  putVaultRecords(vault, [
    { id: "retrieval-index:local-v1", kind: "retrieval-index", capturedAt: retrievalIndex.derivedAt, payload: retrievalIndex },
    { id: "atlas:now:v1", kind: "atlas", capturedAt: atlas.derivedAt, payload: atlas },
  ]);
  return { retrievalIndex, atlas };
}

export function readAtlasNow(vault: OpenVault) {
  return readVaultRecords(vault).find((record) => record.id === "atlas:now:v1" && record.kind === "atlas")?.payload ?? null;
}
export function readScenarioStudio(vault: OpenVault) {
  return readVaultRecords(vault).find((record) => record.id === "scenario-studio:constellation:v1" && record.kind === "scenario-studio")?.payload ?? null;
}

/** Import only a selected local source. Raw account exports are minimised before
 * encryption; no raw export file is retained by the Vault. */
export function importSelectedPrivateSource(vault: OpenVault, source: "spotify-history" | "google-timeline" | "echoes-export", raw: unknown, importedAt = new Date().toISOString()) {
  const prepared = source === "spotify-history" ? minimiseSpotifyHistory(raw, importedAt) : source === "echoes-export" ? minimiseEchoesExport(raw, importedAt) : inspectAndMinimiseTimeline(raw, importedAt);
  const record: VaultRecord = {
    id: `import:${source}:v1`, kind: "import", capturedAt: importedAt,
    payload: { schemaVersion: 1, privacy: "private", canonical: false, consent: "explicit-local-file-selection", source, importedAt, summary: prepared.summary, document: prepared.document },
  };
  putVaultRecords(vault, source === "google-timeline" ? timelineChunkRecords(record) : [record]);
  return { source, retained: prepared.summary.retained, total: prepared.summary.total, warnings: prepared.summary.warnings };
}

/** Last.fm is a timestamped listening source, not playlist provenance. The
 * requested profile/window are intentionally not retained with the minimised
 * document, so this source cannot become a profile archive by accident. */
export function importLastFmHistory(vault: OpenVault, raw: unknown, importedAt = new Date().toISOString()) {
  const prepared = minimiseLastFmHistory(raw, importedAt);
  const record: VaultRecord = {
    id: "import:lastfm-history:v1", kind: "import", capturedAt: importedAt,
    payload: { schemaVersion: 1, privacy: "private", canonical: false, consent: "explicit-lastfm-window", source: "lastfm-history", importedAt, summary: prepared.summary, document: prepared.document },
  };
  putVaultRecords(vault, [record]);
  return { source: "lastfm-history", retained: prepared.summary.retained, total: prepared.summary.total, warnings: prepared.summary.warnings };
}

/** Imports one Author-selected Google Takeout Saved CSV after the Author
 * consents. The prefilled shared link is used only to make the local choice
 * legible; URLs/list IDs and all CSV fields other than place title are dropped. */
export function importGoogleMapsSharedList(vault: OpenVault, sharedUrl: string, csv: string, importedAt = new Date().toISOString()) {
  const requestedUrl = validateGoogleMapsListUrl(sharedUrl);
  if (csv.length > 4_000_000) throw new Error("Choose a Saved-list CSV smaller than 4 MB. Nothing was written to the Vault.");
  const prepared = minimiseGoogleMapsSavedListCsv(csv, importedAt);
  if (!prepared.summary.retained) throw new Error(prepared.summary.warnings[0] ?? "The shared Maps list had no minimised places. Nothing was written to the Vault.");
  const sourceHash = createHash("sha256").update(requestedUrl).digest("hex");
  const record: VaultRecord = {
    id: `import:google-maps-list:${sourceHash.slice(0, 24)}`, kind: "import", capturedAt: importedAt,
    payload: { schemaVersion: 1, privacy: "private", canonical: false, consent: "explicit-google-maps-saved-list-csv", source: "google-maps-takeout-saved-list", sourceHash, importedAt, summary: prepared.summary, document: prepared.document },
  };
  putVaultRecords(vault, [record]);
  return { source: "google-maps-takeout-saved-list", retained: prepared.summary.retained, total: prepared.summary.total, warnings: prepared.summary.warnings };
}

/** Imports a local-only derivative made by the Takeout preparer. The original
 * archives are never read by the Vault route and no raw Takeout is retained. */
export function importPreparedGoogleTakeout(vault: OpenVault) {
  const directory = path.join(process.cwd(), "private-data", "minimised");
  const definitions = [
    { file: "google-takeout-calendar.private.json", id: "import:google-takeout-calendar:v1", source: "google-takeout-calendar", schema: minimisedGoogleCalendarSchema, warnings: ["Calendar titles, locations and descriptions are source-recorded scheduling data, not proof that an event happened or what it meant."] },
    { file: "google-takeout-maps.private.json", id: "import:google-takeout-maps:v1", source: "google-takeout-maps", schema: minimisedGoogleMapsSchema, warnings: ["Labeled places establish a saved place, not a visit, route, or meaning."] },
    { file: "google-takeout-maps-selected-saved-list.private.json", id: "import:google-takeout-maps-selected-saved-list:v1", source: "google-maps-takeout-saved-list", schema: minimisedGoogleMapsSavedListSchema, warnings: ["A place was saved in one author-selected list; it does not establish a visit, future plan, route, priority, or meaning."] },
    { file: "google-timeline.private.json", id: "import:google-timeline:v1", source: "google-timeline", schema: minimisedTimelineSchema, warnings: ["Timeline stops and movement windows are platform-recorded signals, not proof of where you were or what a trip meant."] },
    { file: "youtube-watch-history.private.json", id: "import:youtube-watch-history:v1", source: "youtube-watch-history", schema: minimisedYouTubeHistorySchema, warnings: ["Watch history establishes a recorded watch, not attention, learning, or meaning."] },
  ] as const;
  const imported = definitions.flatMap((definition) => {
    const preparedPath = path.join(directory, definition.file); if (!existsSync(preparedPath)) return [];
    const document = definition.schema.parse(JSON.parse(readFileSync(preparedPath, "utf8")) as unknown);
    return [{ source: definition.source, retained: document.records.length, total: document.records.length, warnings: definition.warnings, record: { id: definition.id, kind: "import" as const, capturedAt: document.importedAt, payload: { schemaVersion: 1, privacy: "private", canonical: false, consent: "author-requested-local-takeout-preparation", source: definition.source, importedAt: document.importedAt, summary: { total: document.records.length, retained: document.records.length, warnings: definition.warnings }, document } } }];
  });
  if (!imported.length) throw new Error("No prepared Google Takeout source was found on this machine.");
  putVaultRecords(vault, imported.flatMap((item) => item.source === "google-timeline" ? timelineChunkRecords(item.record) : [item.record]));
  return { source: "google-takeout", retained: imported.reduce((total, item) => total + item.retained, 0), total: imported.reduce((total, item) => total + item.total, 0), warnings: imported.flatMap((item) => item.warnings), sources: imported.map(({ source, retained, total }) => ({ source, retained, total })) };
}

/** Imports only the single Saved-list derivative the Author prepared. It does
 * not re-read Calendar, Timeline, YouTube, or any other Takeout source. */
export function importPreparedGoogleMapsSelectedList(vault: OpenVault) {
  const file = path.join(process.cwd(), "private-data", "minimised", "google-takeout-maps-selected-saved-list.private.json");
  if (!existsSync(file)) throw new Error("No prepared selected Saved list was found on this machine.");
  const document = minimisedGoogleMapsSavedListSchema.parse(JSON.parse(readFileSync(file, "utf8")) as unknown);
  const warning = "A place was saved in one author-selected list; it does not establish a visit, future plan, route, priority, or meaning.";
  const record: VaultRecord = { id: "import:google-takeout-maps-selected-saved-list:v1", kind: "import", capturedAt: document.importedAt, payload: { schemaVersion: 1, privacy: "private", canonical: false, consent: "author-requested-local-takeout-preparation", source: "google-maps-takeout-saved-list", importedAt: document.importedAt, summary: { total: document.records.length, retained: document.records.length, warnings: [warning] }, document } };
  putVaultRecords(vault, [record]);
  return { source: "google-maps-takeout-saved-list", retained: document.records.length, total: document.records.length, warnings: [warning], sources: [{ source: "google-maps-takeout-saved-list", retained: document.records.length, total: document.records.length }] };
}

/** An Editor Cut is private editorial material, not a factual import. Keeping it
 * as its own record makes the difference visible to retrieval and review. */
export function importEditorCut(vault: OpenVault, markdown: string, importedAt = new Date().toISOString()) {
  const clean = markdown.trim();
  if (!clean) throw new Error("The Editor Cut was empty.");
  if (clean.length > 120_000) throw new Error("Choose an Editor Cut smaller than 120 KB.");
  const title = clean.match(/^#\s+(.+)$/mu)?.[1]?.trim() ?? "Untitled Editor Cut";
  const coverage = clean.match(/\*\*Coverage:\*\*\s*([^\n]+)/u)?.[1]?.trim() ?? "coverage not declared";
  const hash = createHash("sha256").update(clean).digest("hex").slice(0, 24);
  const cutId = `editorial-cut:${hash}`;
  const proposalId = `journey-proposal:${hash}`;
  const records: VaultRecord[] = [
    { id: cutId, kind: "editorial-cut", capturedAt: importedAt, payload: { schemaVersion: 1, privacy: "private", canonical: false, reviewStatus: "pending", source: "author-supplied-editor-cut", title, coverage, importedAt, markdown: clean, factualImport: false, note: "This document remains an Editor proposal. It does not create or rewrite Moments." } },
    { id: proposalId, kind: "journey-proposal", capturedAt: importedAt, payload: { privacy: "private", canonical: false, reviewStatus: "pending", status: "editor-proposed", title: `${title} — macro-journey proposal`, coverage, sourceRecordId: cutId, noImplicitMomentCreation: true, tests: ["Review the Cut against authored corrections before accepting any relationship.", "This proposal does not make an Episode or establish causality."] } },
  ];
  putVaultRecords(vault, records);
  return { title, coverage, createdRecords: records.length, proposalId };
}

/** An unpublished editorial draft is its own private source. Unlike an Editor
 * Cut, importing it does not make a Journey proposal or alter authored facts. */
export function importPrivateEditorialDraft(vault: OpenVault, candidateId: string, markdown: string, importedAt = new Date().toISOString()) {
  const clean = markdown.trim();
  if (!clean) throw new Error("The private editorial draft was empty.");
  if (clean.length > 250_000) throw new Error("Choose a private editorial draft smaller than 250 KB.");
  const title = clean.match(/^#\s+(.+)$/mu)?.[1]?.trim().slice(0, 240) ?? "Untitled private editorial draft";
  const wordCount = clean.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
  const record: VaultRecord = {
    id: `editorial-draft:${candidateId}`, kind: "editorial-draft", capturedAt: importedAt,
    payload: { schemaVersion: 1, privacy: "private", canonical: false, source: "author-selected-private-editorial-draft", sourceCandidateId: candidateId, title, wordCount, publicationStatus: "unpublished", importedAt, markdown: clean, noEpisodeCreated: true, noJourneyProposalCreated: true, noPublicPromotion: true },
  };
  putVaultRecords(vault, [record]);
  return { id: record.id, title, wordCount };
}
export function readPublicDrafts(vault: OpenVault) {
  return readVaultRecords(vault)
    .filter((record) => record.kind === "public-draft")
    .map((record) => ({ id: record.id, capturedAt: record.capturedAt, payload: record.payload }))
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}
export function migrateRecoveryIntoVault(vault: OpenVault) {
  const recoveryPath = path.join(process.cwd(), "private-data", "storywalker", "july-august-2026.recovery.private.json"); const document = migrateStagedRecovery(JSON.parse(readFileSync(recoveryPath, "utf8")) as unknown);
  const baselinePath = path.join(VAULT_DIR, "spotify-baseline.private.json"); const baselineIds = existsSync(baselinePath) ? (JSON.parse(readFileSync(baselinePath, "utf8")) as { playlistIds?: unknown }).playlistIds : []; const playlistIds = Array.isArray(baselineIds) ? baselineIds.filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9]{22}$/u.test(id)) : []; const capturedAt = new Date().toISOString();
  const records: VaultRecord[] = [{ id: "recovery:current", kind: "recovery-document", capturedAt, payload: document }, ...document.moments.map((moment) => ({ id: `moment:${moment.id}`, kind: "moment" as const, capturedAt, payload: { moment, review: document.review[moment.id], relationshipOverride: document.relationshipOverrides[moment.id] ?? null, postImportEvidence: document.postImportEvidence.filter((item) => item.targetMomentIds.includes(moment.id)) } })), ...document.journeys.map((journey) => ({ id: `journey:${journey.id}`, kind: "journey" as const, capturedAt, payload: journey })), ...document.threads.map((thread, index) => ({ id: `thread:${index}:${thread.title}`, kind: "thread" as const, capturedAt, payload: thread })), ...document.playlistSources.map((playlist, index) => ({ id: `playlist-source:${index}:${playlist.spotifyPlaylistId}`, kind: "playlist-source" as const, capturedAt, payload: playlist })), ...playlistIds.map((spotifyPlaylistId) => ({ id: `spotify-baseline:${spotifyPlaylistId}`, kind: "reference" as const, capturedAt, payload: { source: "spotify-playlist", spotifyPlaylistId, privacy: "private", canonical: false, reviewStatus: "pending", importStatus: "awaiting-local-Spotify-authorisation" } }))];
  putVaultRecords(vault, records); return { moments: document.moments.length, journeys: document.journeys.length, threads: document.threads.length, playlistSources: document.playlistSources.length, baselinePlaylistSources: playlistIds.length, totalRecords: records.length };
}
