import { describe, expect, it } from "vitest";
import {
  readFileSync,
  readdirSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { zipSync, strToU8 } from "fflate";
import { parseSleepXml, readHealthFile, timestamp } from "./apple-import";
import { baseline, changes, rolling, timeline } from "./analysis";
import { syntheticImport } from "./fixture";
import { clinicianReport } from "./report";
import type { Diary } from "./model";
const record = (
  start: string,
  end: string,
  value = "Asleep",
  source = "Fixture Watch",
) =>
  `<Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="${source}" startDate="${start}" endDate="${end}" value="HKCategoryValueSleepAnalysis${value}"/>`;
const wrap = (text: string) => `<HealthData>${text}</HealthData>`;
const night = record("2026-02-01 23:00:00 +0200", "2026-02-02 07:00:00 +0200");
const parsed = (text = night) => parseSleepXml(wrap(text)).records;
describe("Apple sleep boundary", () => {
  it("preserves raw offsets and source provenance; ignores unrelated sensitive attributes", () => {
    const r = parsed()[0];
    expect(r.startRaw).toBe("2026-02-01 23:00:00 +0200");
    expect(r.startOffset).toBe(120);
    const imported = parseSleepXml(
      wrap(
        night +
          '<Record type="HKQuantityTypeIdentifierHeartRate" value="SECRET"/>',
      ),
    );
    expect(imported.ignored).toBe(1);
    expect(JSON.stringify(imported)).not.toContain("SECRET");
  });
  it("deduplicates exact records but retains distinct source candidates", () => {
    const r = parseSleepXml(
      wrap(night + night + night.replace("Fixture Watch", "Second app")),
    );
    expect(r.records).toHaveLength(2);
    expect(r.duplicates).toBe(1);
  });
  it("rejects missing timezone, impossible dates, backwards records and malformed documents", () => {
    expect(timestamp("2026-02-30 20:00:00 +0200")).toBeNull();
    expect(timestamp("2026-02-01 20:00:00")).toBeNull();
    expect(
      parseSleepXml(
        wrap(record("2026-02-02 07:00:00 +0200", "2026-02-01 23:00:00 +0200")),
      ).invalid,
    ).toBe(1);
    expect(() => parseSleepXml("<HealthData><Record></HealthData>")).toThrow();
    expect(() =>
      parseSleepXml(
        '<!DOCTYPE HealthData [<!ENTITY x SYSTEM "file:///etc/passwd">]><HealthData/>',
      ),
    ).toThrow();
    expect(() =>
      parseSleepXml(
        "<!DOCTYPE HealthData [<!ELEMENT HealthData ANY>]><HealthData/>",
      ),
    ).not.toThrow();
  });
  it("streams XML and ZIP without extracting unrelated archive members", async () => {
    const xml = wrap(night);
    const data = zipSync({
      "apple_health_export/export.xml": strToU8(xml),
      "unrelated.txt": strToU8("PRIVATE_UNRELATED"),
    });
    const zipped = await readHealthFile(
      new File([new Uint8Array(data)], "export.zip"),
      new AbortController().signal,
    );
    expect(zipped.records).toHaveLength(1);
    expect(JSON.stringify(zipped)).not.toContain("PRIVATE_UNRELATED");
    expect(
      (
        await readHealthFile(
          new File([xml], "export.xml"),
          new AbortController().signal,
        )
      ).records,
    ).toHaveLength(1);
    const abort = new AbortController();
    abort.abort();
    await expect(
      readHealthFile(new File([xml], "export.xml"), abort.signal),
    ).rejects.toThrow();
    await expect(
      readHealthFile(
        new File(
          [
            new Uint8Array(
              zipSync({
                "a/export.xml": strToU8(xml),
                "b/export.xml": strToU8(xml),
              }),
            ),
          ],
          "export.zip",
        ),
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    await expect(
      readHealthFile(
        new File(["bad"], "export.zip"),
        new AbortController().signal,
      ),
    ).rejects.toThrow();
  });
});
describe("descriptive interval analysis", () => {
  it("unions generic/stage overlaps, distinguishes in-bed, and crosses midnight once", () => {
    const records = parsed(
      night +
        record(
          "2026-02-02 01:00:00 +0200",
          "2026-02-02 03:00:00 +0200",
          "AsleepDeep",
        ) +
        record(
          "2026-02-01 22:00:00 +0200",
          "2026-02-02 08:00:00 +0200",
          "InBed",
        ),
    );
    const n = timeline(records, "2026-02-02", "2026-02-02", 120, new Set())[0];
    expect(n.sleep).toBe(8);
    expect(n.total).toBe(8);
    expect(n.inBed).toBe(10);
    expect(n.onset).toBe("23:00");
    expect(n.waking).toBe("07:00");
  });
  it("flags contradictory awake/asleep evidence and noon-clipped bouts", () => {
    const rows = parsed(
      night +
        record(
          "2026-02-02 02:00:00 +0200",
          "2026-02-02 02:30:00 +0200",
          "Awake",
        ),
    );
    expect(
      timeline(rows, "2026-02-02", "2026-02-02", 120, new Set())[0].uncertain,
    ).toBe(true);
    const noon = parsed(
      record("2026-02-02 11:00:00 +0200", "2026-02-02 13:00:00 +0200"),
    );
    expect(
      timeline(noon, "2026-02-02", "2026-02-03", 120, new Set()).every(
        (n) => n.uncertain && n.sleep === 1,
      ),
    ).toBe(true);
  });
  it("keeps nap candidates distinct and missing nights unknown", () => {
    const rows = parsed(
      night + record("2026-02-01 14:00:00 +0200", "2026-02-01 14:30:00 +0200"),
    );
    const ns = timeline(rows, "2026-02-02", "2026-02-03", 120, new Set());
    expect(ns[0].naps).toBe(0.5);
    expect(ns[0].total).toBe(8.5);
    expect(ns[1].sleep).toBeNull();
    expect(ns[1].naps).toBeNull();
  });
  it("uses elapsed time through DST and flags offset changes/travel", () => {
    const rows = parsed(
      record("2026-10-25 01:00:00 +0300", "2026-10-25 07:00:00 +0200"),
    );
    const n = timeline(
      rows,
      "2026-10-25",
      "2026-10-25",
      120,
      new Set(["2026-10-25"]),
    )[0];
    expect(n.sleep).toBe(7);
    expect(n.uncertain).toBe(true);
    expect(baseline([n]).count).toBe(0);
  });
  it("does not manufacture a baseline or bridge gaps for sustained changes", () => {
    const data = syntheticImport().records;
    const dates = Array.from(
      { length: 28 },
      (_, i) => `2026-02-${String(i + 1).padStart(2, "0")}`,
    );
    const ns = timeline(data, "2026-02-01", "2026-02-28", 120, new Set(dates));
    expect(baseline(ns.slice(0, 6)).median).toBeNull();
    expect(baseline(ns.slice(0, 14)).median).toBe(8);
    expect(rolling(ns, 2).value).toBeNull();
    expect(rolling(ns, 6).n).toBe(7);
    const changed = changes(ns, 8, 1, 3);
    expect(changed.has("2026-02-23")).toBe(true);
    expect(changed.has("2026-02-24")).toBe(false);
    expect(changes(ns, null, 1, 3).size).toBe(0);
  });
});
describe("selected report and public boundaries", () => {
  it("exports only selected categories and dates, including entry provenance", () => {
    const nights = timeline(
      parsed(),
      "2026-02-02",
      "2026-02-03",
      120,
      new Set(),
    );
    const d = {
      id: "fictional",
      day: "2026-02-02",
      enteredAt: "2026-02-04T12:00:00Z",
      entryOffset: 120,
      mode: "retrospective",
      certainty: "low",
      ratings: {
        low: 1,
        elevated: "unknown",
        irritable: "skipped",
        energy: 2,
        sleepiness: 3,
        rested: 1,
        racing: "unknown",
      },
      medication: "PRIVATE_MEDICATION_SENTINEL",
      substances: "",
      illness: "",
      travel: "",
      stress: "",
      impulsivity: "",
      functioning: "",
      wantedMore: "yes",
      activity: "usual",
    } satisfies Diary;
    const input = {
      nights,
      reference: [],
      diary: [d],
      fields: ["mood"] as const,
      offset: 120,
      threshold: 1,
      sustained: 3,
      questions: "PRIVATE_QUESTION",
      synthetic: true,
    };
    const report = clinicianReport({ ...input, fields: ["mood"] });
    expect(report).not.toContain("PRIVATE_MEDICATION_SENTINEL");
    expect(report).not.toContain("PRIVATE_QUESTION");
    expect(report).toContain("retrospective");
    expect(report).toContain(d.enteredAt);
    expect(
      clinicianReport({ ...input, nights: [nights[1]], fields: ["context"] }),
    ).not.toContain("PRIVATE_MEDICATION_SENTINEL");
    expect(clinicianReport({ ...input, fields: [] })).toBe("");
    expect(clinicianReport({ ...input, fields: ["context"] })).toContain(
      "PRIVATE_MEDICATION_SENTINEL",
    );
  });
  it("rejects private input references in deployment artifacts without printing contents", () => {
    const root = mkdtempSync(join(tmpdir(), "health-audit-"));
    try {
      mkdirSync(join(root, ".next/static"), { recursive: true });
      writeFileSync(
        join(root, ".next/static/app.js"),
        "/* fictional public shell */",
      );
      writeFileSync(
        join(root, ".next/route.nft.json"),
        JSON.stringify({ files: ["../private-data/health/fictional.json"] }),
      );
      const audit = resolve("scripts/audit-build-private.mjs");
      expect(() =>
        execFileSync(process.execPath, [audit], {
          cwd: root,
          env: {
            ...process.env,
            STORYWALKER_REVIEW_BUILD: "0",
            STORYWALKER_AUDIT_BUILD_ROOT: root,
          },
          stdio: "pipe",
        }),
      ).toThrow(/private inputs are referenced/);
      writeFileSync(
        join(root, ".next/route.nft.json"),
        JSON.stringify({ files: ["../lib/health/model.ts"] }),
      );
      expect(
        execFileSync(process.execPath, [audit], {
          cwd: root,
          env: {
            ...process.env,
            STORYWALKER_REVIEW_BUILD: "0",
            STORYWALKER_AUDIT_BUILD_ROOT: root,
          },
          encoding: "utf8",
        }),
      ).toContain("Deployment trace audit passed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("keeps real file imports unavailable while synthetic preview remains available", () => {
    const panel = readFileSync("components/health/import-panel.tsx", "utf8");
    expect(panel).toMatch(/<input\s+type="file"[^>]*\sdisabled[\s>]/);
    // Removing disabled in developer tools must not expose a file-read handler.
    expect(panel).not.toContain("readHealthFile");
    expect(panel).not.toContain("files?.");
    expect(panel).toContain("offer(syntheticImport(), true)");
    expect(readFileSync("components/health/observatory.tsx", "utf8"))
      .toContain("Invented data · example mode");
  });
  it("keeps personal inputs untransported and permits only the synthetic archive and recovery clients", () => {
    const files = [
      ...readdirSync("components/health").map((f) => `components/health/${f}`),
      ...readdirSync("lib/health")
        .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
        .map((f) => `lib/health/${f}`),
    ];
    const archiveClients = ["components/health/archive-rehearsal.tsx", "components/health/archive-recovery.tsx"];
    for (const file of files.filter(f => !archiveClients.includes(f) && f !== "components/health/research-connection.tsx"))
      expect(readFileSync(file, "utf8")).not.toMatch(
        /\b(?:fetch|localStorage|sessionStorage|indexedDB|sendBeacon|console\.(?:log|error)|vaultFetch)\s*(?:\(|\.)/,
      );
    for (const file of archiveClients) {
      const client = readFileSync(file, "utf8");
      expect(client).toContain('vaultFetch("/api/health-rehearsal');
      expect(client).not.toMatch(/localStorage|sessionStorage|indexedDB|sendBeacon|\/server\//);
      expect(client).not.toMatch(/\bfetch\s*\(|console\.(?:log|error)/);
    }
    const researchClient = readFileSync("components/health/research-connection.tsx", "utf8");
    expect(researchClient).not.toMatch(/localStorage|sessionStorage|indexedDB|sendBeacon|console\.(?:log|error)|\/server\//);
    expect([...researchClient.matchAll(/(?:fetch|vaultFetch)\("([^"\n]+)/g)].map(m => m[1])).toEqual(["/api/health-research", "/api/health-research"]);
    expect(readFileSync("app/research/health/page.tsx", "utf8")).toContain(
      "index: false",
    );
    expect(readFileSync("components/health/study.css", "utf8")).toContain(
      "@media print",
    );
    const ignored = execFileSync(
      "git",
      [
        "check-ignore",
        "export.xml",
        "export.zip",
        "private-data/health/observations.json",
        "storywalker-health-summary.private.txt",
      ],
      { encoding: "utf8" },
    );
    expect(ignored.trim().split("\n")).toHaveLength(4);
    const publicSources = execFileSync(
      "rg",
      ["-l", "lib/health|components/health", "app", "components"],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n");
    expect(
      publicSources.every(
        (p) =>
          p.startsWith("components/health/") ||
          p === "app/research/health/page.tsx" ||
          p === "app/api/health-rehearsal/route.ts" || p === "app/api/health-research/route.ts",
      ),
    ).toBe(true);
  });
});

describe("combined sleep sources", () => {
  const analyse = (xml: string) => timeline(parsed(xml), "2026-02-02", "2026-02-03", 120, new Set(["2026-02-02", "2026-02-03"]));
  it("unions duplicate generic and staged coverage without losing provenance", () => {
    const rows = night + record("2026-02-01 23:00:00 +0200", "2026-02-02 03:00:00 +0200", "AsleepCore", "Other") + record("2026-02-02 03:00:00 +0200", "2026-02-02 07:00:00 +0200", "AsleepREM", "Other");
    expect(parsed(rows)).toHaveLength(3);
    expect(analyse(rows)[0]).toMatchObject({ sleep: 8, total: 8, uncertain: false });
    expect(analyse(rows)[1].sleep).toBeNull();
  });
  it("flags partially overlapping source estimates and awake contradictions", () => {
    expect(analyse(night + record("2026-02-02 00:00:00 +0200", "2026-02-02 08:00:00 +0200", "Asleep", "Other"))[0]).toMatchObject({ total: 9, uncertain: true, uncertaintyReasons: ["Sleep sources report different overlapping coverage"] });
    expect(analyse(night + record("2026-02-02 02:00:00 +0200", "2026-02-02 03:00:00 +0200", "Awake", "Other"))[0].uncertain).toBe(true);
  });
  it("combines separate nights and naps without flagging different source names", () => {
    const rows = night + record("2026-02-01 15:00:00 +0200", "2026-02-01 16:00:00 +0200", "Asleep", "Other") + record("2026-02-02 23:00:00 +0200", "2026-02-03 07:00:00 +0200", "Asleep", "Other");
    expect(analyse(rows)[0]).toMatchObject({ sleep: 8, total: 9, naps: 1, uncertain: false });
    expect(analyse(rows)[1]).toMatchObject({ sleep: 8, uncertain: false });
  });
  it("preserves timezone uncertainty across sources", () => {
    expect(analyse(night + record("2026-02-02 00:00:00 +0300", "2026-02-02 08:00:00 +0300", "Asleep", "Other"))[0]).toMatchObject({ total: 8, uncertain: true, uncertaintyReasons: ["Original timezone offsets differ from the grouping offset"] });
  });
});
