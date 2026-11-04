import { randomUUID } from "node:crypto";
import type { Command, Evidence, Hypothesis, LoopState, Relationship } from "./contracts";
import { digest } from "./normalize";

export class LoopConflict extends Error {}
export class LoopInputError extends Error {}
const active = (h: Hypothesis) => ["proposed", "approved", "modified"].includes(h.status);
const pair = (ids: string[]) => [...new Set(ids)].sort().join("\n");
export const sourcePair = (h: Hypothesis) => pair(h.refs.map(r => r.sourceId));
const evidencePair = (h: Hypothesis) => pair(h.refs.map(r => r.id));
const version = (h: Hypothesis) => digest(h.refs.map(r => [r.id, r.revision]));
const count = (state: LoopState, key: string, amount = 1) => { if (state.metricsEnabled) state.metrics[key] = (state.metrics[key] ?? 0) + amount; };

export function reconcile(state: LoopState, evidence: Evidence[]): LoopState {
  const current = new Map(evidence.map(e => [e.id, e]));
  return { ...state, hypotheses: state.hypotheses.map(h => active(h) && h.refs.some(r => current.get(r.id)?.revision !== r.revision || !state.sourceIds.includes(r.sourceId)) ? { ...h, status: "invalidated" } : h) };
}
function candidates(evidence: Evidence[], now: string): Hypothesis[] {
  const found: Hypothesis[] = [];
  const cueKeys = new Set<string>();
  const rows = evidence.filter(e => e.provenance && e.timestamp).sort((a, b) => b.timestamp!.localeCompare(a.timestamp!) || a.id.localeCompare(b.id));
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i], b = rows[j];
    const dayA = a.timestamp!.slice(0, 10), dayB = b.timestamp!.slice(0, 10);
    let relationship: Relationship | undefined;
    if (a.track && a.artist && a.track === b.track && a.artist === b.artist && dayA !== dayB) relationship = "same-track";
    else if (a.artist && a.artist === b.artist && a.track !== b.track && dayA !== dayB) relationship = "same-artist";
    else if (a.sourceId !== b.sourceId && dayA === dayB) relationship = "same-day";
    if (!relationship) continue;
    const refs = [a, b].sort((x, y) => x.id.localeCompare(y.id)).map(({ id, sourceId, revision }) => ({ id, sourceId, revision }));
    const cue = relationship === "same-track" ? [a.artist, a.track] : relationship === "same-artist" ? [a.artist] : [dayA, pair([a.sourceId, b.sourceId])];
    const key = digest([relationship, cue]);
    if (cueKeys.has(key)) continue;
    cueKeys.add(key);
    const observation = relationship === "same-day" ? "These records share a calendar date (UTC for offset timestamps; date-only captures retain their stated day)." : relationship === "same-track" ? "The exact track and artist labels recur on different observed days." : "The exact artist label recurs across different track labels on different observed days.";
    found.push({ id: `hypothesis:${digest([key, refs.map(r => r.revision)]).slice(0, 32)}`, key, refs, relationship, observation, interpretation: relationship === "same-day" ? "Could this shared date be useful context for a connection you recognize?" : "Could this recurrence be a useful thread for you to explore?", uncertainty: "This is a deterministic retrieval cue and an unconfirmed interpretive question. Labels can be ambiguous, the archive is incomplete, and neither causality, emotion nor intention is established.", validation: "Inspect the original records and dates; confirm the labels refer to the same thing, or correct the evidence. An Author disagreement can reject the interpretation without changing the observations.", contradictingEvidence: [], reason: "New or changed selected evidence; prioritized by recent event time and explicit provenance.", createdAt: now, modelVersion: "nova-local-rules-v1", confidence: "uncalibrated", status: "proposed" });
    if (found.length >= 1000) return found;
  }
  return found;
}
export function forbidden(state: LoopState, h: Hypothesis) {
  return state.decisions.some(d => {
    if (d.action !== "reject") return false;
    const prior = state.hypotheses.find(p => p.id === d.hypothesisId);
    if (!prior) return true; // fail closed if history is inconsistent
    if (d.reason === "never-again") {
      const refs = [...h.refs];
      const seen = new Set<string>([h.id]);
      let originId = h.alternativeTo;
      while (originId && !seen.has(originId)) {
        seen.add(originId);
        const origin = state.hypotheses.find(p => p.id === originId);
        if (!origin) return true;
        refs.push(...origin.refs);
        originId = origin.alternativeTo;
      }
      return prior.refs.every(p => refs.some(r => r.sourceId === p.sourceId));
    }
    if (d.reason === "incorrect-evidence") return h.refs.some(r => prior.refs.some(p => r.id === p.id && r.revision === p.revision));
    if (d.reason === "insufficient-evidence") return evidencePair(prior) === evidencePair(h) && version(prior) === version(h);
    if (d.reason === "not-now") return evidencePair(prior) === evidencePair(h);
    return prior.key === h.key; // does-not-fit / other suppress this interpretation
  });
}
function propose(state: LoopState, evidence: Evidence[], now: string, rejected?: Hypothesis) {
  if (!state.enabled || state.paused || state.hypotheses.length >= 1000) return 0;
  const existing = new Set(state.hypotheses.filter(h => h.status !== "invalidated" && h.status !== "rejected").map(h => h.key));
  const ids = new Set(state.hypotheses.map(h => h.id));
  const room = Math.min(rejected ? 1 : 12, 24 - state.hypotheses.filter(h => h.status === "proposed").length, 1000 - state.hypotheses.length);
  let added = 0;
  for (const h of candidates(evidence, now)) {
    if (added >= room) break;
    if (existing.has(h.key)) { count(state, "duplicateProposalsPrevented"); continue; }
    if (forbidden(state, h)) { count(state, "boundaryBlocks"); continue; }
    if (ids.has(h.id)) {
      const previous = state.hypotheses.find(p => p.id === h.id);
      if (previous?.status !== "invalidated") { count(state, "duplicateProposalsPrevented"); continue; }
      h.supersedes = previous.id;
      h.id = `hypothesis:${randomUUID()}`;
      h.reason = "Previously invalidated evidence is available again after explicit analysis; a fresh decision is required.";
    }
    if (rejected) {
      // One genuinely different basis and pair in the affected neighborhood.
      if (h.relationship === rejected.relationship || evidencePair(h) === evidencePair(rejected) || !h.refs.some(r => rejected.refs.some(p => p.id === r.id))) continue;
      h.alternativeTo = rejected.id;
      h.reason = `After rejection: a different evidence pair and ${h.relationship} basis. The rejected interpretation is not repeated.`;
    }
    state.hypotheses.push(h); existing.add(h.key); ids.add(h.id); added++;
  }
  count(state, "generated", added);
  if (rejected) count(state, "alternatives", added);
  return added;
}
export function transition(original: LoopState, evidence: Evidence[], command: Command, now: string): { state: LoopState; message: string } {
  if (command.expectedRevision !== original.revision) throw new LoopConflict("Reload: another action changed this review.");
  const state = structuredClone(reconcile(original, evidence));
  let message = "Saved in the encrypted Vault.";
  if (command.action === "configure") {
    state.sourceIds = [...new Set(command.sourceIds)]; state.enabled = true;
    message = "Evidence selection saved.";
    if (command.analyze) {
      if (state.lastAnalysis && Date.parse(now) - Date.parse(state.lastAnalysis) < 3000) throw new LoopInputError("Wait three seconds before exploring again.");
      state.paused = false;
      const added = propose(state, evidence, now);
      state.lastAnalysis = now;
      message = added ? `${added} new connections to explore. You decide what fits.` : "No new connections supported by this selection. Your previous decisions and boundaries still apply.";
    }
  } else if (command.action === "pause") state.paused = command.paused;
  else if (command.action === "disable") { state.enabled = false; state.sourceIds = []; message = "Processing disabled and all source access revoked. Historical decisions remain."; }
  else if (command.action === "metrics") state.metricsEnabled = command.enabled;
  else if (command.action === "delete-metrics") { state.metrics = {}; state.metricsEnabled = false; }
  else if (command.action === "delete-derived" || (command.action === "propose-reading" || command.action === "reconsider-reading")) throw new LoopInputError("This action belongs to the Vault store.");
  else if (command.action === "analyze") {
    if (!state.enabled || state.paused) throw new LoopInputError("Enable and resume local inference first.");
    if (state.lastAnalysis && Date.parse(now) - Date.parse(state.lastAnalysis) < 3000) throw new LoopInputError("Wait three seconds before another analysis.");
    const added = propose(state, evidence, now); state.lastAnalysis = now;
    message = `${added} new proposals. Fewer than three may be justified; missing provenance, limited coverage, previous decisions and explicit boundaries constrain generation.`;
  } else {
    const h = state.hypotheses.find(item => item.id === command.hypothesisId);
    if (!h || !active(h)) throw new LoopConflict("This connection is no longer current. Reload and inspect its history.");
    if (!state.enabled || state.paused) throw new LoopInputError("Resume the loop before recording a decision.");
    if (state.decisions.length >= 2000) throw new LoopInputError("History capacity reached. Delete derived data explicitly to start over.");
    const d: LoopState["decisions"][number] = { id: randomUUID(), hypothesisId: h.id, action: command.action, at: now, note: "" };
    if (command.action === "approve") {
      if (h.status === "approved") throw new LoopInputError("This connection is already approved.");
      h.status = "approved";
    }
    if (command.action === "modify") {
      if (state.hypotheses.length >= 1000) throw new LoopInputError("History capacity reached.");
      const selected = [...new Set(command.evidenceIds)].map(id => evidence.find(e => e.id === id));
      const minimum = command.relationship === "author-association" ? 1 : 2;
      if (selected.length < minimum || selected.some(e => !e || !state.sourceIds.includes(e.sourceId))) throw new LoopInputError(`Choose at least ${minimum} currently authorized evidence nodes.`);
      const next: Hypothesis = { ...h, id: `hypothesis:${randomUUID()}`, refs: selected.map(e => ({ id: e!.id, sourceId: e!.sourceId, revision: e!.revision })), relationship: command.relationship, interpretation: command.interpretation, observation: "Author-selected evidence and relationship; no automated factual validation of the revision.", status: "modified", supersedes: h.id, createdAt: now, reason: "Participant revision; original proposal preserved." };
      next.key = digest([next.relationship, next.refs.map(r => r.id).sort()]);
      if (forbidden(state, next)) throw new LoopInputError("This revision conflicts with an explicit rejection boundary.");
      h.status = "superseded"; state.hypotheses.push(next); d.replacementId = next.id;
    }
    if (command.action === "reject") {
      h.status = "rejected"; d.reason = command.reason; d.note = command.note;
    }
    state.decisions.push(d); count(state, command.action);
    count(state, "decisionElapsedMs", Math.max(0, Date.parse(now) - Date.parse(h.createdAt)));
    if (command.action === "reject") {
      count(state, `rejection:${command.reason}`);
      // Constraints also remove other already queued/accepted affected connections.
      state.hypotheses = state.hypotheses.map(p => active(p) && forbidden(state, p) ? { ...p, status: "invalidated" } : p);
      const noRetry = ["never-again", "not-now", "incorrect-evidence", "insufficient-evidence"].includes(command.reason);
      const added = noRetry ? 0 : propose(state, evidence, now, h);
      message = added ? "Rejection saved. One alternative uses a different pair and relationship basis." : "Rejection saved. No justified alternative within your boundary; Nova has stopped reconsidering this decision.";
    }
  }
  state.revision++;
  return { state: reconcile(state, evidence), message };
}
