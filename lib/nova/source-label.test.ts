import { expect, it } from "vitest";
import { sourceLabel } from "./source-label";
it("shows capture title, stated date and planned status without exposing the note body", () => {
  const header = { id: "capture:fixture", kind: "capture" as const };
  const label = sourceLabel(header, { ...header, capturedAt: "2026-01-03T12:00:00Z", payload: { title: "Fictional sound workshop", kind: "event", status: "planned", when: "February 2026", evidence: "PRIVATE-BODY-CANARY" } });
  expect(label.title).toBe("Fictional sound workshop");
  expect(label.description).toContain("Planned"); expect(label.description).toContain("February 2026");
  expect(JSON.stringify(label)).not.toContain("PRIVATE-BODY-CANARY");
});
it("does not invent titles or substitute save time for missing event dates", () => {
  expect(sourceLabel({ id: "capture:fixture", kind: "capture" })).toEqual({ title: "Untitled saved note", description: "Your saved note · Event date not recorded" });
});
it("explains imported histories without needing to read their contents", () => {
  expect(sourceLabel({ id: "import:lastfm-history:v1", kind: "import" }).title).toBe("Last.fm listening history");
  expect(sourceLabel({ id: "import:spotify-history:v1", kind: "import" }).description).toContain("not your saved playlists");
});
it("does not call an unread record untitled", () => {
  expect(sourceLabel({ id: "research-session:fixture", kind: "capture" }).title).toBe("Research snapshot");
  expect(sourceLabel({ id: "other:fixture", kind: "capture" }).title).toBe("Other saved record");
});
