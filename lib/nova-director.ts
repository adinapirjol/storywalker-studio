import type { EvidencePack } from "@/lib/private-signal-engine";

export type DirectorReading = { title: string; reading: string; sourceIds: string[]; caveat: string };
export type DirectorPreview = {
  kind: "nova-director-local-preview";
  privacy: "private";
  canonical: false;
  query: string;
  externalModelCalled: false;
  observations: string[];
  evidence: Array<{ id: string; title: string; kind: string; authority: string; matchedTerms: string[]; excerpts: Array<{ text: string; authority: string }> }>;
  readings: DirectorReading[];
  questions: string[];
  sourceIds: string[];
  boundary: string;
};

/**
 * The Director's first usable surface is intentionally a local rehearsal: it
 * frames evidence and counter-readings before an external model is ever given
 * a selected context window. It is a proposal, never a decision or write.
 */
export function buildDirectorPreview(pack: EvidencePack): DirectorPreview {
  const sourceIds = pack.evidence.map((item) => item.id);
  const editorial = pack.evidence.filter((item) => item.authority === "editorial-proposal");
  const factual = pack.evidence.filter((item) => item.authority === "author-stated" || item.authority === "source-recorded");
  const datedConnections = pack.connectionCandidates.filter((item) => item.basis === "shared-day");
  const evidence = pack.evidence.map((item) => ({ id: item.id, title: item.title, kind: item.kind, authority: item.authority, matchedTerms: item.matchedTerms, excerpts: item.excerpts }));
  const factualExcerpts = evidence.flatMap((item) => item.excerpts.map((excerpt) => ({ ...excerpt, id: item.id }))).filter((item) => item.authority === "author-stated" || item.authority === "source-recorded");
  const observations = [
    `${pack.evidence.length} private records matched “${pack.query}”; ${factual.length} are author-stated or source-recorded and ${editorial.length} are editorial proposals.`,
    datedConnections.length ? `${datedConnections.length} same-day retrieval cue${datedConnections.length === 1 ? " is" : "s are"} visible. A shared date is context, not causality.` : "No same-day cue was found in this selected window.",
    editorial.length ? "Editorial material is present beside evidence and remains a separate layer." : "No editorial proposal was retrieved in this window.",
  ];
  const support = sourceIds.slice(0, 6);
  const groundedLines = factualExcerpts.slice(0, 3).map((item) => `“${item.text}” (${item.id})`);
  const groundedReading = groundedLines.length
    ? `The strongest explicit material in this window is ${groundedLines.join("; ")}. These lines make a shared Thread worth testing, but they do not yet prove a single direction or outcome.`
    : "This window contains no explicit author-stated or source-recorded line to interpret. It is a retrieval result, not evidence for a reading.";
  return {
    kind: "nova-director-local-preview", privacy: "private", canonical: false, query: pack.query, externalModelCalled: false, observations,
    evidence,
    readings: [
      { title: "Evidence-led reading", reading: groundedReading, sourceIds: support, caveat: "Only the quoted lines are evidence. The possible Thread is editorial, not canon." },
      { title: "Counter-reading", reading: "The cluster may be an archive effect: shared language, a date, or a source import can make unrelated material appear adjacent.", sourceIds: support, caveat: "A counter-reading stays visible so the Director cannot turn proximity into destiny." },
    ],
    questions: factualExcerpts.length ? [
      "Which quoted line is genuinely central to this question, and which is merely adjacent?",
      "What would contradict the possible connection between these sources?",
      "Should this remain a private Thread, become a public-voice idea, or stay ungrouped?",
    ] : [
      "Which source record should be added to make this question answerable?",
      "Is the missing material a fact you can capture, or an import we should wait for?",
    ],
    sourceIds,
    boundary: "This is a local NOVA rehearsal, built without an external model. A future model call must use an explicitly selected evidence packet and return a revisable proposal with these source IDs.",
  };
}

/** Builds a small, explicitly selected packet for a possible external call. */
export function buildDirectorModelBrief(preview: DirectorPreview, selectedSourceIds: string[]) {
  const selected = preview.evidence.filter((item) => selectedSourceIds.includes(item.id));
  return {
    query: preview.query,
    instructions: "You are NOVA Director. Work only from selected evidence. Separate observations from interpretations, provide a counter-reading, cite source IDs after factual statements, and never write canon, diagnose feelings, or invent missing facts. Return a concise, revisable proposal.",
    selectedEvidence: selected.map((item) => ({ id: item.id, title: item.title, authority: item.authority, excerpts: item.excerpts })),
  };
}
