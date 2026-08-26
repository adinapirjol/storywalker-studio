import { describe, expect, it } from "vitest";
import { localSpotifyReturnUrl } from "@/lib/spotify-server";

describe("localSpotifyReturnUrl", () => {
  const fallback = new URL("http://127.0.0.1:3001/vault");

  it("preserves a localhost return after a callback on 127.0.0.1", () => {
    expect(localSpotifyReturnUrl("http://localhost:3001/vault?from=spotify", fallback, "3001"))
      .toBe("http://localhost:3001/vault?from=spotify");
  });

  it("refuses an external or wrong-port return target", () => {
    expect(localSpotifyReturnUrl("https://example.com/elsewhere", fallback, "3001"))
      .toBe(fallback.toString());
    expect(localSpotifyReturnUrl("http://localhost:3999/vault", fallback, "3001"))
      .toBe(fallback.toString());
  });
});
