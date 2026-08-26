import { describe, expect, it } from "vitest";
import { applyAuthorReviewAction, applyPostImportEvidence, applyRecoveryDecision, collapseExactDuplicateDecisions, createNovaThreadProposal, migrateStagedRecovery, processNovaInbox, recordDirectAuthorEvidence, recordNovaQuestionResponse, resolveNovaQuestionResponse, setCurrentAuthorCorrection, stageRecovery, validateRecoveryLedger } from "@/lib/private-recovery";

const groups = [15, 5, 17, 7, 3, 6, 3];
function fixture() {
  let position = 0;
  const moments = groups.flatMap((count, journeyIndex) => Array.from({ length: count }, (_, _withinJourney) => {
    position += 1;
    return {
      id: `fictional-moment-${position}`, title: `Fictional record ${position}`, privacy: "private" as const, reviewStatus: "pending" as const, canonical: false as const,
      sensitivity: position < 5 ? "restricted" as const : "normal" as const, journeyCandidate: `route-${journeyIndex + 1}`,
      when: { start: `2026-07-${String((position % 28) + 1).padStart(2, "0")}`, end: null, timezone: "Europe/Paris", precision: "day" as const },
      where: { privateLabel: "Private place", publicGeneralisation: "General place", precision: "city" as const }, authorStatement: "A fictional Author statement.", whatOccurred: ["Fictional observation."],
      claimLedger: [{ claim: position === 1 ? "A planned performance is not attendance." : "A fictional claim.", evidenceStatus: position === 2 ? "assistant-proposed" as const : "author-stated" as const }],
      sensoryDetailsExplicitlyStated: [], emotionsExplicitlyStated: position <= 22 ? ["Fictional stated affect."] : [], music: position <= 15 ? [{ track: "Synthetic song", artist: "Synthetic artist", spotifyUri: "spotify:track:synthetic1", encounterType: "mentioned" as const, evidenceStatus: "source-recorded" as const }] : [],
      occurrences: position === 1 ? [{ kind: "playlist-entry", sourcePosition: 1, occurredAt: null, detail: "Duplicate source-positioned occurrence." }, { kind: "playlist-entry", sourcePosition: 2, occurredAt: null, detail: "Duplicate source-positioned occurrence." }] : [],
      accessibilityConsideration: null, peopleAliases: ["Visitor A1"], objectsAndArtefacts: [], provenance: [{ author: "user" as const, chatTitle: "Fictional private source", messageDate: "2026-07-11", shortExcerpt: "A fictional source excerpt.", evidenceStatus: "author-stated" as const }], contradictions: [], unknowns: [], editorialProposals: ["A fictional optional proposal."],
    };
  }));
  return { bundleVersion: "fictional-private-r1", privacy: "private" as const, reviewStatus: "pending" as const, canonical: false as const, scope: { start: "2026-07-11", end: "2026-08-19", timezoneDefault: "Europe/Paris" }, accessAudit: {}, sourceInventory: [], moments, provisionalThreads: [{ title: "Fictional thread", privacy: "private" as const, reviewStatus: "pending" as const, canonical: false as const, status: "assistant-proposed" as const, tests: ["No automatic canonisation."] }], coverageReport: { totalMoments: 56, momentCountsByJourney: Object.fromEntries(groups.map((count, index) => [`route-${index + 1}`, count])), momentsWithMusicalEvidence: 15, momentsWithExplicitlyStatedEmotion: 22, momentsWithAccessibilityObservations: 3, momentsWithUnresolvedContradictions: 7, completenessConfidence: "medium" as const }, playlistSources: ["one", "two", "three"].map((name) => ({ name: `Synthetic playlist ${name}`, spotifyPlaylistId: `playlist${name}`, privacy: "private" as const, reviewStatus: "pending" as const, canonical: false as const, role: "independent corroboration", importStatus: "not-imported" })) };
}

const companions = { authorReviewMarkdown: "# Fictional review", gapsMarkdown: "## Six remaining high-value Author questions\n1. Fictional question one?\n2. Fictional question two?\n3. Fictional question three?\n4. Fictional question four?\n5. Fictional question five?\n6. Fictional question six?", importPromptMarkdown: "# Fictional import prompt" };
const hashes = { ledger: "a".repeat(64), authorReview: "b".repeat(64), gaps: "c".repeat(64), importPrompt: "d".repeat(64) };

describe("private recovery staging", () => {
  it("validates a fictional structural equivalent without producing Episodes", () => {
    const result = validateRecoveryLedger(fixture());
    expect(result.errors).toEqual([]);
    const staged = stageRecovery(result.ledger!, companions, hashes);
    expect(staged.document.moments).toHaveLength(56);
    expect(staged.document.journeys.map((journey) => journey.sourceMomentIds.length).sort((a, b) => a - b)).toEqual([3, 3, 5, 6, 7, 15, 17]);
    expect(staged.document.episodes).toEqual([]);
    expect(staged.document.moments.every((moment) => moment.privacy === "private" && moment.reviewStatus === "pending" && !moment.canonical)).toBe(true);
    expect(staged.document.unansweredQuestions).toHaveLength(6);
  });

  it("keeps playlist identities and duplicate occurrences separate, and rejects share parameters", () => {
    const result = validateRecoveryLedger(fixture());
    const staged = stageRecovery(result.ledger!, companions, hashes).document;
    expect(staged.playlistSources.map((playlist) => playlist.spotifyPlaylistId)).toEqual(["playlistone", "playlisttwo", "playlistthree"]);
    expect(staged.moments[0].occurrences).toHaveLength(2);
    const invalid = fixture(); invalid.playlistSources[0].spotifyPlaylistId = "playlistone?si=unsafe";
    expect(validateRecoveryLedger(invalid).errors.join(" ")).toContain("share parameters");
  });

  it("is idempotent, preserves decisions, and creates a conflict instead of overwriting changed evidence", () => {
    const parsed = validateRecoveryLedger(fixture()).ledger!;
    const first = stageRecovery(parsed, companions, hashes).document;
    const decided = applyRecoveryDecision(first, "fictional-moment-1", "refuse-interpretation", undefined, new Date("2026-08-23T12:00:00Z"));
    const repeated = stageRecovery(parsed, companions, hashes, decided).document;
    expect(repeated.review["fictional-moment-1"].decisions).toHaveLength(1);
    expect(stageRecovery(parsed, companions, hashes, decided).summary.unchangedIds).toHaveLength(56);
    const changed = fixture(); changed.moments[0].title = "Changed fictional source record";
    const conflict = stageRecovery(validateRecoveryLedger(changed).ledger!, companions, hashes, decided);
    expect(conflict.summary.conflictingIds).toEqual(["fictional-moment-1"]);
    expect(conflict.document.moments[0].title).toBe("Fictional record 1");
  });

  it("keeps evidence when interpretation is refused and cannot canonise unresolved material", () => {
    const staged = stageRecovery(validateRecoveryLedger(fixture()).ledger!, companions, hashes).document;
    const refused = applyRecoveryDecision(staged, "fictional-moment-2", "refuse-interpretation", undefined, new Date("2026-08-23T12:00:00Z"));
    expect(refused.moments[1].claimLedger[0].claim).toBe("A fictional claim.");
    expect(refused.moments[1].canonical).toBe(false);
    expect(refused.threads[0].canonical).toBe(false);
    expect(refused.review["fictional-moment-2"].excluded).toBe(false);
  });

  it("adds post-import Author evidence without changing the 56-record source bundle or overwriting provenance", () => {
    const original = stageRecovery(validateRecoveryLedger(fixture()).ledger!, companions, hashes).document;
    const addition = { ...fixture().moments[0], id: "fictional-post-import-1", title: "Fictional post-import record", journeyCandidate: "route-7" };
    const correction = { schemaVersion: 1 as const, kind: "storywalker-post-import-author-evidence" as const, recordedAt: "2026-08-23", evidence: [{ id: "fictional-correction-1", recordedAt: "2026-08-23", privacy: "private" as const, reviewStatus: "pending" as const, canonical: false as const, targetMomentIds: ["fictional-moment-1"], claims: [{ claim: "A fictional Author correction.", evidenceStatus: "author-stated" as const }], supersedes: ["A fictional prior statement."], provenance: { author: "user" as const, label: "Fictional post-import source" } }], additions: [addition], gapUpdates: [{ questionId: "gaps-question-3", status: "resolved" as const, supersededStatement: "A fictional gap statement." }], relationshipOverrides: { "fictional-moment-1": { primaryJourney: "route-1", crossJourneyCandidates: ["route-3"], threadProposals: ["fictional working thread"] } } };
    const corrected = applyPostImportEvidence(original, correction);
    expect(corrected.sourceBundle.originalMomentCount).toBe(56);
    expect(corrected.moments).toHaveLength(57);
    expect(corrected.moments[0].title).toBe("Fictional record 1");
    expect(corrected.postImportEvidence).toHaveLength(1);
    expect(corrected.relationshipOverrides["fictional-moment-1"].crossJourneyCandidates).toEqual(["route-3"]);
    expect(applyPostImportEvidence(corrected, correction).moments).toHaveLength(57);
  });

  it("makes twenty identical correction submissions idempotent and persists the correction after reload", () => {
    let document = stageRecovery(validateRecoveryLedger(fixture()).ledger!, companions, hashes).document;
    const results = Array.from({ length: 20 }, () => { const result = applyAuthorReviewAction(document, "fictional-moment-1", "save-correction-and-accept-evidence", "A fictional correction.", new Date("2026-08-23T12:00:00Z")); document = result.document; return result.created; });
    expect(results.filter(Boolean)).toHaveLength(1);
    const reloaded = migrateStagedRecovery(JSON.parse(JSON.stringify(document)));
    expect(reloaded.review["fictional-moment-1"].decisions).toHaveLength(1);
    expect(reloaded.review["fictional-moment-1"].currentAuthorCorrection?.text).toBe("A fictional correction.");
    expect(reloaded.review["fictional-moment-1"].factualEvidenceStatus).toBe("accepted");
    expect(reloaded.review["fictional-moment-1"].editorialProposalStatus).toBe("pending");
  });

  it("creates a new version only for changed correction text and keeps the original source date as provenance", () => {
    const source = stageRecovery(validateRecoveryLedger(fixture()).ledger!, companions, hashes).document;
    const first = applyAuthorReviewAction(source, "fictional-moment-1", "save-correction-and-accept-evidence", "First fictional correction.", new Date("2026-08-23T12:00:00Z")).document;
    const changed = applyAuthorReviewAction(first, "fictional-moment-1", "save-correction-and-accept-evidence", "Changed fictional correction.", new Date("2026-08-23T12:01:00Z")).document;
    const current = setCurrentAuthorCorrection(changed, "fictional-moment-1", { text: "Changed fictional correction.", savedAt: "2026-08-23T12:01:00.000Z", sourceRevision: 3, payloadHash: "e".repeat(64), version: 2, effective: { dateLabel: "Tuesday, 14 July 2026", precision: "day", factualSummary: ["Fictional accepted fact."], unknowns: ["Fictional unknown."], retainedDetails: ["Fictional retained object."] } });
    expect(current.review["fictional-moment-1"].decisions).toHaveLength(2);
    expect(current.review["fictional-moment-1"].currentAuthorCorrection?.effective?.dateLabel).toBe("Tuesday, 14 July 2026");
    expect(current.moments[0].when.start).toBe("2026-07-02");
  });

  it("collapses only exact accidental duplicates and leaves other Moment decisions intact", () => {
    let document = stageRecovery(validateRecoveryLedger(fixture()).ledger!, companions, hashes).document;
    const first = applyAuthorReviewAction(document, "fictional-moment-1", "revise", "Legacy fictional revision.", new Date("2026-08-23T12:00:00Z")).document;
    const duplicateState = { ...first, review: { ...first.review, "fictional-moment-1": { ...first.review["fictional-moment-1"], decisions: Array.from({ length: 20 }, () => first.review["fictional-moment-1"].decisions[0]) } } };
    document = applyAuthorReviewAction(duplicateState, "fictional-moment-2", "accept-evidence", undefined, new Date("2026-08-23T12:01:00Z")).document;
    const cleaned = collapseExactDuplicateDecisions(document, "fictional-moment-1", "f".repeat(64), new Date("2026-08-23T12:02:00Z"));
    expect(cleaned.removed).toBe(19);
    expect(cleaned.document.review["fictional-moment-1"].decisions).toHaveLength(1);
    expect(cleaned.document.review["fictional-moment-2"].decisions).toHaveLength(1);
  });

  it("preserves a raw NOVA response as author-stated private evidence without accepting a Moment or canonising it", () => {
    const source = stageRecovery(validateRecoveryLedger(fixture()).ledger!, companions, hashes).document;
    const sourceQuestionId = source.unansweredQuestions[0].id;
    const first = recordNovaQuestionResponse(source, { questionId: `author-gap:${sourceQuestionId}`, question: "Fictional source question?", sourceQuestionId, response: "First fictional answer.\nSecond fictional answer.", targetMomentIds: ["fictional-moment-1"] }, new Date("2026-08-26T12:00:00Z"));
    expect(first.created).toBe(true);
    expect(first.response.claims.map((claim) => claim.claim)).toEqual(["First fictional answer.", "Second fictional answer."]);
    expect(first.response.claims.every((claim) => claim.evidenceStatus === "author-stated")).toBe(true);
    expect(first.document.questionResponses).toHaveLength(1);
    expect(first.document.gapState.find((state) => state.questionId === sourceQuestionId)?.status).toBe("partially-resolved");
    expect(first.document.review["fictional-moment-1"].factualEvidenceStatus).toBe("pending");
    expect(first.document.moments[0].canonical).toBe(false);
    expect(recordNovaQuestionResponse(first.document, { questionId: `author-gap:${sourceQuestionId}`, question: "Fictional source question?", sourceQuestionId, response: "First fictional answer.\nSecond fictional answer.", targetMomentIds: ["fictional-moment-1"] }, new Date("2026-08-26T12:01:00Z")).created).toBe(false);
  });

  it("processes a saved NOVA inbox response locally into non-canonical evidence or an explicit held-unknown state", () => {
    const source = stageRecovery(validateRecoveryLedger(fixture()).ledger!, companions, hashes).document;
    const clear = recordNovaQuestionResponse(source, { questionId: "fictional-clear", question: "Fictional clear question?", response: "A fictional Author answer.", targetMomentIds: ["fictional-moment-1"] }, new Date("2026-08-26T12:00:00Z"));
    const held = recordNovaQuestionResponse(clear.document, { questionId: "fictional-held", question: "Fictional held question?", response: "Leave this unknown for now.", targetMomentIds: ["fictional-moment-2"] }, new Date("2026-08-26T12:01:00Z"));
    const processed = processNovaInbox(held.document, new Date("2026-08-26T12:02:00Z"));
    expect(processed.created).toBe(1);
    expect(processed.pending).toBe(0);
    expect(processed.document.questionResponses.map((response) => response.triage?.status)).toEqual(["applied-as-evidence", "held-unknown"]);
    expect(processed.document.postImportEvidence.at(-1)).toMatchObject({ targetMomentIds: ["fictional-moment-1"], canonical: false, claims: [{ claim: "A fictional Author answer.", evidenceStatus: "author-stated" }] });
    expect(processNovaInbox(processed.document, new Date("2026-08-26T12:03:00Z")).created).toBe(0);
  });

  it("closes an Author question only after an explicit instruction and preserves its raw NOVA answer as post-import evidence", () => {
    const source = stageRecovery(validateRecoveryLedger(fixture()).ledger!, companions, hashes).document;
    const sourceQuestionId = source.unansweredQuestions[0].id;
    const received = recordNovaQuestionResponse(source, { questionId: `author-gap:${sourceQuestionId}`, question: "Fictional source question?", sourceQuestionId, response: "A fictional Author answer.", targetMomentIds: [] }, new Date("2026-08-26T12:00:00Z"));
    const resolved = resolveNovaQuestionResponse(received.document, { responseId: received.response.id, targetMomentIds: ["fictional-moment-1", "fictional-moment-2"] }, new Date("2026-08-26T12:01:00Z"));
    expect(resolved.created).toBe(true);
    expect(resolved.document.gapState.find((state) => state.questionId === sourceQuestionId)?.status).toBe("resolved");
    expect(resolved.document.questionResponses[0].response).toBe("A fictional Author answer.");
    expect(resolved.evidence).toMatchObject({ targetMomentIds: ["fictional-moment-1", "fictional-moment-2"], claims: [{ claim: "A fictional Author answer.", evidenceStatus: "author-stated" }], canonical: false });
    expect(resolved.document.moments[0].canonical).toBe(false);
    expect(resolveNovaQuestionResponse(resolved.document, { responseId: received.response.id, targetMomentIds: ["fictional-moment-1", "fictional-moment-2"] }, new Date("2026-08-26T12:02:00Z")).created).toBe(false);
  });

  it("reuses an already accepted NOVA response instead of duplicating its evidence during inbox processing", () => {
    const source = stageRecovery(validateRecoveryLedger(fixture()).ledger!, companions, hashes).document;
    const sourceQuestionId = source.unansweredQuestions[0].id;
    const received = recordNovaQuestionResponse(source, { questionId: `author-gap:${sourceQuestionId}`, question: "Fictional source question?", sourceQuestionId, response: "A fictional Author answer.", targetMomentIds: ["fictional-moment-1"] }, new Date("2026-08-26T12:00:00Z"));
    const resolved = resolveNovaQuestionResponse(received.document, { responseId: received.response.id, targetMomentIds: ["fictional-moment-1"] }, new Date("2026-08-26T12:01:00Z"));
    const processed = processNovaInbox(resolved.document, new Date("2026-08-26T12:02:00Z"));
    expect(processed.created).toBe(0);
    expect(processed.document.postImportEvidence).toHaveLength(1);
    expect(processed.document.questionResponses[0].triage?.evidenceId).toBe(resolved.evidence.id);
  });

  it("adds direct Author timeline evidence as a separate non-canonical layer", () => {
    const source = stageRecovery(validateRecoveryLedger(fixture()).ledger!, companions, hashes).document;
    const result = recordDirectAuthorEvidence(source, { label: "Fictional Author timeline correction", targetMomentIds: ["fictional-moment-1"], claims: ["A fictional date correction.", "A fictional shift correction."] }, new Date("2026-08-26T12:00:00Z"));
    expect(result.created).toBe(true);
    expect(result.evidence).toMatchObject({ targetMomentIds: ["fictional-moment-1"], canonical: false, claims: [{ claim: "A fictional date correction.", evidenceStatus: "author-stated" }, { claim: "A fictional shift correction.", evidenceStatus: "author-stated" }] });
    expect(result.document.moments[0].when.start).toBe("2026-07-02");
    expect(recordDirectAuthorEvidence(result.document, { label: "Fictional Author timeline correction", targetMomentIds: ["fictional-moment-1"], claims: ["A fictional date correction.", "A fictional shift correction."] }, new Date("2026-08-26T12:01:00Z")).created).toBe(false);
  });

  it("holds an assistant-proposed thread beside existing evidence without changing a Moment or canon", () => {
    const source = stageRecovery(validateRecoveryLedger(fixture()).ledger!, companions, hashes).document;
    const first = createNovaThreadProposal(source, { momentId: "fictional-moment-1", title: "Untitled private editorial thread" }, new Date("2026-08-26T12:00:00Z"));
    expect(first.created).toBe(true);
    expect(first.thread).toMatchObject({ title: "Untitled private editorial thread", sourceMomentIds: ["fictional-moment-1"], status: "assistant-proposed", canonical: false, reviewStatus: "pending" });
    expect(first.document.moments[0].canonical).toBe(false);
    expect(first.document.review["fictional-moment-1"].factualEvidenceStatus).toBe("pending");
    expect(first.document.relationshipOverrides["fictional-moment-1"].threadProposals).toEqual(["Untitled private editorial thread"]);
    expect(createNovaThreadProposal(first.document, { momentId: "fictional-moment-1", title: "Untitled private editorial thread" }, new Date("2026-08-26T12:01:00Z")).created).toBe(false);
  });
});
