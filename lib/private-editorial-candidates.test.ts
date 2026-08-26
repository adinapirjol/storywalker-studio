import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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
    writeFileSync(path.join(root, "draft.md"), "# Private draft\n\nUnpublished words.");
    writeFileSync(path.join(root, "nested", "another.md"), "# Another draft");
    writeFileSync(path.join(root, "not-a-draft.txt"), "ignored");

    const candidates = privateEditorialCandidates([root]);
    expect(candidates.map((candidate) => candidate.label)).toEqual(["public-voice/drafts/nested/another.md", "public-voice/drafts/draft.md"]);
    expect(candidates.map((candidate) => Object.keys(candidate).sort())).toEqual([
      ["bytes", "id", "label", "modifiedAt"],
      ["bytes", "id", "label", "modifiedAt"],
    ]);

    expect(readPrivateEditorialCandidate(candidates[1].id, [root]).markdown).toContain("Unpublished words.");
  });

  it("refuses a candidate that is no longer in the selected folder", () => {
    const root = mkdtempSync(path.join(tmpdir(), "storywalker-editorial-candidates-"));
    temporaryRoots.push(root);
    expect(() => readPrivateEditorialCandidate("a".repeat(24), [root])).toThrow("no longer available");
  });
});
