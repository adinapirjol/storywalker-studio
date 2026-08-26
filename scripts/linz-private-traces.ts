import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { selectedLinzTracesSchema } from "../lib/private-linz";

const inputIndex = process.argv.indexOf("--input");
const input = inputIndex >= 0 ? process.argv[inputIndex + 1] : undefined;
const dryRun = process.argv.includes("--dry-run");
if (!input) throw new Error("Usage: npm run linz:private-traces -- --input /absolute/path/to/three-selected-traces.json [--dry-run]");
const records = selectedLinzTracesSchema.parse(JSON.parse(readFileSync(resolve(input), "utf8")));
console.log(JSON.stringify({ dryRun, recordCount: records.length, privacy: "local-private", locations: records.map((record) => record.generalisedLocation) }, null, 2));
if (!dryRun) {
  const directory = resolve("private-data/minimised");
  mkdirSync(directory, { recursive: true });
  const output = resolve(directory, "linz-three-selected-traces.private.json");
  writeFileSync(output, `${JSON.stringify(records, null, 2)}\n`, { mode: 0o600 });
  console.log(`Wrote Author-selected local-only traces: ${output}`);
}
