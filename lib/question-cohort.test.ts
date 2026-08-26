import { describe, expect, it } from "vitest";
import { buildNextQuestionCohort } from "@/lib/question-cohort";
import type { StagedRecovery } from "@/lib/private-recovery";

function documentFixture() {
  return {
    unansweredQuestions: [
      { id: "resolved", question: "Resolved fictional question?" },
      { id: "partial", question: "Partly settled fictional question?" },
      { id: "open", question: "Can you verify Fictional Track at the fictional event?" },
    ],
    gapState: [{ questionId: "resolved", status: "resolved" }, { questionId: "partial", status: "partially-resolved" }, { questionId: "open", status: "unresolved" }],
    questionResponses: [],
    moments: [
      {
        id: "fictional-a", title: "Fictional uncertain record", journeyCandidate: "fictional-journey", authorStatement: "A fictional event with Fictional Track.", whatOccurred: ["A fictional source-recorded event."], peopleAliases: ["Fictional performer"], contradictions: ["Two fictional sources disagree."], when: { start: null, end: null, precision: "approximate" }, where: { precision: "unknown", privateLabel: null }, music: [{ track: "Fictional Track", artist: null, encounterType: "heard-live", evidenceStatus: "source-recorded" }], claimLedger: [{ claim: "A fictional claim.", evidenceStatus: "contradicted" }], provenance: [{ chatTitle: "Fictional source", messageDate: "2026-01-01", evidenceStatus: "source-recorded" }], unknowns: [],
      },
      { id: "fictional-excluded", title: "Excluded fictional record", journeyCandidate: "fictional-journey", authorStatement: "Excluded fictional source.", whatOccurred: [], peopleAliases: [], contradictions: ["Ignore this."], when: { start: null, end: null, precision: "approximate" }, where: { precision: "unknown", privateLabel: null }, music: [], claimLedger: [], provenance: [], unknowns: [] },
    ],
    review: { "fictional-a": { excluded: false }, "fictional-excluded": { excluded: true } },
  } as unknown as StagedRecovery;
}

describe("next-question cohort", () => {
  it("keeps resolved source questions out, carries partial questions forward, and does not mutate evidence", () => {
    const document = documentFixture();
    const cohort = buildNextQuestionCohort(document, 12);
    expect(cohort.map((question) => question.id)).not.toContain("author-gap:resolved");
    expect(cohort.find((question) => question.id === "author-gap:partial")?.signal).toBe("partial-author-gap");
    expect(cohort.find((question) => question.id === "contradiction:fictional-a")?.evidenceMomentIds).toEqual(["fictional-a"]);
    expect(cohort.find((question) => question.id === "contradiction:fictional-a")?.context[0]).toMatchObject({ momentId: "fictional-a", when: "date unknown · approximate", who: ["Fictional performer"] });
    expect(cohort.find((question) => question.id === "author-gap:open")?.context.map((packet) => packet.momentId)).toEqual(["fictional-a"]);
    expect(cohort.find((question) => question.id === "music:fictional-a")?.question).toContain("Fictional Track is recorded");
    expect(cohort.find((question) => question.id === "music:fictional-a")?.question).toContain("track only");
    expect(cohort.some((question) => question.id.includes("fictional-excluded"))).toBe(false);
    expect(document.moments[0].when.start).toBeNull();
  });

  it("ranks unresolved Author questions before routine field-completeness prompts", () => {
    const cohort = buildNextQuestionCohort(documentFixture(), 12);
    expect(cohort[0].id).toBe("author-gap:open");
  });

  it("moves a prompt out of the active cohort after its NOVA response is saved", () => {
    const document = documentFixture();
    document.questionResponses = [{ questionId: "contradiction:fictional-a" }] as StagedRecovery["questionResponses"];
    expect(buildNextQuestionCohort(document, 12).some((question) => question.id === "contradiction:fictional-a")).toBe(false);
  });

  it("keeps a source contradiction in the ledger but removes its prompt after an Author correction is saved", () => {
    const document = documentFixture();
    document.review["fictional-a"].currentAuthorCorrection = { text: "Fictional Author correction." } as never;
    expect(buildNextQuestionCohort(document, 12).some((question) => question.id === "contradiction:fictional-a")).toBe(false);
    expect(buildNextQuestionCohort(document, 12).some((question) => question.id.includes("fictional-a"))).toBe(false);
    expect(document.moments[0].contradictions).toEqual(["Two fictional sources disagree."]);
  });

  it("does not re-ask a contradiction which the source itself marks superseded", () => {
    const document = documentFixture();
    document.moments[0].contradictions = ["A fictional earlier note was superseded by an Author correction."];
    expect(buildNextQuestionCohort(document, 12).some((question) => question.id === "contradiction:fictional-a")).toBe(false);
  });

  it("does not re-ask a contradiction whose source note already records the Author confirmation", () => {
    const document = documentFixture();
    document.moments[0].contradictions = ["A competing fictional quote exists; the Author confirms the first fictional record was used."];
    expect(buildNextQuestionCohort(document, 12).some((question) => question.id === "contradiction:fictional-a")).toBe(false);
  });

  it("does not auto-surface restricted Moments in a general cohort", () => {
    const document = documentFixture();
    document.moments[0].sensitivity = "restricted";
    expect(buildNextQuestionCohort(document, 12).some((question) => question.id.includes("fictional-a"))).toBe(false);
  });

  it("does not turn a fully blank music slot into an Author question", () => {
    const document = documentFixture();
    document.moments[0].music = [{ track: null, artist: null }] as never;
    expect(buildNextQuestionCohort(document, 12).some((question) => question.id === "music:fictional-a")).toBe(false);
  });
});
