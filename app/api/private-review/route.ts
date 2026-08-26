import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyAuthorReviewAction, createNovaThreadProposal, directAuthorEvidenceInputSchema, migrateStagedRecovery, novaQuestionResolutionInputSchema, novaQuestionResponseInputSchema, novaThreadProposalInputSchema, processNovaInbox, recordDirectAuthorEvidence, recordNovaQuestionResponse, resolveNovaQuestionResponse, type RecoveryDecisionAction } from "@/lib/private-recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateReviewPath = path.join(process.cwd(), "private-data", "storywalker", "july-august-2026.recovery.private.json");
let reviewWriteQueue: Promise<void> = Promise.resolve();
async function readReview() { return migrateStagedRecovery(JSON.parse(await readFile(privateReviewPath, "utf8")) as unknown); }
function serialisePrivateWrite<T>(task: () => Promise<T>) { const result = reviewWriteQueue.then(task, task); reviewWriteQueue = result.then(() => undefined, () => undefined); return result; }

export async function GET() { try { return Response.json(await readReview(), { headers: { "Cache-Control": "no-store" } }); } catch { return Response.json({ error: "Local private recovery source is unavailable." }, { status: 404 }); } }
export async function POST(request: Request) {
  try {
    const body = await request.json() as { momentId?: string; action?: RecoveryDecisionAction | "answer-question" | "process-inbox" | "resolve-question" | "record-author-evidence" | "propose-thread"; note?: string; questionId?: string; question?: string; sourceQuestionId?: string; response?: string; responseId?: string; targetMomentIds?: string[]; title?: string; label?: string; claims?: string[] };
    if (body.action === "answer-question") {
      const input = novaQuestionResponseInputSchema.parse({ questionId: body.questionId, question: body.question, sourceQuestionId: body.sourceQuestionId, response: body.response, targetMomentIds: body.targetMomentIds ?? [] });
      const result = await serialisePrivateWrite(async () => { const recorded = recordNovaQuestionResponse(await readReview(), input); const processed = processNovaInbox(recorded.document); if (recorded.created || processed.created) await writeFile(privateReviewPath, `${JSON.stringify(processed.document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); return { ...recorded, document: processed.document, triage: processed }; });
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "process-inbox") {
      const result = await serialisePrivateWrite(async () => { const next = processNovaInbox(await readReview()); if (next.created || next.pending === 0) await writeFile(privateReviewPath, `${JSON.stringify(next.document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); return next; });
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "propose-thread") {
      const input = novaThreadProposalInputSchema.parse({ momentId: body.momentId, title: body.title });
      const result = await serialisePrivateWrite(async () => { const next = createNovaThreadProposal(await readReview(), input); if (next.created) await writeFile(privateReviewPath, `${JSON.stringify(next.document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); return next; });
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "resolve-question") {
      const input = novaQuestionResolutionInputSchema.parse({ responseId: body.responseId, targetMomentIds: body.targetMomentIds });
      const result = await serialisePrivateWrite(async () => { const next = resolveNovaQuestionResponse(await readReview(), input); if (next.created) await writeFile(privateReviewPath, `${JSON.stringify(next.document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); return next; });
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "record-author-evidence") {
      const input = directAuthorEvidenceInputSchema.parse({ label: body.label, targetMomentIds: body.targetMomentIds, claims: body.claims });
      const result = await serialisePrivateWrite(async () => { const next = recordDirectAuthorEvidence(await readReview(), input); if (next.created) await writeFile(privateReviewPath, `${JSON.stringify(next.document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); return next; });
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    }
    if (!body.momentId || !["accept-evidence", "revise", "save-correction-and-accept-evidence", "refuse-interpretation", "exclude-entirely", "keep-unresolved"].includes(body.action ?? "")) return Response.json({ error: "A Moment and explicit Author action are required." }, { status: 400 });
    const momentId = body.momentId; const action = body.action!;
    const result = await serialisePrivateWrite(async () => { const next = applyAuthorReviewAction(await readReview(), momentId, action, body.note); if (next.created) await writeFile(privateReviewPath, `${JSON.stringify(next.document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); return next; });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Private review update failed." }, { status: 400 }); }
}
