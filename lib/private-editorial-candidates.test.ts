import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { privateEditorialCandidates, readPrivateEditorialCandidate } from "@/lib/private-editorial-candidates";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("private editorial candidates", () => {
  it("lists Markdown metadata only and reads a file only after its candidate is selected", () => {
    const root = mkdtempSync(path.join(tmpdir(), "storywalker-editorial-candidates-"));
    temporaryRoots.push(root);
    mkdirSync(path.join(root, "nested"));
    const firstDraft = path.join(root, "draft.md"); const newerDraft = path.join(root, "nested", "another.md");
    writeFileSync(firstDraft, "# Private draft\n\nUnpublished words.");
    writeFileSync(newerDraft, "# Another draft");
    // Filesystems differ in timestamp granularity. Set the ordering signal
    // explicitly so this test verifies recency rather than directory order.
    utimesSync(firstDraft, new Date("2026-01-01T00:00:00.000Z"), new Date("2026-01-01T00:00:00.000Z"));
    utimesSync(newerDraft, new Date("2026-01-02T00:00:00.000Z"), new Date("2026-01-02T00:00:00.000Z"));
    writeFileSync(path.join(root, "not-a-draft.txt"), "ignored");

    const candidates = privateEditorialCandidates([root]);
    expect(candidates.map((candidate) => candidate.label)).toEqual(["public-voice/drafts/nested/another.md", "public-voice/drafts/draft.md"]);
    expect(candidates.map((candidate) => Object.keys(candidate).sort())).toEqual([
      ["bytes", "id", "label", "modifiedAt"],
      ["bytes", "id", "label", "modifiedAt"],
    ]);

    expect(readPrivateEditorialCandidate(candidates[1].id, [root]).markdown).toContain("Unpublished words.");
  });

  it("uses the label as a stable tie-breaker for files with the same modification time", () => {
    const root = mkdtempSync(path.join(tmpdir(), "storywalker-editorial-candidates-"));
    temporaryRoots.push(root);
    const firstDraft = path.join(root, "draft.md"); const secondDraft = path.join(root, "nested.md"); const sameTime = new Date("2026-01-01T00:00:00.000Z");
    writeFileSync(firstDraft, "# First"); writeFileSync(secondDraft, "# Second");
    utimesSync(firstDraft, sameTime, sameTime); utimesSync(secondDraft, sameTime, sameTime);

    expect(privateEditorialCandidates([root]).map((candidate) => candidate.label)).toEqual(["public-voice/drafts/draft.md", "public-voice/drafts/nested.md"]);
  });

  it("refuses a candidate that is no longer in the selected folder", () => {
    const root = mkdtempSync(path.join(tmpdir(), "storywalker-editorial-candidates-"));
    temporaryRoots.push(root);
    expect(() => readPrivateEditorialCandidate("a".repeat(24), [root])).toThrow("no longer available");
  });
});
