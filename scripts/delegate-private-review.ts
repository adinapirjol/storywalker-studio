import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { applyDelegatedSourceReview, migrateStagedRecovery } from "../lib/private-recovery";

const target = path.join(process.cwd(), "private-data", "storywalker", "july-august-2026.recovery.private.json");
const source = migrateStagedRecovery(JSON.parse(readFileSync(target, "utf8")) as unknown);
const result = applyDelegatedSourceReview(source, new Date("2026-08-26T12:00:00.000Z"));
writeFileSync(target, `${JSON.stringify(result.document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
chmodSync(target, 0o600);
console.log(JSON.stringify({ reviewedMoments: result.reviewedMoments, acceptedSourceBackedItems: result.acceptedItems, total: result.document.moments.length, editorialProposalsAccepted: 0 }));
