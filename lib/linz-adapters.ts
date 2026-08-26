import { z } from "zod";
import type { PublicContextAdapter, PublicContextRecord } from "@/lib/public-context";

const publicRecord = z.object({ id: z.string().min(1), sourceId: z.string().min(1), sourceLabel: z.string().min(1), title: z.string().min(1), fragment: z.string().min(1), licence: z.string().min(1), observedAt: z.string().datetime({ offset: true }).optional(), location: z.object({ label: z.string().min(1), latitude: z.number().finite().optional(), longitude: z.number().finite().optional(), precision: z.enum(["exact", "generalised", "unknown"]) }).optional() });

/** Validates public extracts before an adapter can expose them to a demo. */
export function publicContextAdapter(id: string, loadRecords: () => Promise<unknown[]>): PublicContextAdapter {
  return { id, async load() { return z.array(publicRecord).parse(await loadRecords()) as PublicContextRecord[]; } };
}

export function normaliseStreetName(name: string) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/straße/giu, "strasse").replace(/[^\p{L}\p{N}]/gu, "").toLocaleLowerCase("de-AT");
}

export type StreetJoin = { originalName: string; normalisedName: string; matchedId?: string; status: "matched" | "ambiguous" | "unmatched" };

/** Narrative street histories never manufacture geometry: only unique geolocated candidates join. */
export function joinStreetHistory(originalName: string, geolocated: Array<{ id: string; name: string }>): StreetJoin {
  const normalisedName = normaliseStreetName(originalName);
  const candidates = geolocated.filter((candidate) => normaliseStreetName(candidate.name) === normalisedName);
  if (candidates.length === 1) return { originalName, normalisedName, matchedId: candidates[0].id, status: "matched" };
  return { originalName, normalisedName, status: candidates.length ? "ambiguous" : "unmatched" };
}
