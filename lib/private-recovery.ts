import { createHash } from "node:crypto";
import { z } from "zod";

export const recoveryEvidenceStatusSchema = z.enum([
  "author-stated",
  "source-recorded",
  "assistant-proposed",
  "inferred",
  "unknown",
  "contradicted",
]);

const temporalPrecisionSchema = z.enum(["exact", "day", "range", "approximate"]);
const locationPrecisionSchema = z.enum(["venue", "city", "route", "approximate", "unknown"]);
const sensitivitySchema = z.enum(["normal", "restricted"]);
const encounterTypeSchema = z.enum(["heard-live", "heard-recorded", "mentioned", "missed", "playlist"]);

export const recoveryMomentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  privacy: z.literal("private"),
  reviewStatus: z.literal("pending"),
  canonical: z.literal(false),
  sensitivity: sensitivitySchema.optional().default("normal"),
  journeyCandidate: z.string().min(1),
  when: z.object({
    start: z.string().nullable(),
    end: z.string().nullable(),
    timezone: z.string().min(1),
    precision: temporalPrecisionSchema,
  }),
  where: z.object({
    privateLabel: z.string().nullable(),
    publicGeneralisation: z.string().nullable(),
    precision: locationPrecisionSchema,
  }),
  authorStatement: z.string(),
  whatOccurred: z.array(z.string()),
  claimLedger: z.array(z.object({ claim: z.string().min(1), evidenceStatus: recoveryEvidenceStatusSchema })).min(1),
  sensoryDetailsExplicitlyStated: z.array(z.string()),
  emotionsExplicitlyStated: z.array(z.string()),
  music: z.array(z.object({
    track: z.string().min(1).nullable(), artist: z.string().min(1).nullable(), spotifyUri: z.string().nullable(),
    encounterType: encounterTypeSchema, evidenceStatus: recoveryEvidenceStatusSchema,
  })),
  occurrences: z.array(z.object({ kind: z.string().min(1), sourcePosition: z.number().int().nonnegative().nullable(), occurredAt: z.string().nullable(), detail: z.string().min(1) })).default([]),
  accessibilityConsideration: z.string().nullable(),
  peopleAliases: z.array(z.string()),
  objectsAndArtefacts: z.array(z.string()),
  provenance: z.array(z.object({
    author: z.enum(["user", "source", "assistant"]), chatTitle: z.string().min(1), messageDate: z.string().min(1),
    shortExcerpt: z.string().min(1), evidenceStatus: recoveryEvidenceStatusSchema,
  })).min(1),
  contradictions: z.array(z.string()),
  unknowns: z.array(z.string()),
  editorialProposals: z.array(z.string()),
}).superRefine((moment, context) => {
  for (const [label, value] of [["start", moment.when.start], ["end", moment.when.end]] as const) {
    if (value !== null && (Number.isNaN(Date.parse(value)) || !/^(\d{4}-\d{2}-\d{2})(?:T|$)/u.test(value))) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["when", label], message: "Expected an ISO local date or date-time." });
    }
  }
  if (!/^[A-Za-z]+(?:\/[A-Za-z_+-]+)+$/u.test(moment.when.timezone)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["when", "timezone"], message: "Expected an IANA timezone." });
  }
  try { Intl.DateTimeFormat("en", { timeZone: moment.when.timezone }); } catch { context.addIssue({ code: z.ZodIssueCode.custom, path: ["when", "timezone"], message: "Unknown IANA timezone." }); }
  for (const music of moment.music) {
    if (music.spotifyUri && (!/^spotify:track:[A-Za-z0-9]+$/u.test(music.spotifyUri) || /[?&](?:si|pt)=/iu.test(music.spotifyUri))) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["music"], message: "Music may store a Spotify track URI only; share parameters are forbidden." });
    }
  }
});

const threadSchema = z.object({
  title: z.string().min(1), privacy: z.literal("private"), reviewStatus: z.literal("pending"), canonical: z.literal(false), status: z.literal("assistant-proposed"), tests: z.array(z.string()),
  sourceMomentIds: z.array(z.string().min(1)).default([]),
  proposal: z.string().min(1).optional(),
  createdAt: z.string().datetime({ offset: true }).optional(),
});
const playlistSourceSchema = z.object({ name: z.string().min(1), spotifyPlaylistId: z.string().min(1), privacy: z.literal("private"), reviewStatus: z.literal("pending"), canonical: z.literal(false), role: z.string().min(1), importStatus: z.string().min(1) }).superRefine((playlist, context) => {
  if (/[?&](?:si|pt)=/iu.test(playlist.spotifyPlaylistId) || /[/?]/u.test(playlist.spotifyPlaylistId)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["spotifyPlaylistId"], message: "Store playlist IDs only, without URLs or share parameters." });
});

export const recoveryLedgerSchema = z.object({
  bundleVersion: z.string().min(1), privacy: z.literal("private"), reviewStatus: z.literal("pending"), canonical: z.literal(false),
  scope: z.object({ start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u), timezoneDefault: z.string().min(1) }),
  accessAudit: z.unknown(), sourceInventory: z.unknown(), moments: z.array(recoveryMomentSchema), provisionalThreads: z.array(threadSchema), coverageReport: z.object({
    totalMoments: z.number().int(), momentCountsByJourney: z.record(z.number().int()), momentsWithMusicalEvidence: z.number().int(), momentsWithExplicitlyStatedEmotion: z.number().int(), momentsWithAccessibilityObservations: z.number().int(), momentsWithUnresolvedContradictions: z.number().int(), completenessConfidence: z.literal("medium"),
  }).passthrough(), playlistSources: z.array(playlistSourceSchema),
});

export type RecoveryMoment = z.infer<typeof recoveryMomentSchema>;
export type RecoveryLedger = z.infer<typeof recoveryLedgerSchema>;
export type RecoveryDecisionAction = "accept-evidence" | "revise" | "save-correction-and-accept-evidence" | "refuse-interpretation" | "exclude-entirely" | "keep-unresolved";

export const recoveryDecisionSchema = z.object({ action: z.enum(["accept-evidence", "revise", "save-correction-and-accept-evidence", "refuse-interpretation", "exclude-entirely", "keep-unresolved"]), at: z.string().datetime({ offset: true }), note: z.string().min(1).optional(), sourceRevision: z.number().int().positive().optional(), payloadHash: z.string().regex(/^[a-f0-9]{64}$/u).optional() });
const currentCorrectionSchema = z.object({ text: z.string().min(1), savedAt: z.string().datetime({ offset: true }), sourceRevision: z.number().int().positive(), payloadHash: z.string().regex(/^[a-f0-9]{64}$/u), version: z.number().int().positive(), effective: z.object({ dateLabel: z.string().min(1), precision: z.string().min(1), factualSummary: z.array(z.string()).min(1), unknowns: z.array(z.string()), retainedDetails: z.array(z.string()) }).optional() });
const delegatedSourceReviewSchema = z.object({ at: z.string().datetime({ offset: true }), acceptedPaths: z.array(z.string().min(1)).min(1), note: z.string().min(1) });
export const recoveryDecisionStateSchema = z.object({ decisions: z.array(recoveryDecisionSchema).default([]), excluded: z.boolean().default(false), factualEvidenceStatus: z.enum(["pending", "accepted"]).default("pending"), editorialProposalStatus: z.enum(["pending", "refused", "accepted", "revised"]).default("pending"), currentAuthorCorrection: currentCorrectionSchema.optional(), delegatedSourceReview: delegatedSourceReviewSchema.optional(), auditNotes: z.array(z.object({ kind: z.enum(["duplicate-collapse"]), at: z.string().datetime({ offset: true }), detail: z.string().min(1), backupSha256: z.string().regex(/^[a-f0-9]{64}$/u).optional() })).default([]) });

export const stagedRecoveryV2Schema = z.object({
  schemaVersion: z.literal(2), kind: z.literal("storywalker-private-recovery"), privacy: z.literal("private"), canonical: z.literal(false), reviewStatus: z.literal("pending"),
  scope: recoveryLedgerSchema.shape.scope, sourceOrder: z.array(z.string()), moments: z.array(recoveryMomentSchema),
  journeys: z.array(z.object({ id: z.string().min(1), privacy: z.literal("private"), canonical: z.literal(false), reviewStatus: z.literal("pending"), status: z.literal("provisional"), sourceMomentIds: z.array(z.string()) })),
  threads: z.array(threadSchema), episodes: z.array(z.never()).length(0), playlistSources: z.array(playlistSourceSchema),
  review: z.record(recoveryDecisionStateSchema), conflicts: z.array(z.object({ momentId: z.string(), fields: z.array(z.string()), local: recoveryMomentSchema, incoming: recoveryMomentSchema, createdAt: z.string().datetime({ offset: true }) })),
  unansweredQuestions: z.array(z.object({ id: z.string(), question: z.string().min(1), status: z.literal("unresolved"), source: z.literal("gaps-companion") })),
  companions: z.object({ authorReviewMarkdown: z.string(), gapsMarkdown: z.string(), importPromptMarkdown: z.string() }),
  inputHashes: z.record(z.string().regex(/^[a-f0-9]{64}$/u)),
  coverageReport: recoveryLedgerSchema.shape.coverageReport,
});

const postImportEvidenceSchema = z.object({ id: z.string().min(1), recordedAt: z.string().min(1), privacy: z.literal("private").default("private"), reviewStatus: z.literal("pending").default("pending"), canonical: z.literal(false).default(false), targetMomentIds: z.array(z.string()).min(1), claims: z.array(z.object({ claim: z.string().min(1), evidenceStatus: recoveryEvidenceStatusSchema })).min(1), supersedes: z.array(z.string()), provenance: z.object({ author: z.literal("user"), label: z.string().min(1) }) });
const gapStateSchema = z.object({ questionId: z.string().min(1), status: z.enum(["resolved", "partially-resolved", "unresolved"]), supersededStatement: z.string().min(1).optional() });
const relationshipOverrideSchema = z.object({ primaryJourney: z.string().min(1), crossJourneyCandidates: z.array(z.string()), threadProposals: z.array(z.string()) });
export const novaQuestionResponseInputSchema = z.object({ questionId: z.string().trim().min(1).max(240), question: z.string().trim().min(1).max(1_000), sourceQuestionId: z.string().trim().min(1).max(240).optional(), response: z.string().trim().min(1).max(8_000), targetMomentIds: z.array(z.string().trim().min(1).max(240)).max(8) });
export const novaThreadProposalInputSchema = z.object({ momentId: z.string().trim().min(1).max(240), title: z.string().trim().min(1).max(160) });
export const novaQuestionResolutionInputSchema = z.object({ responseId: z.string().trim().min(1).max(240), targetMomentIds: z.array(z.string().trim().min(1).max(240)).min(1).max(8) });
export const directAuthorEvidenceInputSchema = z.object({ label: z.string().trim().min(1).max(240), targetMomentIds: z.array(z.string().trim().min(1).max(240)).min(1).max(8), claims: z.array(z.string().trim().min(1).max(2_000)).min(1).max(24) });
const novaTriageSchema = z.object({ status: z.enum(["applied-as-evidence", "held-unknown", "waiting-for-history-import"]), processedAt: z.string().datetime({ offset: true }), evidenceId: z.string().min(1).optional(), note: z.string().min(1) });
const novaQuestionResponseSchema = novaQuestionResponseInputSchema.extend({ id: z.string().min(1), recordedAt: z.string().datetime({ offset: true }), privacy: z.literal("private"), canonical: z.literal(false), status: z.literal("received"), filter: z.literal("nova-local-v1"), claims: z.array(z.object({ claim: z.string().min(1), evidenceStatus: z.literal("author-stated") })).min(1), triage: novaTriageSchema.optional() });

export const stagedRecoveryV3Schema = stagedRecoveryV2Schema.extend({
  schemaVersion: z.literal(3), sourceBundle: z.object({ originalMomentCount: z.literal(56), originalMomentIds: z.array(z.string()).length(56), originalInputHashes: z.record(z.string().regex(/^[a-f0-9]{64}$/u)) }),
  postImportEvidence: z.array(postImportEvidenceSchema), gapState: z.array(gapStateSchema), relationshipOverrides: z.record(relationshipOverrideSchema), questionResponses: z.array(novaQuestionResponseSchema).default([]),
});
export const stagedRecoverySchema = z.union([stagedRecoveryV2Schema, stagedRecoveryV3Schema]);
export type StagedRecovery = z.infer<typeof stagedRecoveryV3Schema>;

export function migrateStagedRecovery(input: unknown): StagedRecovery {
  const document = stagedRecoverySchema.parse(input);
  if (document.schemaVersion === 3) return document;
  return stagedRecoveryV3Schema.parse({ ...document, schemaVersion: 3, sourceBundle: { originalMomentCount: 56, originalMomentIds: document.sourceOrder, originalInputHashes: document.inputHashes }, postImportEvidence: [], gapState: document.unansweredQuestions.map((question) => ({ questionId: question.id, status: "unresolved" })), relationshipOverrides: {}, questionResponses: [] });
}

export function sha256(content: string) { return createHash("sha256").update(content).digest("hex"); }

function secretFindings(value: unknown, path = ""): string[] {
  if (typeof value === "string") return [/(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\+\d[\d ()-]{7,}\d|\(\d{2,4}\)\s*\d[\d -]{5,}\d|\b(?:booking|confirmation)\s*(?:id|code|number)\s*[:#]\s*[A-Z0-9]{6,}\b)/iu.test(value) ? path || "root" : ""].filter(Boolean);
  if (Array.isArray(value)) return value.flatMap((item, index) => secretFindings(item, `${path}[${index}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => secretFindings(item, path ? `${path}.${key}` : key));
  return [];
}

export function validateRecoveryLedger(input: unknown) {
  const parsed = recoveryLedgerSchema.safeParse(input);
  const errors = parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  if (!parsed.success) return { ledger: undefined, errors, warnings: [] as string[] };
  const ledger = parsed.data;
  const ids = new Set<string>();
  for (const moment of ledger.moments) { if (ids.has(moment.id)) errors.push(`moments.${moment.id}: duplicate Moment ID`); ids.add(moment.id); }
  const counts = Object.values(ledger.coverageReport.momentCountsByJourney).sort((a, b) => a - b);
  if (ledger.scope.start !== "2026-07-11" || ledger.scope.end !== "2026-08-19") errors.push("scope: expected 11 July–19 August 2026");
  if (ledger.moments.length !== 56 || ledger.coverageReport.totalMoments !== 56) errors.push("moments: expected 56 candidates");
  if (ledger.coverageReport.momentCountsByJourney && (counts.length !== 7 || counts.join(",") !== "3,3,5,6,7,15,17")) errors.push("coverageReport.momentCountsByJourney: expected seven Journey counts");
  if (ledger.coverageReport.momentsWithMusicalEvidence !== 15 || ledger.coverageReport.momentsWithExplicitlyStatedEmotion !== 22 || ledger.coverageReport.momentsWithAccessibilityObservations !== 3 || ledger.coverageReport.momentsWithUnresolvedContradictions !== 7) errors.push("coverageReport: expected recovered music, emotion, accessibility, and contradiction totals");
  if (ledger.moments.filter((moment) => moment.music.length > 0).length !== 15) errors.push("moments: expected 15 Moments with a music relationship");
  if (ledger.moments.filter((moment) => moment.emotionsExplicitlyStated.length > 0).length !== 22) errors.push("moments: expected 22 Moments with explicitly stated emotion");
  if (ledger.moments.filter((moment) => moment.sensitivity === "restricted").length !== 4) errors.push("moments: expected four restricted records");
  const secretPaths = secretFindings(ledger.moments);
  if (secretPaths.length) errors.push(`detected contact or booking secret at ${secretPaths.slice(0, 5).join(", ")}`);
  const warnings = ledger.moments.flatMap((moment) => [
    moment.when.start === null ? `${moment.id}: missing start date` : "", moment.where.precision === "unknown" ? `${moment.id}: unknown location` : "", !moment.authorStatement.trim() ? `${moment.id}: empty Author statement` : "", !moment.music.length || moment.music.some((music) => !music.track || !music.artist) ? `${moment.id}: missing music metadata` : "", moment.contradictions.length ? `${moment.id}: unresolved contradiction` : "", moment.claimLedger.some((claim) => claim.evidenceStatus === "assistant-proposed") ? `${moment.id}: assistant-only candidate or claim` : "",
  ].filter(Boolean));
  return { ledger, errors, warnings };
}

function questionsFromGaps(markdown: string) {
  const section = markdown.split(/\n##\s+/u).find((part) => /six remaining high-value author questions/iu.test(part)) ?? "";
  return section.split(/\r?\n/u).flatMap((line, index) => { const match = line.match(/^\s*\d+\.\s+(.+\?)\s*$/u); return match ? [{ id: `gaps-question-${index + 1}`, question: match[1], status: "unresolved" as const, source: "gaps-companion" as const }] : []; });
}

function comparable(moment: RecoveryMoment) { return JSON.stringify(moment); }
function changedFields(local: RecoveryMoment, incoming: RecoveryMoment) { return Object.keys(incoming).filter((key) => JSON.stringify(local[key as keyof RecoveryMoment]) !== JSON.stringify(incoming[key as keyof RecoveryMoment])); }
function provisionalJourneys(moments: RecoveryMoment[]) { return [...new Map(moments.map((moment) => [moment.journeyCandidate, { id: moment.journeyCandidate, privacy: "private" as const, canonical: false as const, reviewStatus: "pending" as const, status: "provisional" as const, sourceMomentIds: moments.filter((candidate) => candidate.journeyCandidate === moment.journeyCandidate).map((candidate) => candidate.id) }])).values()]; }

export function stageRecovery(ledger: RecoveryLedger, companions: { authorReviewMarkdown: string; gapsMarkdown: string; importPromptMarkdown: string }, inputHashes: Record<string, string>, existingInput?: unknown, now = new Date()) {
  const newIds: string[] = [], unchangedIds: string[] = [], conflictingIds: string[] = [];
  const existing = existingInput ? migrateStagedRecovery(existingInput) : undefined;
  const oldMoments = new Map(existing?.moments.map((moment) => [moment.id, moment]));
  const oldReview = existing?.review ?? {};
  const oldConflicts = existing?.conflicts ?? [];
  const importedMoments = ledger.moments.map((incoming) => {
    const local = oldMoments.get(incoming.id);
    if (!local) { newIds.push(incoming.id); return incoming; }
    if (comparable(local) === comparable(incoming)) { unchangedIds.push(incoming.id); return local; }
    conflictingIds.push(incoming.id); return local;
  });
  const additions = existing?.moments.filter((moment) => !oldMoments.has(moment.id) || !ledger.moments.some((source) => source.id === moment.id)) ?? [];
  const moments = [...importedMoments, ...additions];
  const conflictById = new Set(oldConflicts.map((conflict) => `${conflict.momentId}:${comparable(conflict.incoming)}`));
  const conflicts = [...oldConflicts, ...ledger.moments.flatMap((incoming) => { const local = oldMoments.get(incoming.id); if (!local || comparable(local) === comparable(incoming) || conflictById.has(`${incoming.id}:${comparable(incoming)}`)) return []; return [{ momentId: incoming.id, fields: changedFields(local, incoming), local, incoming, createdAt: now.toISOString() }]; })];
  const review = Object.fromEntries(moments.map((moment) => [moment.id, oldReview[moment.id] ?? { decisions: [], excluded: false }]));
  return { document: stagedRecoveryV3Schema.parse({ schemaVersion: 3, kind: "storywalker-private-recovery", privacy: "private", canonical: false, reviewStatus: "pending", scope: ledger.scope, sourceOrder: [...ledger.moments.map((moment) => moment.id), ...additions.map((moment) => moment.id)], moments, journeys: provisionalJourneys(moments), threads: ledger.provisionalThreads, episodes: [], playlistSources: ledger.playlistSources, review, conflicts, unansweredQuestions: questionsFromGaps(companions.gapsMarkdown), companions, inputHashes, coverageReport: ledger.coverageReport, sourceBundle: existing?.sourceBundle ?? { originalMomentCount: 56, originalMomentIds: ledger.moments.map((moment) => moment.id), originalInputHashes: inputHashes }, postImportEvidence: existing?.postImportEvidence ?? [], gapState: existing?.gapState ?? questionsFromGaps(companions.gapsMarkdown).map((question) => ({ questionId: question.id, status: "unresolved" })), relationshipOverrides: existing?.relationshipOverrides ?? {}, questionResponses: existing?.questionResponses ?? [] }), summary: { newIds, unchangedIds, conflictingIds } };
}

function decisionPayloadHash(momentId: string, action: RecoveryDecisionAction, note: string | undefined, sourceRevision: number) { return sha256(JSON.stringify({ momentId, action, note: note ?? null, sourceRevision })); }

export function applyAuthorReviewAction(documentInput: unknown, momentId: string, action: RecoveryDecisionAction, note?: string, now = new Date()) {
  const document = migrateStagedRecovery(documentInput);
  if (!document.moments.some((moment) => moment.id === momentId)) throw new Error("Unknown private Moment.");
  const text = note?.trim();
  if ((action === "revise" || action === "save-correction-and-accept-evidence") && !text) throw new Error("A correction needs Author wording.");
  const current = recoveryDecisionStateSchema.parse(document.review[momentId] ?? {});
  const sourceRevision = document.schemaVersion;
  const payloadHash = decisionPayloadHash(momentId, action, text, sourceRevision);
  if (current.decisions.some((decision) => decision.action === action && (decision.note ?? undefined) === text && (decision.sourceRevision ?? sourceRevision) === sourceRevision && (decision.payloadHash ?? decisionPayloadHash(momentId, decision.action, decision.note, sourceRevision)) === payloadHash)) return { document, created: false, payloadHash };
  const decision = { action, at: now.toISOString(), ...(text ? { note: text } : {}), sourceRevision, payloadHash } as const;
  const correction = action === "save-correction-and-accept-evidence" ? { text: text!, savedAt: now.toISOString(), sourceRevision, payloadHash, version: (current.currentAuthorCorrection?.version ?? 0) + 1 } : current.currentAuthorCorrection;
  const nextState = { ...current, decisions: [...current.decisions, decision], excluded: action === "exclude-entirely" ? true : current.excluded, factualEvidenceStatus: action === "accept-evidence" || action === "save-correction-and-accept-evidence" ? "accepted" as const : current.factualEvidenceStatus, editorialProposalStatus: action === "refuse-interpretation" ? "refused" as const : current.editorialProposalStatus, ...(correction ? { currentAuthorCorrection: correction } : {}) };
  return { document: stagedRecoveryV3Schema.parse({ ...document, review: { ...document.review, [momentId]: nextState } }), created: true, payloadHash };
}

export function applyRecoveryDecision(document: StagedRecovery, momentId: string, action: RecoveryDecisionAction, note?: string, now = new Date()) { return applyAuthorReviewAction(document, momentId, action, note, now).document; }

export function applyDelegatedSourceReview(documentInput: unknown, now = new Date()) {
  const document = migrateStagedRecovery(documentInput);
  const note = "Delegated review on 2026-08-26: accepted only claim, music, and provenance entries explicitly labelled author-stated or source-recorded. Unknown, inferred, assistant-proposed, and contradicted material remains visible and unresolved; no editorial proposal was accepted as fact.";
  let reviewedMoments = 0;
  let acceptedItems = 0;
  const review = { ...document.review };
  for (const moment of document.moments) {
    const paths = [
      ...moment.claimLedger.flatMap((item, index) => item.evidenceStatus === "author-stated" || item.evidenceStatus === "source-recorded" ? [`claimLedger.${index}`] : []),
      ...moment.music.flatMap((item, index) => item.evidenceStatus === "author-stated" || item.evidenceStatus === "source-recorded" ? [`music.${index}`] : []),
      ...moment.provenance.flatMap((item, index) => item.evidenceStatus === "author-stated" || item.evidenceStatus === "source-recorded" ? [`provenance.${index}`] : []),
    ];
    if (!paths.length) continue;
    const current = recoveryDecisionStateSchema.parse(review[moment.id] ?? {});
    const acceptedPaths = [...new Set([...(current.delegatedSourceReview?.acceptedPaths ?? []), ...paths])].sort();
    review[moment.id] = { ...current, delegatedSourceReview: { at: now.toISOString(), acceptedPaths, note } };
    reviewedMoments += 1;
    acceptedItems += paths.length;
  }
  return { document: stagedRecoveryV3Schema.parse({ ...document, review }), reviewedMoments, acceptedItems };
}

export function collapseExactDuplicateDecisions(documentInput: unknown, momentId: string, backupSha256: string, now = new Date()) {
  const document = migrateStagedRecovery(documentInput); const current = recoveryDecisionStateSchema.parse(document.review[momentId] ?? {}); const seen = new Set<string>(); let removed = 0;
  const decisions = current.decisions.filter((decision) => { const sourceRevision = decision.sourceRevision ?? document.schemaVersion; const hash = decision.payloadHash ?? decisionPayloadHash(momentId, decision.action, decision.note, sourceRevision); const key = `${decision.action}:${sourceRevision}:${hash}`; if (seen.has(key)) { removed += 1; return false; } seen.add(key); return true; }).map((decision) => ({ ...decision, sourceRevision: decision.sourceRevision ?? document.schemaVersion, payloadHash: decision.payloadHash ?? decisionPayloadHash(momentId, decision.action, decision.note, decision.sourceRevision ?? document.schemaVersion) }));
  if (!removed) return { document, removed: 0 };
  return { document: stagedRecoveryV3Schema.parse({ ...document, review: { ...document.review, [momentId]: { ...current, decisions, auditNotes: [...current.auditNotes, { kind: "duplicate-collapse", at: now.toISOString(), detail: `Collapsed ${removed} exact accidental duplicate submission${removed === 1 ? "" : "s"} while retaining the first matching decision.`, backupSha256 }] } } }), removed };
}

export function setCurrentAuthorCorrection(documentInput: unknown, momentId: string, correction: z.infer<typeof currentCorrectionSchema>) {
  const document = migrateStagedRecovery(documentInput); const current = recoveryDecisionStateSchema.parse(document.review[momentId] ?? {});
  return stagedRecoveryV3Schema.parse({ ...document, review: { ...document.review, [momentId]: { ...current, factualEvidenceStatus: "accepted", currentAuthorCorrection: correction } } });
}

export const postImportCorrectionSchema = z.object({ schemaVersion: z.literal(1), kind: z.literal("storywalker-post-import-author-evidence"), recordedAt: z.string().min(1), evidence: z.array(postImportEvidenceSchema), additions: z.array(recoveryMomentSchema), gapUpdates: z.array(gapStateSchema), relationshipOverrides: z.record(relationshipOverrideSchema) });

export function applyPostImportEvidence(documentInput: unknown, correctionInput: unknown) {
  const document = migrateStagedRecovery(documentInput); const correction = postImportCorrectionSchema.parse(correctionInput);
  const known = new Set(document.moments.map((moment) => moment.id));
  for (const evidence of correction.evidence) for (const id of evidence.targetMomentIds) if (!known.has(id)) throw new Error(`Post-import evidence references unknown Moment: ${id}`);
  const originalIds = new Set(document.sourceBundle.originalMomentIds);
  for (const moment of correction.additions) { if (known.has(moment.id) && originalIds.has(moment.id)) throw new Error(`Post-import Moment collides with original source Moment: ${moment.id}`); known.add(moment.id); }
  const postImportEvidence = [...document.postImportEvidence, ...correction.evidence.filter((item) => !document.postImportEvidence.some((existing) => existing.id === item.id))];
  const additions = correction.additions.filter((moment) => !document.moments.some((existing) => existing.id === moment.id));
  const gapState = [...document.gapState.filter((state) => !correction.gapUpdates.some((update) => update.questionId === state.questionId)), ...correction.gapUpdates];
  return stagedRecoveryV3Schema.parse({ ...document, moments: [...document.moments, ...additions], sourceOrder: [...document.sourceOrder, ...additions.map((moment) => moment.id)], journeys: provisionalJourneys([...document.moments, ...additions]), review: { ...document.review, ...Object.fromEntries(additions.map((moment) => [moment.id, { decisions: [], excluded: false }])) }, postImportEvidence, gapState, relationshipOverrides: { ...document.relationshipOverrides, ...correction.relationshipOverrides } });
}

function novaLocalClaims(response: string) {
  const claims = response
    .replace(/\r\n?/gu, "\n")
    .split(/\n+/u)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/u, "").trim())
    .filter(Boolean)
    .slice(0, 24)
    .map((claim) => ({ claim, evidenceStatus: "author-stated" as const }));
  return claims.length ? claims : [{ claim: response.trim(), evidenceStatus: "author-stated" as const }];
}

/**
 * NOVA local intake v1 preserves the Author's response verbatim, breaks only
 * explicit lines into author-stated claims, and links known Moments. It does
 * not infer missing facts, accept an editorial proposal, or declare a gap
 * resolved; a response makes a source question conservatively partly settled.
 */
export function recordNovaQuestionResponse(documentInput: unknown, input: z.input<typeof novaQuestionResponseInputSchema>, now = new Date()) {
  const document = migrateStagedRecovery(documentInput);
  const received = novaQuestionResponseInputSchema.parse(input);
  const knownMoments = new Set(document.moments.map((moment) => moment.id));
  for (const momentId of received.targetMomentIds) if (!knownMoments.has(momentId)) throw new Error("A NOVA response can only link Moments already in this private review.");
  const uniqueTargets = [...new Set(received.targetMomentIds)].sort();
  const response = received.response.trim();
  const id = `nova-response:${sha256(JSON.stringify({ questionId: received.questionId, sourceQuestionId: received.sourceQuestionId ?? null, response, targetMomentIds: uniqueTargets })).slice(0, 24)}`;
  const existing = document.questionResponses.find((item) => item.id === id);
  if (existing) return { document, created: false, response: existing };
  const record = novaQuestionResponseSchema.parse({ id, questionId: received.questionId, question: received.question, ...(received.sourceQuestionId ? { sourceQuestionId: received.sourceQuestionId } : {}), response, targetMomentIds: uniqueTargets, claims: novaLocalClaims(response), recordedAt: now.toISOString(), privacy: "private", canonical: false, status: "received", filter: "nova-local-v1" });
  const knownSourceQuestion = received.sourceQuestionId && document.unansweredQuestions.some((question) => question.id === received.sourceQuestionId);
  if (received.sourceQuestionId && !knownSourceQuestion) throw new Error("A NOVA response can only mark an original Author question partly settled when that question is in this private review.");
  const priorGap = knownSourceQuestion ? document.gapState.find((state) => state.questionId === received.sourceQuestionId) : undefined;
  const gapState = knownSourceQuestion && priorGap?.status !== "resolved"
    ? [...document.gapState.filter((state) => state.questionId !== received.sourceQuestionId), { questionId: received.sourceQuestionId!, status: "partially-resolved" as const }]
    : document.gapState;
  return { document: stagedRecoveryV3Schema.parse({ ...document, questionResponses: [...document.questionResponses, record], gapState }), created: true, response: record };
}

function novaTriageDisposition(response: StagedRecovery["questionResponses"][number]) {
  const normalized = response.response.toLowerCase().replace(/[’']/gu, "'");
  if (/\bleave (?:this )?unknown\b/u.test(normalized)) return { status: "held-unknown" as const, note: "Author explicitly chose to retain this as unknown; no factual claim was promoted." };
  if (/\b(?:cannot|can't|isn't this your job|is not my job)\b/u.test(normalized)) return { status: "waiting-for-history-import" as const, note: "Author delegated this to a future consented listening-history correlation import; no music fact was added." };
  return { status: "applied-as-evidence" as const, note: "Explicit Author wording was added as separate private, non-canonical evidence." };
}

/**
 * Deterministic local inbox processing. It never calls a model and never
 * changes a source Moment in place: clear Author answers become a separate
 * evidence layer; intentional unknowns and import-dependent requests stay
 * visibly classified instead of becoming dead queue items.
 */
export function processNovaInbox(documentInput: unknown, now = new Date()) {
  const document = migrateStagedRecovery(documentInput);
  let created = 0;
  let compacted = 0;
  let postImportEvidence = [...document.postImportEvidence];
  const questionResponses = document.questionResponses.map((response) => {
    const earlierEvidence = postImportEvidence.find((item) => item.provenance.label.includes(response.id) && !item.id.startsWith("nova-triage:"));
    if (response.triage) {
      if (earlierEvidence && response.triage.evidenceId?.startsWith("nova-triage:")) {
        postImportEvidence = postImportEvidence.filter((item) => item.id !== response.triage?.evidenceId);
        compacted += 1;
        return { ...response, triage: { ...response.triage, evidenceId: earlierEvidence.id, note: "Existing private evidence for this saved Author answer was retained; duplicate intake evidence was collapsed." } };
      }
      return response;
    }
    const disposition = novaTriageDisposition(response);
    if (disposition.status !== "applied-as-evidence" || !response.targetMomentIds.length) return { ...response, triage: { ...disposition, processedAt: now.toISOString() } };
    const id = `nova-triage:${sha256(JSON.stringify({ responseId: response.id, targetMomentIds: response.targetMomentIds, claims: response.claims })).slice(0, 24)}`;
    const existing = earlierEvidence ?? postImportEvidence.find((item) => item.id === id);
    if (!existing) {
      postImportEvidence.push(postImportEvidenceSchema.parse({ id, recordedAt: now.toISOString(), privacy: "private", reviewStatus: "pending", canonical: false, targetMomentIds: response.targetMomentIds, claims: response.claims, supersedes: [], provenance: { author: "user", label: `NOVA local intake processed ${response.id}` } }));
      created += 1;
    }
    return { ...response, triage: { ...disposition, processedAt: now.toISOString(), evidenceId: existing?.id ?? id } };
  });
  const processed = questionResponses.filter((response) => response.triage).length;
  return { document: stagedRecoveryV3Schema.parse({ ...document, questionResponses, postImportEvidence }), created, compacted, processed, pending: questionResponses.length - processed };
}

/**
 * An explicit Author instruction can close the source question answered by a
 * NOVA intake response. The original response stays verbatim; its explicitly
 * stated claims become a separate, private post-import evidence record. This
 * never edits source Moments or makes an Episode/canonical fact.
 */
export function resolveNovaQuestionResponse(documentInput: unknown, input: z.input<typeof novaQuestionResolutionInputSchema>, now = new Date()) {
  const document = migrateStagedRecovery(documentInput);
  const requested = novaQuestionResolutionInputSchema.parse(input);
  const response = document.questionResponses.find((item) => item.id === requested.responseId);
  if (!response?.sourceQuestionId) throw new Error("Only a saved answer to an original Author question can close that question.");
  if (!document.unansweredQuestions.some((question) => question.id === response.sourceQuestionId)) throw new Error("The response does not refer to an Author question in this private review.");
  const knownMomentIds = new Set(document.moments.map((moment) => moment.id));
  for (const momentId of requested.targetMomentIds) if (!knownMomentIds.has(momentId)) throw new Error("A resolved answer can only link Moments already in this private review.");
  const targetMomentIds = [...new Set(requested.targetMomentIds)].sort();
  const evidenceId = `nova-resolution:${sha256(JSON.stringify({ responseId: response.id, targetMomentIds })).slice(0, 24)}`;
  const existing = document.postImportEvidence.find((item) => item.id === evidenceId);
  if (existing) return { document, created: false, evidence: existing };
  const evidence = postImportEvidenceSchema.parse({
    id: evidenceId,
    recordedAt: now.toISOString(),
    privacy: "private",
    reviewStatus: "pending",
    canonical: false,
    targetMomentIds,
    claims: response.claims,
    supersedes: [],
    provenance: { author: "user", label: `Author accepted saved NOVA answer ${response.id}` },
  });
  const questionResponses = document.questionResponses.map((item) => item.id === response.id ? { ...item, targetMomentIds } : item);
  const gapState = [...document.gapState.filter((state) => state.questionId !== response.sourceQuestionId), { questionId: response.sourceQuestionId, status: "resolved" as const }];
  return { document: stagedRecoveryV3Schema.parse({ ...document, questionResponses, postImportEvidence: [...document.postImportEvidence, evidence], gapState }), created: true, evidence };
}

/** Stores directly stated Author evidence as a new private layer, never as an
 * in-place rewrite of the original source records. */
export function recordDirectAuthorEvidence(documentInput: unknown, input: z.input<typeof directAuthorEvidenceInputSchema>, now = new Date()) {
  const document = migrateStagedRecovery(documentInput);
  const received = directAuthorEvidenceInputSchema.parse(input);
  const knownMomentIds = new Set(document.moments.map((moment) => moment.id));
  for (const momentId of received.targetMomentIds) if (!knownMomentIds.has(momentId)) throw new Error("Author evidence can only link Moments already in this private review.");
  const targetMomentIds = [...new Set(received.targetMomentIds)].sort();
  const claims = [...new Set(received.claims.map((claim) => claim.trim()))].map((claim) => ({ claim, evidenceStatus: "author-stated" as const }));
  const id = `author-evidence:${sha256(JSON.stringify({ label: received.label, targetMomentIds, claims })).slice(0, 24)}`;
  const existing = document.postImportEvidence.find((item) => item.id === id);
  if (existing) return { document, created: false, evidence: existing };
  const evidence = postImportEvidenceSchema.parse({ id, recordedAt: now.toISOString(), privacy: "private", reviewStatus: "pending", canonical: false, targetMomentIds, claims, supersedes: [], provenance: { author: "user", label: received.label } });
  return { document: stagedRecoveryV3Schema.parse({ ...document, postImportEvidence: [...document.postImportEvidence, evidence] }), created: true, evidence };
}

/**
 * Creates an explicitly labelled editorial thread candidate. It only anchors
 * existing private evidence; it does not alter a Moment, make a factual claim,
 * or turn a musical cluster into an interpretation or Episode.
 */
export function createNovaThreadProposal(documentInput: unknown, input: z.input<typeof novaThreadProposalInputSchema>, now = new Date()) {
  const document = migrateStagedRecovery(documentInput);
  const requested = novaThreadProposalInputSchema.parse(input);
  const moment = document.moments.find((item) => item.id === requested.momentId);
  if (!moment) throw new Error("A thread candidate can only be anchored to a Moment already in this private review.");
  const existing = document.threads.find((thread) => thread.title === requested.title && thread.sourceMomentIds.includes(moment.id));
  if (existing) return { document, created: false, thread: existing };
  const thread = threadSchema.parse({
    title: requested.title,
    privacy: "private",
    reviewStatus: "pending",
    canonical: false,
    status: "assistant-proposed",
    sourceMomentIds: [moment.id],
    createdAt: now.toISOString(),
    proposal: `First NOVA reading: a transit-frequency held beside “${moment.title}” — not a set list, but a portable “not there yet” signal gathered alongside a source cluster. This is an editorial hunch only; it does not establish sequence, location, emotion, causality, or meaning.`,
    tests: [
      `Source anchor: ${moment.id}.`,
      "Author comparison: retain, revise, or refuse this editorial proposal without changing the underlying evidence.",
    ],
  });
  const currentRelationship = document.relationshipOverrides[moment.id] ?? { primaryJourney: moment.journeyCandidate, crossJourneyCandidates: [], threadProposals: [] };
  const relationshipOverrides = {
    ...document.relationshipOverrides,
    [moment.id]: { ...currentRelationship, threadProposals: [...new Set([...currentRelationship.threadProposals, thread.title])].sort() },
  };
  return { document: stagedRecoveryV3Schema.parse({ ...document, threads: [...document.threads, thread], relationshipOverrides }), created: true, thread };
}
