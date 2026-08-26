import type { StagedRecovery } from "@/lib/private-recovery";

export type QuestionSignal = "author-gap" | "partial-author-gap" | "contradiction" | "missing-date" | "unknown-place" | "incomplete-music" | "unsettled-evidence";
export type QuestionMemoryPacket = {
  momentId: string;
  title: string;
  journey: string;
  when: string;
  where: string;
  who: string[];
  what: string[];
  music: string[];
  howKnown: string[];
};
export type LocalQuestion = {
  id: string;
  signal: QuestionSignal;
  question: string;
  whyNow: string;
  score: number;
  evidenceMomentIds: string[];
  sourceQuestionId?: string;
  /** The source notes that disagree, shown verbatim for an explicit review. */
  contradictions?: string[];
  /** Local source context for orienting the Author, never an answer or inference. */
  context: QuestionMemoryPacket[];
};

const signalLabel: Record<QuestionSignal, string> = {
  "author-gap": "original Author question",
  "partial-author-gap": "partially resolved Author question",
  contradiction: "unresolved contradiction",
  "missing-date": "missing time evidence",
  "unknown-place": "unknown place precision",
  "incomplete-music": "incomplete music evidence",
  "unsettled-evidence": "evidence still needs review",
};

export function questionSignalLabel(signal: QuestionSignal) { return signalLabel[signal]; }

const CONTEXT_STOP_WORDS = new Set([
  "about", "after", "artist", "can", "did", "does", "exact", "from", "have", "identify", "into", "missed", "more", "question", "remains", "second", "should", "source", "spellings", "that", "the", "this", "track", "what", "when", "which", "with", "you", "your",
]);

function terms(value: string) {
  return [...new Set(value.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((term) => term.length >= 3 && !CONTEXT_STOP_WORDS.has(term)) ?? [])];
}

function formatWhen(moment: StagedRecovery["moments"][number]) {
  const start = moment.when.start?.slice(0, 10) ?? "date unknown";
  const end = moment.when.end?.slice(0, 10);
  return `${end && end !== start ? `${start} to ${end}` : start} · ${moment.when.precision}`;
}

function formatMusic(moment: StagedRecovery["moments"][number]) {
  return moment.music.map((item) => {
    const credit = [item.track, item.artist].filter(Boolean).join(" — ");
    return `${credit || "track / artist incomplete"} · ${item.encounterType} · ${item.evidenceStatus}`;
  });
}

function musicPrompt(moment: StagedRecovery["moments"][number], missingMusic: StagedRecovery["moments"][number]["music"]) {
  const artistsWithoutTracks = [...new Set(missingMusic.filter((item) => item.artist && !item.track).map((item) => item.artist!))];
  const tracksWithoutArtists = [...new Set(missingMusic.filter((item) => item.track && !item.artist).map((item) => item.track!))];
  if (artistsWithoutTracks.length) return {
    question: `${artistsWithoutTracks.join(" · ")} is recorded in “${moment.title}”, but no song title is stored. Was there a specific track? If not, “artist only” is a complete answer.`,
    whyNow: "The artist is already known; only the optional track detail is missing. This does not establish playback or meaning.",
  };
  if (tracksWithoutArtists.length) return {
    question: `${tracksWithoutArtists.join(" · ")} is recorded in “${moment.title}”, but no artist is stored. Do you remember the artist? If not, “track only” is a complete answer.`,
    whyNow: "The track title is already known; only the optional artist detail is missing. This does not establish playback or meaning.",
  };
  return {
    question: `A music reference in “${moment.title}” has neither a track nor artist. What, if anything, do you remember? “No specific music” is a complete answer.`,
    whyNow: "This is an optional memory cue, not a request to manufacture a music association.",
  };
}

function memoryPacket(moment: StagedRecovery["moments"][number]): QuestionMemoryPacket {
  return {
    momentId: moment.id,
    title: moment.title,
    journey: moment.journeyCandidate,
    when: formatWhen(moment),
    where: `${moment.where.privateLabel ?? "location unknown"} · ${moment.where.precision}`,
    who: moment.peopleAliases,
    what: moment.whatOccurred.length ? moment.whatOccurred : ["No concise event description has been recorded."],
    music: formatMusic(moment),
    howKnown: moment.provenance.map((item) => `${item.chatTitle} · ${item.messageDate} · ${item.evidenceStatus}`),
  };
}

function sourceQuestionContext(document: StagedRecovery, question: string) {
  const queryTerms = terms(question);
  if (!queryTerms.length) return [];

  return document.moments
    .filter((moment) => !document.review[moment.id]?.excluded)
    .map((moment) => {
      // Matching is deliberately lexical and local. It proposes related evidence
      // for recall, but it neither claims that a match resolves the question nor
      // creates a relationship in the underlying recovery ledger.
      const searchable = [
        moment.title,
        moment.authorStatement,
        ...moment.whatOccurred,
        ...moment.peopleAliases,
        ...moment.music.flatMap((item) => [item.track ?? "", item.artist ?? ""]),
        ...moment.claimLedger.map((claim) => claim.claim),
        ...moment.unknowns,
        ...moment.contradictions,
      ].join(" ").toLowerCase();
      const score = queryTerms.reduce((sum, term) => sum + (searchable.includes(term) ? 1 : 0), 0);
      return { moment, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.moment.id.localeCompare(b.moment.id))
    .slice(0, 3)
    .map(({ moment }) => memoryPacket(moment));
}

/**
 * A deterministic, local question ranker. It only reads already-loaded private
 * evidence and returns review prompts; it neither answers a prompt nor mutates
 * any Moment, relationship, Journey, or gap state.
 */
export function buildNextQuestionCohort(document: StagedRecovery, limit = 8): LocalQuestion[] {
  const gapStates = new Map(document.gapState.map((state) => [state.questionId, state]));
  const answeredQuestionIds = new Set(document.questionResponses.map((response) => response.questionId));
  const candidates: LocalQuestion[] = document.unansweredQuestions.flatMap((sourceQuestion) => {
    const state = gapStates.get(sourceQuestion.id)?.status ?? "unresolved";
    if (state === "resolved") return [];
    return [{
      id: `author-gap:${sourceQuestion.id}`,
      signal: state === "partially-resolved" ? "partial-author-gap" : "author-gap",
      question: state === "partially-resolved" ? `What remains to clarify: ${sourceQuestion.question}` : sourceQuestion.question,
      whyNow: state === "partially-resolved" ? "This source question is marked partially resolved, so only its remaining unknown should be revisited." : "This is an unresolved question carried from the Author-gap companion.",
      score: state === "partially-resolved" ? 116 : 120,
      evidenceMomentIds: [],
      sourceQuestionId: sourceQuestion.id,
      context: sourceQuestionContext(document, sourceQuestion.question),
    }];
  });

  for (const moment of document.moments) {
    const review = document.review[moment.id];
    // Restricted material is never auto-surfaced in a general review cohort.
    // A saved Author correction is treated as the stop signal for routine
    // completeness prompts on that Moment; the underlying source remains
    // available privately without turning into repetitive follow-up questions.
    if (review?.excluded || moment.sensitivity === "restricted") continue;
    const hasAuthorCorrection = Boolean(review?.currentAuthorCorrection);
    // A saved Author correction, or a source note explicitly marked
    // superseded, is the visible resolution for a source contradiction. Keep
    // the original in the ledger/audit, but do not keep asking the Author as
    // though it were still an open decision.
    const actionableContradictions = moment.contradictions.filter((note) => !/\b(?:superseded|resolved|author\s+(?:now\s+)?confirms)\b/iu.test(note));
    if (actionableContradictions.length && !hasAuthorCorrection) candidates.push({
      id: `contradiction:${moment.id}`,
      signal: "contradiction",
      question: `Two source notes disagree about “${moment.title}”. What should your current record say?`,
      whyNow: "Read the conflicting notes below. You can choose one, write a different correction in your own words, or say to leave this unknown.",
      score: 100 + Math.min(actionableContradictions.length, 5) * 4,
      evidenceMomentIds: [moment.id],
      context: [memoryPacket(moment)],
      contradictions: actionableContradictions,
    });
    if (!moment.when.start && !hasAuthorCorrection) candidates.push({
      id: `missing-date:${moment.id}`,
      signal: "missing-date",
      question: `When did “${moment.title}” happen—at least as a day, date range, or approximate window?`,
      whyNow: "The Moment has no starting time evidence; a precise timestamp is not required.",
      score: 88,
      evidenceMomentIds: [moment.id],
      context: [memoryPacket(moment)],
    });
    // Unknown place precision is metadata, not a high-value Author question.
    // It remains explicitly unknown in the private ledger and can be filled in
    // during a focused location pass, rather than crowding a life-review queue.
    // A completely blank source slot is not music evidence. It may later be
    // correlated against a consented listening-history import, but until then
    // it is not an Author question. Only an actual partial reference (artist
    // without track, or track without artist) can usefully be clarified.
    const missingMusic = moment.music.filter((item) => Boolean(item.track || item.artist) && (!item.track || !item.artist));
    const musicQuestion = musicPrompt(moment, missingMusic);
    if (missingMusic.length && !hasAuthorCorrection) candidates.push({
      id: `music:${moment.id}`,
      signal: "incomplete-music",
      question: musicQuestion.question,
      whyNow: musicQuestion.whyNow,
      score: 76 + Math.min(missingMusic.length, 3) * 3,
      evidenceMomentIds: [moment.id],
      context: [memoryPacket(moment)],
    });
    const unsettledClaims = moment.claimLedger.filter((claim) => ["unknown", "contradicted", "assistant-proposed"].includes(claim.evidenceStatus));
    if (unsettledClaims.length && !moment.contradictions.length && !hasAuthorCorrection) candidates.push({
      id: `evidence:${moment.id}`,
      signal: "unsettled-evidence",
      question: `Which part of “${moment.title}” has a source you want to add, revise, or keep explicitly unknown?`,
      whyNow: `${unsettledClaims.length} claim${unsettledClaims.length === 1 ? " remains" : "s remain"} non-final in the evidence ledger.`,
      score: 62 + Math.min(unsettledClaims.length, 4) * 3,
      evidenceMomentIds: [moment.id],
      context: [memoryPacket(moment)],
    });
  }

  return candidates
    .filter((question) => !answeredQuestionIds.has(question.id))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit);
}
