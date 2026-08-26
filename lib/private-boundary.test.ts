import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public/private research boundary", () => {
  it("ignores the private research and playlist locations", () => {
    const ignore = readFileSync(".gitignore", "utf8");
    expect(ignore).toContain("/private-data/");
    expect(ignore).toContain("**/*.private.json");
    expect(ignore).toContain("/private-google-timeline-raw/");
  });

  it("does not put raw import fields in browser-facing Linz fixtures", () => {
    const fixture = readFileSync("lib/linz-experiment.ts", "utf8");
    expect(fixture).not.toContain("ip_addr");
    expect(fixture).not.toContain("user_agent");
  });

  it("keeps CTM research fixtures public and fictional", () => {
    const tracker = readFileSync("docs/research/ctm-2027/tracker.md", "utf8");
    const templates = readFileSync("docs/research/ctm-2027/templates.md", "utf8");
    expect(tracker).toContain("Confirmed call facts");
    expect(tracker).toContain("Working inferences");
    expect(templates).toContain("What this does *not* establish");
  });
});
