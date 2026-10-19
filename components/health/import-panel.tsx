"use client";
import { useState } from "react";
import type { ImportResult } from "@/lib/health/apple-import";
import { syntheticImport } from "@/lib/health/fixture";
import { timeline } from "@/lib/health/analysis";
import {
  HOUR,
  dayKey,
  dates,
  sourceKey,
  type SleepRecord,
} from "@/lib/health/model";
export function ImportPanel({
  onSave,
}: {
  onSave: (
    records: SleepRecord[],
    from: string,
    to: string,
    offset: number,
    synthetic: boolean,
  ) => void;
}) {
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [source, setSource] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [offset, setOffset] = useState(0),
    [synthetic, setSynthetic] = useState(false);
  const [message, setMessage] = useState("");
  function offer(result: ImportResult, demo: boolean) {
    setPreview(result);
    setSynthetic(demo);
    setSource("");
    setMessage("Select one source/device and a date range before saving.");
    const sorted = [...result.records].sort((a, b) => a.start - b.start);
    const off = sorted[0]?.startOffset ?? 0;
    setOffset(off);
    // Noon-based labels, including late-day nap candidates.
    setFrom(
      sorted.length ? dayKey(sorted[0].start + off * 60_000 + 12 * HOUR) : "",
    );
    setTo(
      sorted.length
        ? dayKey(sorted.at(-1)!.end + off * 60_000 + 12 * HOUR)
        : "",
    );
  }
  const sources = new Map<string, { label: string; count: number }>();
  preview?.records.forEach((r) => {
    const key = sourceKey(r);
    const old = sources.get(key);
    sources.set(key, {
      label: `${r.source} · ${r.device || "device not supplied"}`,
      count: (old?.count ?? 0) + 1,
    });
  });
  const range = dates(from, to);
  const start = Date.parse(from) - 12 * HOUR - offset * 60_000,
    end = Date.parse(to) + 12 * HOUR - offset * 60_000;
  const selected =
    preview?.records.filter(
      (r) => sourceKey(r) === source && r.end > start && r.start < end,
    ) ?? [];
  const nights = timeline(selected, from, to, offset, new Set());
  return (
    <section aria-labelledby="import-title">
      <h2 id="import-title">01 / Select & preview</h2>
      <p>
        Synthetic rehearsal only. Real health imports are unavailable until
        durable private storage and deletion protections are implemented and
        independently reviewed. No live Watch sync.
      </p>
      <button onClick={() => offer(syntheticImport(), true)}>
        Preview synthetic fixture
      </button>
      <label>
        Apple Health export.xml or ZIP (unavailable)
        <input type="file" accept=".xml,.zip" disabled aria-describedby="health-import-hold" />
      </label>
      <p id="health-import-hold">
        Use the synthetic fixture for now. Keep real exports outside this
        workspace; Git-ignore and file permissions are not encryption.
      </p>
      <p role="status">{message}</p>
      {preview && (
        <div>
          <p>
            {synthetic ? "SYNTHETIC preview" : "PRIVATE import preview"} ·{" "}
            {preview.records.length} distinct sleep records ·{" "}
            {preview.duplicates} exact duplicates removed · {preview.invalid}{" "}
            invalid/unsupported sleep records omitted · {preview.ignored}{" "}
            unrelated records ignored.
          </p>
          <label>
            Source / device (explicit selection required)
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Select a source</option>
              {[...sources].map(([key, v]) => (
                <option key={key} value={key}>
                  {v.label} ({v.count} records)
                </option>
              ))}
            </select>
          </label>
          <p>
            Use one source/device for the whole selection. Other apps/devices
            never fill gaps automatically. Saving a replacement clears the
            current study, including diary, unfinished drafts and report
            selections. Export any selected report first if you want to keep it.
          </p>
          <div className="health-grid">
            <label>
              From window date
              <input
                type="date"
                value={from}
                onInput={(e) => setFrom(e.currentTarget.value)}
              />
            </label>
            <label>
              To window date
              <input
                type="date"
                value={to}
                onInput={(e) => setTo(e.currentTarget.value)}
              />
            </label>
            <label>
              Analysis UTC offset (minutes)
              <input
                type="number"
                min={-840}
                max={840}
                step={15}
                value={offset}
                onChange={(e) => setOffset(Number(e.target.value))}
              />
            </label>
          </div>
          <p>
            Fixed-offset noon-to-noon windows, labelled by ending date; maximum
            731 days. This keeps each window 24 elapsed hours. Original
            timestamp offsets are retained; travel / daylight-saving differences
            are flagged, not silently converted to your computer timezone.
          </p>
          <p>
            {selected.length} selected records.{" "}
            {nights.filter((n) => n.sleep !== null).length}/{range.length}{" "}
            windows with sleep; {nights.filter((n) => n.sleep === null).length}{" "}
            unknown windows; {nights.filter((n) => n.uncertain).length} timing
            flags. Presence is not proof of full coverage. Source range:{" "}
            {preview.records.length
              ? `${dayKey(preview.records.reduce((min, r) => Math.min(min, r.start), Infinity))} to ${dayKey(preview.records.reduce((max, r) => Math.max(max, r.end), -Infinity))}`
              : "none"}{" "}
            (UTC).
          </p>
          <button
            disabled={
              !source ||
              !range.length ||
              !selected.length ||
              !Number.isFinite(offset) ||
              Math.abs(offset) > 840 ||
              offset % 15 !== 0
            }
            onClick={() => {
              onSave(selected, from, to, offset, synthetic);
              setPreview(null);
              setMessage("Selected sleep records saved in this tab only.");
            }}
          >
            Save selected sleep in this tab
          </button>
          <button
            onClick={() => {
              setPreview(null);
              setMessage("Preview discarded.");
            }}
          >
            Discard preview
          </button>
        </div>
      )}
    </section>
  );
}
