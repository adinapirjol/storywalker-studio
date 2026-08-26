import { z } from "zod";

const offset = z.string().datetime({ offset: true });

export const minimisedGoogleMapsListSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal("google-maps-shared-list"),
  importedAt: offset,
  listTitle: z.string().min(1).max(500).optional(),
  records: z.array(z.object({
    kind: z.literal("saved-list-place"),
    label: z.string().min(1).max(500),
    address: z.string().min(1).max(1_500).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    importerProvenance: z.string(),
  })),
});

export const minimisedGoogleMapsSavedListSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal("google-maps-takeout-saved-list"),
  importedAt: offset,
  records: minimisedGoogleMapsListSchema.shape.records,
});

export const minimisedGoogleMapsSavedListsSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal("google-maps-takeout-saved-lists"),
  importedAt: offset,
  records: minimisedGoogleMapsListSchema.shape.records,
});

export type GoogleMapsListSummary = { total: number; retained: number; discardedFields: string[]; warnings: string[] };

function decodeHtml(value: string) { return value.replace(/<[^>]*>/gu, " ").replace(/&amp;/gu, "&").replace(/&quot;/gu, '"').replace(/&#39;|&apos;/gu, "'").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/\s+/gu, " ").trim(); }
function clean(value: unknown, maximum: number) { return typeof value === "string" ? decodeHtml(value).trim().slice(0, maximum) : ""; }
function coordinates(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>; const latitude = Number(row.latitude ?? row.lat); const longitude = Number(row.longitude ?? row.lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 ? { latitude, longitude } : {};
}

/** The adapter accepts only a deliberately shared Google Maps link. Its remote
 * response stays in memory just long enough to minimise it; neither the URL,
 * list identifier, raw HTML, account data, photos nor reviews are retained. */
export function validateGoogleMapsListUrl(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLocaleLowerCase();
  if (!(host === "maps.app.goo.gl" || host === "www.google.com" || host === "google.com" || host.endsWith(".google.com"))) throw new Error("Use a shared Google Maps link. The Vault will not fetch another site.");
  return url.toString();
}

function meta(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "iu")) ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "iu"));
  return clean(match?.[1], 1_500);
}

/** JSON-LD is the stable, intentionally exposed representation used when a
 * shared Maps list presents individual places. We do not scrape incidental
 * page text or infer a place from a map tile. If no ItemList exists, the user
 * receives a clear retry/error instead of an invented import. */
function jsonLdItems(html: string) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu)];
  const parsed = scripts.flatMap((script) => { try { return [JSON.parse(script[1]) as unknown]; } catch { return []; } });
  const values: unknown[] = [];
  const visit = (value: unknown, depth = 0) => {
    if (depth > 8 || !value) return;
    if (Array.isArray(value)) { value.forEach((item) => visit(item, depth + 1)); return; }
    if (typeof value !== "object") return;
    const row = value as Record<string, unknown>;
    if (row["@type"] === "ItemList" && Array.isArray(row.itemListElement)) values.push(...row.itemListElement);
    if (Array.isArray(row["@graph"])) row["@graph"].forEach((item) => visit(item, depth + 1));
  };
  parsed.forEach((value) => visit(value));
  return values;
}

export function minimiseGoogleMapsSharedListHtml(html: string, importedAt = new Date().toISOString()) {
  const items = jsonLdItems(html);
  const seen = new Set<string>();
  const records = items.flatMap((raw) => {
    const wrapper = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const item = wrapper.item && typeof wrapper.item === "object" && !Array.isArray(wrapper.item) ? wrapper.item as Record<string, unknown> : wrapper;
    const label = clean(item.name ?? wrapper.name, 500); const address = clean(item.address ?? wrapper.address, 1_500);
    const key = `${label.toLocaleLowerCase()}|${address.toLocaleLowerCase()}`;
    if (!label || seen.has(key)) return [];
    seen.add(key);
    return [{ kind: "saved-list-place" as const, label, ...(address ? { address } : {}), ...coordinates(item.geo ?? item), importerProvenance: "google-maps-shared-list minimiser v1" }];
  });
  const listTitle = meta(html, "og:title").replace(/\s*-\s*Google Maps$/iu, "").slice(0, 500);
  const document = minimisedGoogleMapsListSchema.parse({ schemaVersion: 1, source: "google-maps-shared-list", importedAt, ...(listTitle ? { listTitle } : {}), records });
  const summary: GoogleMapsListSummary = {
    total: items.length, retained: records.length,
    discardedFields: ["shared URL", "list ID", "raw page HTML", "account metadata", "photos", "reviews", "directions", "Google tracking parameters"],
    warnings: records.length ? ["List membership establishes a saved source place only; it does not establish a visit, future plan, route, priority, or meaning."] : ["This shared list did not expose an importable structured ItemList. Nothing was written to the Vault."],
  };
  return { document, summary };
}

function csvRows(content: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index]!;
    if (quoted) { if (character === '"' && content[index + 1] === '"') { cell += '"'; index += 1; } else if (character === '"') quoted = false; else cell += character; continue; }
    if (character === '"') { quoted = true; continue; }
    if (character === ",") { row.push(cell.trim()); cell = ""; continue; }
    if (character === "\n") { row.push(cell.trim()); rows.push(row); row = []; cell = ""; continue; }
    if (character !== "\r") cell += character;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows.filter((entry) => entry.some(Boolean));
}

/** Google’s supported Saved-list export is a local Takeout CSV. This adapter
 * imports one author-selected file only; its URLs, comments, list metadata and
 * account information are deliberately discarded. */
export function minimiseGoogleMapsSavedListCsv(content: string, importedAt = new Date().toISOString()) {
  const rows = csvRows(content);
  const headers = (rows[0] ?? []).map((header) => header.toLocaleLowerCase().replace(/[^a-z]/gu, ""));
  const titleColumn = headers.findIndex((header) => ["title", "name", "place", "placename"].includes(header));
  const data = titleColumn >= 0 ? rows.slice(1) : [];
  const seen = new Set<string>();
  const records = data.flatMap((row) => {
    const label = clean(row[titleColumn], 500); const key = label.toLocaleLowerCase();
    if (!label || seen.has(key)) return [];
    seen.add(key);
    return [{ kind: "saved-list-place" as const, label, importerProvenance: "google-maps-takeout Saved CSV minimiser v1" }];
  });
  const document = minimisedGoogleMapsSavedListSchema.parse({ schemaVersion: 1, source: "google-maps-takeout-saved-list", importedAt, records });
  const summary: GoogleMapsListSummary = {
    total: data.length, retained: records.length,
    discardedFields: ["Google Maps URLs", "list name", "comments", "list ID", "account metadata", "photos", "reviews", "directions"],
    warnings: records.length ? ["List membership establishes a saved source place only; it does not establish a visit, future plan, route, priority, or meaning."] : ["No Title or Name column with saved places was found in this selected CSV. Nothing was written to the Vault."],
  };
  return { document, summary };
}

/** Minimises a complete Takeout Saved export. List filenames and memberships
 * are intentionally discarded: it records only that a deduplicated place was
 * saved somewhere in the selected Takeout source, never a trip or intention. */
export function minimiseGoogleMapsSavedListsCsv(contents: string[], importedAt = new Date().toISOString()) {
  const perList = contents.map((content) => minimiseGoogleMapsSavedListCsv(content, importedAt));
  const seen = new Set<string>();
  const records = perList.flatMap((item) => item.document.records).filter((record) => {
    const key = record.label.toLocaleLowerCase(); if (seen.has(key)) return false; seen.add(key); return true;
  });
  const document = minimisedGoogleMapsSavedListsSchema.parse({ schemaVersion: 1, source: "google-maps-takeout-saved-lists", importedAt, records });
  const summary: GoogleMapsListSummary = {
    total: perList.reduce((count, item) => count + item.summary.total, 0), retained: records.length,
    discardedFields: ["Google Maps URLs", "comments", "list filenames and list names", "list membership", "list IDs", "account metadata", "photos", "reviews", "directions"],
    warnings: records.length ? ["A place was saved somewhere in this selected Takeout export; this does not establish a visit, future plan, route, priority, or meaning."] : ["No Title or Name column with saved places was found in the selected Saved export. Nothing was prepared."],
  };
  return { document, summary };
}
