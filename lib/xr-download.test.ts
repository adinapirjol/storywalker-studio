import { expect, it } from "vitest";
import { POST } from "../app/api/xr/download/route";
import { DEMO_XR_SCENE, parseSceneFile, reviewExport } from "./xr-scene";
it("returns a reloadable attachment with the selected decisions", async () => {
  const response = await POST(new Request("http://localhost/api/xr/download", { method: "POST", headers: { Origin: "http://localhost" }, body: new URLSearchParams({ scene: JSON.stringify(reviewExport(DEMO_XR_SCENE, { listening: "accepted", screen: "refused" })) }) }));
  expect(response.status).toBe(200); expect(response.headers.get("Content-Disposition")).toContain("attachment;");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  const parsed = parseSceneFile(await response.json());
  expect(parsed.decisions.listening).toBe("accepted"); expect(parsed.decisions.screen).toBe("refused");
});
it("rejects cross-origin export requests", async () => {
  const response = await POST(new Request("http://localhost/api/xr/download", { method: "POST", headers: { Origin: "http://elsewhere" }, body: "scene={}" }));
  expect(response.status).toBe(403);
});
