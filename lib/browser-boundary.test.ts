import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("browser credential boundary", () => {
  it("does not reference Spotify credentials or server importer code in browser modules", () => {
    const files = [
      ...globSync("app/**/*.{ts,tsx}"),
      ...globSync("components/**/*.{ts,tsx}"),
      ...globSync("lib/**/*.{ts,tsx}").filter(
        (file) => !file.includes("spotify") && !file.endsWith(".test.ts"),
      ),
    ];
    const browserSource = files.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(browserSource).not.toMatch(/SPOTIFY_CLIENT_(?:ID|SECRET)/u);
    expect(browserSource).not.toMatch(/spotify-token\.local/u);
    expect(browserSource).not.toMatch(/scripts\/spotify/u);
    expect(browserSource).not.toMatch(/NEXT_PUBLIC_SPOTIFY/u);
  });
});
