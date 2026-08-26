import { afterEach, describe, expect, it, vi } from "vitest";
import { readLastFmScrobbles } from "@/lib/lastfm-server";

describe("readLastFmScrobbles", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads every page Last.fm reports for the selected window", async () => {
    const fetchMock = vi.fn(async (input: URL | string) => {
      const page = new URL(input.toString()).searchParams.get("page");
      return Response.json({ recenttracks: { track: [{ page }], "@attr": { totalPages: "3" } } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await readLastFmScrobbles({ LASTFM_API_KEY: "test-key" }, { username: "blunaoo", from: "2026-08-01T00:00:00.000Z", to: "2026-08-02T00:00:00.000Z" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.recenttracks.track).toHaveLength(3);
    expect(result.pagination).toEqual({ pagesRead: 3, totalPages: 3, complete: true });
  });

  it("fails rather than silently importing a partial window", async () => {
    const fetchMock = vi.fn(async (input: URL | string) => {
      const page = new URL(input.toString()).searchParams.get("page");
      return Response.json({ recenttracks: { track: page === "1" ? [{ page }] : [], "@attr": { totalPages: "2" } } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(readLastFmScrobbles({ LASTFM_API_KEY: "test-key" }, { username: "blunaoo", from: "2026-08-01T00:00:00.000Z", to: "2026-08-02T00:00:00.000Z" })).rejects.toThrow("before the selected window was complete");
  });
});
