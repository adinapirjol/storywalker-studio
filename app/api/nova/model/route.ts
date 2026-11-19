import { NextRequest, NextResponse } from "next/server";
import { isLocalSameOrigin } from "@/lib/http/local-origin";
import { boundedText } from "@/lib/http/context-request";
import { VAULT_SESSION_COOKIE, vaultSessionActive, vaultSessionFailure, assertVaultSessionActive } from "@/lib/vault/vault-session";
import { withBrowserVault } from "@/lib/vault/vault-route-access";
import { assertVaultSnapshotCurrent } from "@/lib/vault/private-vault";
import { modelRequestSchema } from "@/lib/nova/model-contract";
import { prepareModelPacket, validateModelOutput, modelHypothesis } from "@/lib/nova/model-packet";
import { requestModel, ModelConfigurationError } from "@/lib/nova/model-transport";
import { issueModelPreviewPermit, verifyModelPreviewPermit } from "@/lib/nova/model-permit";
import { loopView, writeLoopState } from "@/lib/nova/store";
import { forbidden, LoopConflict, LoopInputError } from "@/lib/nova/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

export async function POST(request: NextRequest) {
  if (!isLocalSameOrigin(request)) return json({ error: "Local same-origin action required." }, 403);
  const token = request.cookies.get(VAULT_SESSION_COOKIE)?.value;
  if (!vaultSessionActive(token)) return json({ code: "VAULT_LOCKED" }, 401);
  let command;
  try { command = modelRequestSchema.parse(JSON.parse(await boundedText(request, 16384))); }
  catch { return json({ error: "Invalid model request or missing one-request consent." }, 422); }
  let reservedId: string | undefined;
  try {
    if (command.action === "preview") return await withBrowserVault(token, vault => {
      const preview = prepareModelPacket(vault, command.selection).preview;
      return json({ ...preview, ...issueModelPreviewPermit(vault.key, preview.requestId, preview.snapshotHash) });
    });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new LoopInputError("No model key is configured. Nothing was sent. Your saved observation remains local.");
    const generate = command;
    const body = await withBrowserVault(token, async vault => {
      request.signal.throwIfAborted();
      if (!verifyModelPreviewPermit(vault.key, generate, Date.now())) throw new LoopInputError("This preview expired or changed. Prepare a fresh preview before consenting.");
      const packet = prepareModelPacket(vault, generate.selection);
      if (packet.snapshotHash !== generate.snapshotHash) throw new LoopConflict("The preview is stale. Prepare it again before consenting.");
      const state = packet.view.state, now = new Date().toISOString();
      if (state.modelAttempts.some(a => a.id === generate.requestId)) throw new LoopConflict("This request was already attempted. Inspect history; prepare a fresh preview for an explicit retry.");
      if (state.modelAttempts.some(a => a.status === "pending" && Date.now() - Date.parse(a.at) < 60000) ||
          state.modelAttempts.some(a => Date.now() - Date.parse(a.at) < 3000)) throw new LoopInputError("A model request is pending or was just attempted. Wait before requesting again.");
      state.modelAttempts = [...state.modelAttempts.slice(-49), { id: generate.requestId, packetHash: packet.packetHash, at: now, status: "pending" }];
      state.revision++;
      writeLoopState(vault, state, now);
      reservedId = generate.requestId;
      assertVaultSnapshotCurrent(vault);
      assertVaultSessionActive(token);
      request.signal.throwIfAborted();
      return packet.body;
    });
    assertVaultSessionActive(token);
    request.signal.throwIfAborted();
    const response = await requestModel(body, apiKey, request.signal);
    return await withBrowserVault(token, vault => {
      request.signal.throwIfAborted();
      const packet = prepareModelPacket(vault, { ...generate.selection, expectedRevision: generate.selection.expectedRevision + 1 });
      if (packet.snapshotHash !== generate.snapshotHash) throw new LoopConflict("Evidence or decisions changed during generation. The result was discarded.");
      validateModelOutput(response, packet);
      const state = packet.view.state;
      const attempt = state.modelAttempts.find(a => a.id === generate.requestId);
      if (!attempt || attempt.status !== "pending") throw new LoopConflict("This model request is no longer active.");
      if (response.outcome === "no-proposal") {
        attempt.status = "no-proposal";
        attempt.summary = response.rationale || response.uncertainty;
        state.revision++;
        writeLoopState(vault, state);
        return json({ message: `The model found no supported new direction. ${attempt.summary} Your observation and original history remain saved.`, hypothesisId: packet.original.id });
      }
      const proposal = modelHypothesis(response, packet, new Date().toISOString());
      const tokens = (text: string) => new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
      const words = tokens(proposal.interpretation);
      const duplicate = state.hypotheses.some(h => {
        if (h.alternativeTo !== packet.original.id || !h.modelReceipt) return false;
        const prior = tokens(h.interpretation);
        const overlap = [...words].filter(w => prior.has(w)).length;
        return overlap / Math.max(1, new Set([...words, ...prior]).size) > 0.8;
      });
      if (duplicate || forbidden(state, proposal)) throw new LoopInputError("The result repeats an existing direction or conflicts with a boundary. No new proposal was saved.");
      state.sourceIds = [...new Set([...state.sourceIds, ...packet.refs.map(r => r.sourceId)])];
      state.hypotheses.push(proposal);
      state.revision++;
      attempt.status = "completed";
      attempt.hypothesisId = proposal.id;
      if (state.metricsEnabled) state.metrics.modelProposals = (state.metrics.modelProposals ?? 0) + 1;
      writeLoopState(vault, state);
      return json({ message: "Model proposal saved as pending. You decide what fits.", hypothesisId: proposal.id });
    });
  } catch (error) {
    // Best-effort metadata only. Never overwrite newer decisions or expose provider errors.
    if (reservedId && vaultSessionActive(token)) {
      try { await withBrowserVault(token, vault => {
        const state = loopView(vault).state;
        const attempt = state.modelAttempts.find(a => a.id === reservedId);
        if (attempt?.status === "pending") {
          attempt.status = "failed";
          attempt.summary = error instanceof ModelConfigurationError || error instanceof LoopConflict || error instanceof LoopInputError
            ? error.message : "Request failed or was cancelled. It was not retried.";
          writeLoopState(vault, state);
        }
      }); } catch { /* Keep the one-use reservation if access or the file changed. */ }
    }
    return vaultSessionFailure(error) ?? json({
      error: error instanceof LoopInputError || error instanceof LoopConflict || error instanceof ModelConfigurationError ? error.message : "The model request could not be completed. Nothing was approved; inspect history before explicitly trying again. Your observation remains saved.",
    }, error instanceof LoopConflict ? 409 : 422);
  }
}
