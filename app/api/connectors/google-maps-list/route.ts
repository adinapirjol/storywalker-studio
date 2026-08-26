import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const localPrefillSchema = z.object({ schemaVersion: z.literal(1), url: z.string().url().max(2_000) });
const PREFILL_PATH = path.join(process.cwd(), "private-data", "vault", "google-maps-list-prefill.private.json");

/** This endpoint reads an ignored local configuration file only. It does not
 * contact Google; the separate, consented import action is the first network read. */
export async function GET() {
  if (!existsSync(PREFILL_PATH)) return Response.json({ configured: false }, { headers: { "Cache-Control": "no-store" } });
  try {
    const configured = localPrefillSchema.parse(JSON.parse(readFileSync(PREFILL_PATH, "utf8")) as unknown);
    return Response.json({ configured: true, url: configured.url }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ configured: false }, { headers: { "Cache-Control": "no-store" } }); }
}
