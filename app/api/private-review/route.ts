import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {cookies} from "next/headers";
import {isLocalRead,isLocalSameOrigin} from "@/lib/local-origin";
import {assertVaultSessionActive,vaultSessionActive,vaultSessionFailure,VAULT_SESSION_COOKIE} from "@/lib/vault-session";
import {boundedText} from "@/lib/context-request";
import { applyAuthorReviewAction, createNovaThreadProposal, directAuthorEvidenceInputSchema, migrateStagedRecovery, novaQuestionResolutionInputSchema, novaQuestionResponseInputSchema, novaThreadProposalInputSchema, processNovaInbox, recordDirectAuthorEvidence, recordNovaQuestionResponse, resolveNovaQuestionResponse, type RecoveryDecisionAction } from "@/lib/private-recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateReviewPath = path.join(process.cwd(), "private-data", "storywalker", "july-august-2026.recovery.private.json");
let reviewWriteQueue: Promise<void> = Promise.resolve();
async function readReview(token: string | undefined) {
  assertVaultSessionActive(token);
  const raw = await readFile(privateReviewPath, "utf8");
  assertVaultSessionActive(token);
  return migrateStagedRecovery(JSON.parse(raw) as unknown);
}
async function saveReview(token: string | undefined, text: string, options: {encoding: "utf8"; mode: number}) {
  assertVaultSessionActive(token);
  await writeFile(privateReviewPath, text, options);
}
function serialisePrivateWrite<T>(task: () => Promise<T>) { const result = reviewWriteQueue.then(task, task); reviewWriteQueue = result.then(() => undefined, () => undefined); return result; }

async function access(request:Request,write=false) {
  if (!(write?isLocalSameOrigin(request):isLocalRead(request))) return Response.json({code:"LOCAL_ORIGIN_REQUIRED"},{status:403,headers:{"Cache-Control":"no-store"}});
  const token = (await cookies()).get(VAULT_SESSION_COOKIE)?.value;
  if (!vaultSessionActive(token)) return Response.json({code:"VAULT_LOCKED",error:"Unlock your Vault before opening private recovery notes."},{status:401,headers:{"Cache-Control":"no-store"}});
  return { token };
}
export async function GET(request: Request) {
  const authorization = await access(request);
  if (authorization instanceof Response) return authorization;
  try { return Response.json(await readReview(authorization.token), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return vaultSessionFailure(error) ?? Response.json({ error: "Local private recovery source is unavailable." }, { status: 404, headers: { "Cache-Control": "no-store" } }); }
}
export async function POST(request: Request) {
  const authorization = await access(request, true);
  if (authorization instanceof Response) return authorization;
  const token = authorization.token;
  try {
    let raw:string;try {raw=await boundedText(request,65_536);}catch{return Response.json({error:"Request too large or malformed."},{status:413});}
    const body = JSON.parse(raw) as { momentId?: string; action?: RecoveryDecisionAction | "answer-question" | "process-inbox" | "resolve-question" | "record-author-evidence" | "propose-thread"; note?: string; questionId?: string; question?: string; sourceQuestionId?: string; response?: string; responseId?: string; targetMomentIds?: string[]; title?: string; label?: string; claims?: string[] };
    if (body.action === "answer-question") {
      const input = novaQuestionResponseInputSchema.parse({ questionId: body.questionId, question: body.question, sourceQuestionId: body.sourceQuestionId, response: body.response, targetMomentIds: body.targetMomentIds ?? [] });
      const result = await serialisePrivateWrite(async () => { const recorded = recordNovaQuestionResponse(await readReview(token), input); const processed = processNovaInbox(recorded.document); if (recorded.created || processed.created) await saveReview(token, `${JSON.stringify(processed.document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); return { ...recorded, document: processed.document, triage: processed }; });
      assertVaultSessionActive(token);
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "process-inbox") {
      const result = await serialisePrivateWrite(async () => { const next = processNovaInbox(await readReview(token)); if (next.created || next.pending === 0) await saveReview(token, `${JSON.stringify(next.document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); return next; });
      assertVaultSessionActive(token);
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "propose-thread") {
      const input = novaThreadProposalInputSchema.parse({ momentId: body.momentId, title: body.title });
      const result = await serialisePrivateWrite(async () => { const next = createNovaThreadProposal(await readReview(token), input); if (next.created) await saveReview(token, `${JSON.stringify(next.document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); return next; });
      assertVaultSessionActive(token);
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "resolve-question") {
      const input = novaQuestionResolutionInputSchema.parse({ responseId: body.responseId, targetMomentIds: body.targetMomentIds });
      const result = await serialisePrivateWrite(async () => { const next = resolveNovaQuestionResponse(await readReview(token), input); if (next.created) await saveReview(token, `${JSON.stringify(next.document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); return next; });
      assertVaultSessionActive(token);
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "record-author-evidence") {
      const input = directAuthorEvidenceInputSchema.parse({ label: body.label, targetMomentIds: body.targetMomentIds, claims: body.claims });
      const result = await serialisePrivateWrite(async () => { const next = recordDirectAuthorEvidence(await readReview(token), input); if (next.created) await saveReview(token, `${JSON.stringify(next.document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); return next; });
      assertVaultSessionActive(token);
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    }
    if (!body.momentId || !["accept-evidence", "revise", "save-correction-and-accept-evidence", "refuse-interpretation", "exclude-entirely", "keep-unresolved"].includes(body.action ?? "")) return Response.json({ error: "A Moment and explicit Author action are required." }, { status: 400 });
    const momentId = body.momentId; const action = body.action!;
    const result = await serialisePrivateWrite(async () => { const next = applyAuthorReviewAction(await readReview(token), momentId, action, body.note); if (next.created) await saveReview(token, `${JSON.stringify(next.document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); return next; });
    assertVaultSessionActive(token);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return vaultSessionFailure(error) ?? Response.json({ error: "Private review update failed. Existing evidence is preserved." }, { status: 400,headers:{"Cache-Control":"no-store"} }); }
}
