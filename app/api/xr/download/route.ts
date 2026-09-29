import { parseSceneFile, reviewExport } from "@/lib/xr-scene";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns only the client-selected scene; never reads or stores Vault data.
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response("Use the scene download control.", { status: 403 });
  const text = await request.text();
  if (text.length > 60_000_000) return new Response("Scene file is too large.", { status: 413 });
  try {
    const source = new URLSearchParams(text).get("scene");
    if (!source || source.length > 10_000_000) return new Response("Invalid scene file size.", { status: 400 });
    const parsed = parseSceneFile(JSON.parse(source));
    const filename = `${parsed.scene.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "storywalker"}-scene.json`;
    return new Response(JSON.stringify({ ...reviewExport(parsed.scene, parsed.decisions), activated: false }, null, 2), { headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch { return new Response("Invalid scene file.", { status: 400, headers: { "Cache-Control": "no-store" } }); }
}
