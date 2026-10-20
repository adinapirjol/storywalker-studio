import { SaxesParser } from "saxes";
import { Unzip, UnzipInflate } from "fflate";
import { HOUR, type SleepKind, type SleepRecord } from "./model";
const MAX_BYTES = 256 * 1024 * 1024;
const MAX_RECORDS = 100_000;
const kinds: Record<string, SleepKind> = {
  HKCategoryValueSleepAnalysisInBed: "inBed",
  HKCategoryValueSleepAnalysisAwake: "awake",
  HKCategoryValueSleepAnalysisAsleep: "asleep",
  HKCategoryValueSleepAnalysisAsleepUnspecified: "asleep",
  HKCategoryValueSleepAnalysisAsleepCore: "core",
  HKCategoryValueSleepAnalysisAsleepDeep: "deep",
  HKCategoryValueSleepAnalysisAsleepREM: "rem",
};
export function timestamp(raw: string) {
  const m =
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}) ?([+-])(\d{2}):?(\d{2})$/.exec(
      raw,
    );
  if (!m) return null;
  const offset = (Number(m[4]) * 60 + Number(m[5])) * (m[3] === "-" ? -1 : 1);
  if (Number(m[4]) > 14 || Number(m[5]) > 59 || Math.abs(offset) > 840)
    return null;
  const ms = Date.parse(`${m[1]}T${m[2]}${m[3]}${m[4]}:${m[5]}`);
  if (
    !Number.isFinite(ms) ||
    new Date(ms + offset * 60_000).toISOString().slice(0, 19) !==
      `${m[1]}T${m[2]}`
  )
    return null;
  return { ms, offset };
}
export type ImportResult = {
  records: SleepRecord[];
  ignored: number;
  invalid: number;
  duplicates: number;
};
/** SAX parsing never resolves external DTDs. Apple's ordinary inline DTD is accepted; entities are forbidden. */
export function sleepParser() {
  const result: ImportResult = {
    records: [],
    ignored: 0,
    invalid: 0,
    duplicates: 0,
  };
  const seen = new Set<string>();
  let ordinal = 0,
    root = false,
    depth = 0,
    bytes = 0;
  const parser = new SaxesParser({ xmlns: false });
  parser.on("error", () => {
    throw new Error("Invalid Apple Health XML. No records were saved.");
  });
  parser.on("doctype", (text) => {
    if (/<!ENTITY|\bSYSTEM\b|\bPUBLIC\b/i.test(text))
      throw new Error("External declarations and entities are not supported.");
  });
  parser.on("opentag", (tag) => {
    depth++;
    if (depth === 1) {
      if (tag.name !== "HealthData")
        throw new Error("Expected an Apple Health export.");
      root = true;
    }
    if (depth > 20) throw new Error("XML nesting limit exceeded.");
    if (tag.name !== "Record") return;
    ordinal++;
    const a = tag.attributes as Record<string, string>;
    if (a.type !== "HKCategoryTypeIdentifierSleepAnalysis") {
      result.ignored++;
      return;
    }
    if (result.records.length >= MAX_RECORDS)
      throw new Error(
        "Sleep record limit reached (100,000). Use a smaller export.",
      );
    const start = timestamp(a.startDate ?? ""),
      end = timestamp(a.endDate ?? "");
    const kind = kinds[a.value];
    if (
      !start ||
      !end ||
      !kind ||
      end.ms <= start.ms ||
      end.ms - start.ms > 36 * HOUR ||
      !a.sourceName ||
      [
        a.sourceName,
        a.device ?? "",
        a.sourceVersion ?? "",
        a.creationDate ?? "",
      ].some((v) => v.length > 2000)
    ) {
      result.invalid++;
      return;
    }
    const key = JSON.stringify([
      a.sourceName,
      a.device ?? "",
      a.startDate,
      a.endDate,
      kind,
    ]);
    if (seen.has(key)) {
      result.duplicates++;
      return;
    }
    seen.add(key);
    result.records.push({
      id: `record-${ordinal}`,
      ordinal,
      source: a.sourceName,
      sourceVersion: a.sourceVersion ?? "",
      device: a.device ?? "",
      startRaw: a.startDate,
      endRaw: a.endDate,
      creationRaw: a.creationDate ?? "",
      start: start.ms,
      end: end.ms,
      startOffset: start.offset,
      endOffset: end.offset,
      kind,
    });
  });
  parser.on("closetag", () => {
    depth--;
  });
  return {
    write(chunk: string) {
      bytes += chunk.length;
      if (bytes > MAX_BYTES) throw new Error("XML exceeds 256 MiB limit.");
      parser.write(chunk);
    },
    finish() {
      parser.close();
      if (!root) throw new Error("Empty export.");
      return result;
    },
  };
}
export function parseSleepXml(xml: string) {
  const p = sleepParser();
  p.write(xml);
  return p.finish();
}
/** Bounded, incremental XML/ZIP input. No upload, file path extraction, logging or persistence. */
export async function readHealthFile(
  file: File,
  signal: AbortSignal,
): Promise<ImportResult> {
  if (file.size > MAX_BYTES)
    throw new Error(
      "File exceeds 256 MiB. Extract a smaller export.xml locally.",
    );
  const parser = sleepParser(),
    decoder = new TextDecoder("utf-8", { fatal: true });
  let expanded = 0,
    found = 0,
    complete = false;
  const consume = (data: Uint8Array, final: boolean) => {
    signal.throwIfAborted();
    expanded += data.length;
    if (expanded > MAX_BYTES) throw new Error("Expanded XML exceeds 256 MiB.");
    parser.write(decoder.decode(data, { stream: !final }));
    if (final) complete = true;
  };
  const zip = /\.zip$/i.test(file.name)
    ? new Unzip((entry) => {
        if (!/(^|\/)export\.xml$/i.test(entry.name)) return;
        if (++found > 1)
          throw new Error(
            "ZIP contains multiple export.xml files. Extract and select one.",
          );
        if (entry.originalSize && entry.originalSize > MAX_BYTES)
          throw new Error("Expanded XML exceeds 256 MiB.");
        entry.ondata = (error, data, final) => {
          if (error)
            throw new Error(
              "Cannot read this ZIP. Extract export.xml locally.",
            );
          consume(data, final);
        };
        entry.start();
      })
    : null;
  zip?.register(UnzipInflate);
  // Fixed chunks bound inflate input and allow cancellation between chunks.
  for (let offset = 0; offset < file.size; offset += 16_384) {
    signal.throwIfAborted();
    const data = new Uint8Array(
      await file.slice(offset, offset + 16_384).arrayBuffer(),
    );
    signal.throwIfAborted();
    const final = offset + data.length === file.size;
    if (zip) zip.push(data, final);
    else consume(data, final);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  signal.throwIfAborted();
  if (!complete || (zip && found !== 1))
    throw new Error("No complete export.xml found.");
  return parser.finish();
}
