import { connectedReviewCatalog, connectedReviewPage, saveConnectedProposal, ReviewConflict } from '@/lib/evidence/connected-review-store';
import { readVaultSession } from '@/lib/vault/vault-session';
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {cookies} from "next/headers";
import {isLocalRead,isLocalSameOrigin} from "@/lib/http/local-origin";
import {assertVaultSessionActive,vaultSessionActive,vaultSessionFailure,VAULT_SESSION_COOKIE} from "@/lib/vault/vault-session";
import {boundedText} from "@/lib/http/context-request";
import { applyAuthorReviewAction, createNovaThreadProposal, directAuthorEvidenceInputSchema, migrateStagedRecovery, novaQuestionResolutionInputSchema, novaQuestionResponseInputSchema, novaThreadProposalInputSchema, processNovaInbox, recordDirectAuthorEvidence, recordNovaQuestionResponse, resolveNovaQuestionResponse, type RecoveryDecisionAction } from "@/lib/evidence/private-recovery";

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
  if (new URL(request.url).searchParams.get("view") === "evidence") {
    try {
      const guard = () => { request.signal.throwIfAborted(); assertVaultSessionActive(authorization.token); };
      const params = new URL(request.url).searchParams;
      const packageId = params.get('package') ?? undefined;
      const offsetText = params.get('offset') ?? '0';
      const offset = Number(offsetText);
      if ((packageId && !/^[a-z0-9-]{1,100}$/.test(packageId)) || !/^\d{1,5}$/.test(offsetText) || offset>30000 || (params.get('scope')?.length??0)>160 || (params.get('record')?.length??0)>300 || (params.get('q')?.length??0)>200) throw new Error('Invalid review query.');
      const root = path.join(process.cwd(),'private-data');
      const result = params.get('mode') === 'page'
        ? await connectedReviewPage(root,{packageId,scope:params.get('scope')??undefined,recordId:params.get('record')??undefined,search:params.get('q')??undefined,offset,fragments:params.get('fragments')==='1',excluded:params.get('excluded')==='1'},guard)
        : await connectedReviewCatalog(root,packageId,guard);
      guard();
      const session = readVaultSession(authorization.token); const expiresAt = session?.expiresAt; session?.key.fill(0);
      return Response.json({...result,expiresAt},{headers:{'Cache-Control':'no-store'}});
    } catch(error) { return vaultSessionFailure(error) ?? Response.json({error:'Connected review is unavailable or its registered files changed. Existing evidence is preserved.'},{status:400,headers:{'Cache-Control':'no-store'}}); }
  }
  try { return Response.json(await readReview(authorization.token), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return vaultSessionFailure(error) ?? Response.json({ error: "Local private recovery source is unavailable." }, { status: 404, headers: { "Cache-Control": "no-store" } }); }
}
export async function POST(request: Request) {
  const authorization = await access(request, true);
  if (authorization instanceof Response) return authorization;
  const token = authorization.token;
  try {
    let raw:string;try {raw=await boundedText(request,65_536);}catch{return Response.json({error:"Request too large or malformed."},{status:413});}
    const body = JSON.parse(raw) as { momentId?: string; action?: RecoveryDecisionAction | "review-bundle-proposal" | "answer-question" | "process-inbox" | "resolve-question" | "record-author-evidence" | "propose-thread"; note?: string; questionId?: string; question?: string; sourceQuestionId?: string; response?: string; responseId?: string; targetMomentIds?: string[]; title?: string; label?: string; claims?: string[] };
    if (body.action === 'review-bundle-proposal') {
      const {action: _action,...input} = JSON.parse(raw) as Record<string,unknown>; void _action;
      const guard = () => { request.signal.throwIfAborted(); assertVaultSessionActive(token); };
      try { const result = await saveConnectedProposal(path.join(process.cwd(),'private-data'),input,guard); guard(); return Response.json(result,{headers:{'Cache-Control':'no-store'}}); }
      catch(error) { if(error instanceof ReviewConflict) return Response.json({error:error.message},{status:409,headers:{'Cache-Control':'no-store'}}); throw error; }
    }
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
