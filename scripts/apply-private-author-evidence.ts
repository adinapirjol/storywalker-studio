import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { applyPostImportEvidence, migrateStagedRecovery, postImportCorrectionSchema } from "../lib/private-recovery";

const args = process.argv.slice(2);
const correctionFlag = args.indexOf("--correction");
const correctionPath = correctionFlag >= 0 ? args[correctionFlag + 1] : undefined;
if (!correctionPath || !isAbsolute(correctionPath)) throw new Error("Usage: npm run private:apply-author-evidence -- --correction /absolute/path/correction.private.json [--write-private]");
if (!existsSync(correctionPath)) throw new Error(`Missing correction input: ${correctionPath}`);
const output = resolve("private-data/storywalker/july-august-2026.recovery.private.json");
if (!existsSync(output)) throw new Error("No staged recovery exists. Run the recovery importer first.");
const current = migrateStagedRecovery(JSON.parse(readFileSync(output, "utf8")) as unknown);
const correction = postImportCorrectionSchema.parse(JSON.parse(readFileSync(correctionPath, "utf8")) as unknown);
const next = applyPostImportEvidence(current, correction);
console.log(JSON.stringify({ dryRun: !args.includes("--write-private"), sourceBundleMomentCount: next.sourceBundle.originalMomentCount, stagedMomentCount: next.moments.length, addedMomentIds: correction.additions.map((moment) => moment.id), evidenceEntries: correction.evidence.length, gapUpdates: correction.gapUpdates.map((update) => ({ questionId: update.questionId, status: update.status })), existingAuthorDecisions: Object.values(current.review).reduce((count, state) => count + state.decisions.length, 0), publicContentWritten: false }, null, 2));
if (args.includes("--write-private")) writeFileSync(output, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
