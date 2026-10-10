import {isLocalRead} from '@/lib/local-origin';
import { lastFmEnvironmentSchema } from "@/lib/lastfm-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A configuration-only probe. It deliberately exposes no key material and
 * makes no request to Last.fm. */
export async function GET(request:Request) {
  if(!isLocalRead(request))return Response.json({code:"LOCAL_ORIGIN_REQUIRED"},{status:403});
  return Response.json({
    connector: "lastfm",
    configured: lastFmEnvironmentSchema.safeParse(process.env).success,
    mode: "selected-window-only",
  }, { headers: { "Cache-Control": "no-store" } });
}
