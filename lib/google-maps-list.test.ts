import { describe, expect, it } from "vitest";
import { minimiseGoogleMapsSavedListCsv, minimiseGoogleMapsSavedListsCsv, minimiseGoogleMapsSharedListHtml, validateGoogleMapsListUrl } from "@/lib/google-maps-list";

describe("Google Maps shared-list minimiser", () => {
  it("retains only the structured places and discards list identity", () => {
    const html = `<!doctype html><meta property="og:title" content="A selected list - Google Maps"><script type="application/ld+json">{"@context":"https://schema.org","@type":"ItemList","itemListElement":[{"@type":"ListItem","item":{"@type":"Place","name":"Example place","address":"Example address","geo":{"latitude":44.4,"longitude":26.1}}},{"@type":"ListItem","item":{"@type":"Place","name":"Example place","address":"Example address"}}]}</script>`;
    const result = minimiseGoogleMapsSharedListHtml(html, "2026-08-26T12:00:00.000Z");
    expect(result.document).toMatchObject({ source: "google-maps-shared-list", listTitle: "A selected list", records: [{ kind: "saved-list-place", label: "Example place", address: "Example address", latitude: 44.4, longitude: 26.1 }] });
    expect(result.summary.discardedFields).toContain("shared URL");
    expect(JSON.stringify(result.document)).not.toContain("schema.org");
  });

  it("accepts a shared Google Maps host and rejects unrelated URLs", () => {
    expect(validateGoogleMapsListUrl("https://maps.app.goo.gl/example")).toContain("maps.app.goo.gl");
    expect(() => validateGoogleMapsListUrl("https://example.com/list")).toThrow("shared Google Maps link");
  });

  it("minimises one selected Takeout Saved CSV without retaining place URLs or comments", () => {
    const result = minimiseGoogleMapsSavedListCsv('Title,URL,Comment\n"Example place","https://maps.google.com/private-id","personal note"\n"Example place","https://maps.google.com/duplicate","other"\n', "2026-08-26T12:00:00.000Z");
    expect(result.document).toMatchObject({ source: "google-maps-takeout-saved-list", records: [{ label: "Example place" }] });
    expect(result.summary.retained).toBe(1);
    expect(JSON.stringify(result.document)).not.toContain("private-id");
    expect(JSON.stringify(result.document)).not.toContain("personal note");
  });

  it("minimises a complete Saved export without retaining filenames, memberships, URLs, or comments", () => {
    const result = minimiseGoogleMapsSavedListsCsv([
      'Title,URL,Comment\n"Shared place","https://maps.google.com/private-id","note"\n',
      'Title,URL,Comment\n"Shared place","https://maps.google.com/duplicate","other"\n"Another place","https://maps.google.com/another","also private"\n',
    ], "2026-08-27T00:00:00.000Z");
    expect(result.document).toMatchObject({ source: "google-maps-takeout-saved-lists", records: [{ label: "Shared place" }, { label: "Another place" }] });
    expect(result.summary).toMatchObject({ total: 3, retained: 2 });
    expect(JSON.stringify(result.document)).not.toContain("private-id");
    expect(JSON.stringify(result.summary.discardedFields)).toContain("list filenames and list names");
  });
});
