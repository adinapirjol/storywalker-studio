export const CTM_2027_TRACKER = {
  verifiedAt: "2026-08-23",
  status: "open",
  officialSources: [
    "https://www.ctm-festival.de/festival-2027/open-calls/research-networking-day-2027",
    "https://www.ctm-festival.de/festival-2027/theme",
  ],
  officialDeadline: "25 October 2026, 23:59 CET",
  internalDeadline: "24 October 2026, 18:00 Europe/Bucharest",
  eligibleApplicants:
    "Graduate/postgraduate students and independent artists conducting self-guided research.",
  truthfulTitle: "Independent creative technologist and self-directed researcher.",
  format: "Solo, on-site, English, ten-minute presentation.",
  event: "Research Networking Day — 24 January 2027, Berlin.",
  festival: "CTM Festival — 22–31 January 2027.",
  selectedParticipants: 9,
  support: "Festival pass, lunch and dinner are provided. Travel and accommodation are not funded.",
  limits: {
    biography: 500,
    proposal: 1500,
    requiredUrls: 1,
    optionalUrls: 1,
  },
  aiPolicy:
    "CTM permits AI for brainstorming, structure, translation and polishing; the applicant’s own voice and reasoning must remain present.",
  readiness: 24,
} as const;

export const RESEARCH_DIRECTION = {
  title: "Public City, Private Echoes: Who Gets to Author the Memory?",
  question:
    "What happens when public place-data and private behavioural traces are allowed to propose autobiographical meaning, but not to author it?",
  provisionalUntil: "15 September 2026",
  decisionMade:
    "Keep the research question provisional; test the consequence of refusal before fixing the presentation claim.",
  evidenceProduced: [
    "A deterministic Aurora Coast proposal is available for public review.",
    "Experiment 01 makes acceptance, revision and refusal perceptible without treating a proposal as canonical.",
    "Locative Echo Lab separates movement, uncertainty and consent from narrative meaning.",
    "Storywalker Prototype 1 provides a deterministic three-location Linz negotiation path with a visible evidence ledger.",
  ],
  nextActions: [
    "Document one public experiment reflection after a short session.",
    "Draft the CTM proposal only from observed evidence and retain the character count.",
    "Decide whether this question remains the submission frame by 15 September 2026.",
    "Use the Linz experiment to test whether refusal can become audible, visual and structural material.",
  ],
  parkingLot: [
    "Max/MSP or Arduino integration",
    "Projection, sensors and multi-speaker installation",
    "Any public autobiographical timeline",
  ],
  nextCheckpoint: "15 September 2026 — research-question decision.",
} as const;

export const INFERRED_SELECTION_CRITERIA = [
  "A clear, self-directed research question is likely easier to assess in a ten-minute solo presentation.",
  "A concise, evidence-led proposal is likely more useful than a claim of completed artistic practice.",
  "Practical readiness for a Berlin presentation matters because travel and accommodation are not funded.",
] as const;

export const RESEARCH_TEMPLATES = [
  "Dated notebook entry: observation, source/provenance, uncertainty, next question.",
  "Artwork/reference analysis: sees, hears, does, controls — with a source link and no claim beyond observation.",
  "Experiment record: question, interaction, evidence, reflection.",
  "Ethics/accessibility/consent review: data, agency, fallback, risk, mitigation.",
  "Project decision: decision, evidence, alternatives, reviewer, date.",
  "Application draft: exact biography and proposal character counts, including spaces.",
] as const;
