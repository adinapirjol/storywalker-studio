import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

// Invented occurrence metadata only. Never read the Author's exports.
const directories: string[] = [];
const script = path.resolve("scripts/spotify-snapshot-diff.py");
const row = (position: number, trackId: string | null = "fictional-track-a") => ({
  position, trackId, playlistId: "fictional-playlist",
  addedAt: "2026-01-01T10:00:00Z", addedAtUtc: "2026-01-01T10:00:00+00:00",
  addedAtLocal: "2026-01-01T12:00:00+02:00", spotifyUrl: null,
  trackName: "Invented Aurora sound", artistNames: ["Fictional artist"],
  albumName: "Fictional album", isLocal: false,
});
const snapshot = (occurrences: ReturnType<typeof row>[]) => ({
  metadata: { playlistId: "fictional-playlist" }, occurrences,
});

function fixture(before: unknown, after: unknown) {
  const directory = mkdtempSync(path.join(tmpdir(), "fictional-spotify-diff-"));
  directories.push(directory);
  const inputs = [path.join(directory, "before.private.json"), path.join(directory, "after.private.json")];
  [before, after].forEach((value, index) => writeFileSync(inputs[index], JSON.stringify(value)));
  const output = path.join(directory, "diff.private.json");
  const run = (destination = output) => spawnSync("python3", [script, ...inputs, destination], { encoding: "utf8", timeout: 10_000 });
  return { inputs, output, run, read: () => JSON.parse(readFileSync(output, "utf8")) };
}

afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe("private Spotify snapshot comparison", () => {
  it("preserves duplicate occurrences and reports ambiguous pairing", () => {
    const f = fixture(snapshot([row(0), row(1)]), snapshot([row(0)]));
    expect(f.run().status).toBe(0);
    const result = f.read();
    expect(result.summary).toMatchObject({ retainedOccurrenceCount: 1, removedOccurrenceCount: 1, beforeDuplicateOccurrenceCount: 1 });
    expect(result.removedOccurrences[0].position).toBe(1);
    expect(result.diagnostics.ambiguousIdentityGroups).toEqual([{ beforePositions: [0, 1], afterPositions: [0], matchedCount: 1 }]);
  });

  it("matches equivalent UTC instants and distinguishes metadata from position changes", () => {
    const later = { ...row(1), addedAt: "2026-01-01T12:00:00+02:00", trackName: "Revised fictional title" };
    const f = fixture(snapshot([row(0)]), snapshot([row(0, "fictional-track-b"), later]));
    expect(f.run().status).toBe(0);
    expect(f.read().retainedOccurrences[0]).toMatchObject({ beforePosition: 0, afterPosition: 1, positionChanged: true, metadataChangedFields: ["trackName"] });
    expect(f.read().summary.addedOccurrenceCount).toBe(1);
  });

  it("retains unavailable items and missing timestamps with explicit diagnostics", () => {
    const missing = { ...row(0, null), addedAt: null, addedAtUtc: null, addedAtLocal: null };
    const data = { metadata: { playlistId: "fictional-playlist" }, occurrences: [missing] };
    const f = fixture(data, data);
    expect(f.run().status).toBe(0);
    expect(f.read().summary).toMatchObject({ retainedOccurrenceCount: 1, beforeMissingTimestampCount: 1 });
    expect(f.read().diagnostics.beforeFallbackIdentityPositions).toEqual([0]);
  });

  it.each([
    { ...row(0), playlistId: "fictional-other-playlist" },
    { ...row(0), position: 2 },
    { ...row(0), addedAtUtc: "2026-01-02T10:00:00Z" },
    { ...row(0), addedAt: "2026-01-01T10:00:00" },
  ])("rejects inconsistent source metadata before creating output", (invalid) => {
    const f = fixture(snapshot([row(0)]), snapshot([invalid]));
    expect(f.run().status).not.toBe(0);
    expect(() => statSync(f.output)).toThrow();
  });

  it("writes deterministic private output without overwriting inputs or an existing result", () => {
    const f = fixture(snapshot([row(0)]), snapshot([row(0), row(1, "fictional-track-b")]));
    const sourceBytes = f.inputs.map((input) => readFileSync(input));
    const first = f.run();
    expect(first.status).toBe(0);
    const bytes = readFileSync(f.output);
    expect(statSync(f.output).mode & 0o777).toBe(0o600);
    expect(f.run(`${f.output}.copy`).status).toBe(0);
    expect(readFileSync(`${f.output}.copy`)).toEqual(bytes);
    expect(f.run().status).not.toBe(0);
    expect(f.run(f.inputs[0]).status).not.toBe(0);
    expect(readFileSync(f.output)).toEqual(bytes);
    expect(f.inputs.map((input) => readFileSync(input))).toEqual(sourceBytes);
    expect(JSON.parse(first.stdout)).toEqual(f.read().summary);
    expect(first.stdout).not.toContain("fictional-track");
    expect(first.stdout).not.toContain("Invented Aurora sound");
  });
});
