import { describe, expect, it, vi } from "vitest";
import { normaliseArenaContents, safeArenaUrl, safeEmbed, selectedConnections } from "./arena";
import { buildArenaSnapshot } from "./arena-build";

const block = (id: number, position: number, extra = {}) => ({ id, type: "Text", title: "Reference", visibility: "public", state: "available", content: { plain: "Source words", html: "<script>bad()</script>" }, connection: { position, connected_at: "2026-09-11T00:00:00Z" }, ...extra });
const contents = (data: unknown[]) => ({ data, meta: { total_count: data.length } });
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

describe("Are.na public reader boundary", () => {
  it("preserves author order and timestamps without rendering source HTML or private entries", () => {
    const result = normaliseArenaContents(contents([block(2, 4), block(1, 2), block(3, 1, { visibility: "private" }), block(4, 5, { state: "deleted" })]));
    expect(result.fragments.map((item) => item.id)).toEqual([1, 2]);
    expect(result.fragments[0].connectedAt).toBe("2026-09-11T00:00:00Z");
    expect(JSON.stringify(result)).not.toContain("script");
  });
  it("normalises images, attachments and forks using v3 fields", () => {
    const result = normaliseArenaContents(contents([
      block(1, 1, { type: "Image", image: { medium: { src: "https://example.com/image.jpg" }, alt_text: "Original alt" } }),
      block(2, 2, { type: "Attachment", attachment: { url: "https://example.com/audio.mp3", content_type: "audio/mpeg" } }),
      block(3, 3, { type: "Channel", slug: "branch" }),
    ]));
    expect(result.fragments[0]).toMatchObject({ image: "https://example.com/image.jpg", alt: "Original alt" });
    expect(result.fragments[1].mediaType).toBe("audio");
    expect(result.fragments[2].branchSlug).toBe("branch");
  });
  it("rejects unsafe URLs and arbitrary embeds", () => {
    expect(safeArenaUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeArenaUrl("https://token@example.com")).toBeUndefined();
    expect(safeEmbed("https://evil.example/embed/1")).toBeUndefined();
    expect(safeEmbed("https://www.youtube.com/embed/abc?autoplay=1")).toBe("https://www.youtube.com/embed/abc");
  });
  it("caps responses at seven and fails on malformed provenance", () => {
    expect(() => normaliseArenaContents(contents(Array.from({ length: 8 }, (_, index) => block(index, index))))).toThrow();
    expect(() => normaliseArenaContents(contents([{ ...block(1, 1), connection: null }]))).toThrow();
  });
  it("fetches only the two selected first pages and sends no token by default", async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async (url) => String(url).includes("contents?") ? response(contents([block(1, 1)])) : response({ visibility: "closed", state: "available" }));
    const snapshot = await buildArenaSnapshot(request);
    expect(request).toHaveBeenCalledTimes(4);
    expect(request.mock.calls.filter(([url]) => String(url).includes("contents?")).every(([url]) => String(url).endsWith("per=7&page=1&sort=position_asc"))).toBe(true);
    expect(request.mock.calls.every(([, options]) => !(options?.headers as Record<string, string>).Authorization)).toBe(true);
    expect(selectedConnections(snapshot, 1)).toBe(2);
  });
  it("excludes private channels even with authenticated build access", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response({ visibility: "private", state: "available" }));
    const snapshot = await buildArenaSnapshot(request, "test-only-token");
    expect(snapshot.channels.every((channel) => channel.status === "unavailable" && channel.fragments.length === 0)).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(snapshot)).not.toContain("test-only-token");
  });
  it("keeps a healthy channel when the other fails and never retries rate limits", async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async (url) => String(url).includes("13a-forever") ? response({}, 429) : String(url).includes("contents?") ? response(contents([])) : response({ visibility: "public", state: "available" }));
    const snapshot = await buildArenaSnapshot(request);
    expect(snapshot.channels.map((channel) => channel.status)).toEqual(["unavailable", "ready"]);
    expect(request).toHaveBeenCalledTimes(3);
  });
});
