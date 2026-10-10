import { z } from "zod";
import { calendarContextSchema } from "./journey-identifiers";
import { displacementDecisionSchema, listeningProfileSchema } from "./journey-profile";

const id = z.string().trim().min(1).max(500);
const instant = z.string().datetime({ offset: true });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Expected a valid calendar date");
const vector = z.object({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() }).strict();
const coordinates = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).strict();

export const reconstructedTimingSchema = z.object({
  precision: z.enum(["day", "approximate"]), label: z.string().min(1),
  note: z.string().min(1),
  // Only conservative interior windows may receive unique listening matches.
  listeningWindows: z.array(z.object({ start: instant, end: instant }).strict()),
}).strict();
export const geographicReferenceSchema = z.object({ source: z.string(), label: z.string(), precision: z.enum(["city-reference", "municipality-reference", "airport-reference"]) }).strict();

/** A Notion date/location describes the page, not verified physical presence. */
export const notionEvidenceSchema = z.object({
  pageId: id,
  title: z.string().trim().min(1).max(1000),
  date,
  locationLabel: z.string().max(1000).nullable(),
  sourceDatabase: id,
  contentSummary: z.string().max(10000).optional(),
}).strict();
export type NotionEvidence = z.infer<typeof notionEvidenceSchema>;

const sourceNode = z.object({ id, sourceId: id });
export const episodeEvidenceSchema = z.discriminatedUnion("type", [
  sourceNode.extend({ type: z.literal("timeline"), start: instant, end: instant, coordinates,
    certainty: z.enum(["reported", "platform-inferred", "unknown"]) }).strict(),
  sourceNode.extend({ type: z.literal("author"), statement: z.string().min(1).max(10000),
    confirmedGeography: coordinates.optional() }).strict(),
  sourceNode.extend({ type: z.literal("calendar"), start: instant.optional(), end: instant.optional(), sourceWhen: z.string().optional() }).strict(),
  sourceNode.extend({ type: z.literal("notion"), pageId: id }).strict(),
  sourceNode.extend({ type: z.literal("lastfm"), start: instant, end: instant }).strict(),
]);

export const journeyEpisodeSchema = z.object({
  id,
  start: instant,
  end: instant,
  timeZone: z.string().refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Unknown time zone"),
  label: z.string().min(1).max(1000),
  episodeKind: z.enum(["stay", "transit"]).optional(),
  reconstructedTiming: reconstructedTimingSchema.optional(),
  geographicReference: geographicReferenceSchema.optional(),
  routeOrder: z.number().int().nonnegative(),
  notionEvidence: z.array(notionEvidenceSchema).default([]),
  calendarEvidence: z.array(calendarContextSchema).optional(),
  // Nodes retain independent source identities; edges state what each supports.
  provenance: z.object({
    nodes: z.array(episodeEvidenceSchema),
    edges: z.array(z.object({
      evidenceId: id,
      role: z.enum(["physical-geography", "authored-context", "temporal-context", "listening-observation"]),
      basis: z.enum(["source-record", "temporal-overlap", "author-confirmed"]),
    }).strict()),
  }).strict(),
  context: z.array(z.object({
    kind: z.enum(["episode-label", "creative-milestone", "project-milestone", "authored-context"]),
    text: z.string().min(1).max(10000), evidenceId: id,
  }).strict()).default([]),
  // World space is a projection, not latitude/longitude. Its source is mandatory.
  worldPosition: z.object({ position: vector, projection: id, evidenceIds: z.array(id).min(1) }).strict().optional(),
  memoryPosition: vector.optional(),
  memoryDecisions: z.array(displacementDecisionSchema).default([]),
  listening: listeningProfileSchema.optional(),
}).strict().superRefine((episode, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  if (Date.parse(episode.start) >= Date.parse(episode.end)) fail("Episode interval must be non-empty and half-open [start, end).");
  for (const window of episode.reconstructedTiming?.listeningWindows ?? []) {
    if (Date.parse(window.start) < Date.parse(episode.start) || Date.parse(window.end) > Date.parse(episode.end) || Date.parse(window.start) >= Date.parse(window.end)) fail("Listening window must lie inside the reconstructed episode envelope");
  }
  if (episode.episodeKind === "transit" && episode.reconstructedTiming?.listeningWindows.length) fail("Date-only transit cannot claim a listening window");
  const nodes = new Map(episode.provenance.nodes.map(node => [node.id, node]));
  if (nodes.size !== episode.provenance.nodes.length) fail("Duplicate evidence IDs");
  if (new Set(episode.notionEvidence.map(item => item.pageId)).size !== episode.notionEvidence.length) fail("Duplicate Notion page IDs");
  for (const node of nodes.values()) {
    if ("start" in node && node.start && node.end && Date.parse(node.start) >= Date.parse(node.end)) fail("Invalid source interval");
    if (node.type === "calendar" && !(node.start && node.end) && !node.sourceWhen) fail("Calendar evidence requires an original date or interval");
    if (node.type === "notion" && !episode.notionEvidence.some(item => item.pageId === node.pageId)) fail("Missing Notion page payload");
  }
  for (const item of episode.notionEvidence) {
    if (![...nodes.values()].some(node => node.type === "notion" && node.pageId === item.pageId)) fail("Notion page requires a provenance node");
  }
  const geographyAllowed = (evidenceId: string) => {
    const node = nodes.get(evidenceId);
    return node?.type === "timeline" || (node?.type === "author" && !!node.confirmedGeography);
  };
  for (const edge of episode.provenance.edges) {
    if (!nodes.has(edge.evidenceId)) fail("Dangling provenance edge");
    if (edge.role === "physical-geography" && (!geographyAllowed(edge.evidenceId) || (nodes.get(edge.evidenceId)?.type === "author" && edge.basis !== "author-confirmed"))) fail("Geography requires Timeline or explicit Author confirmation");
  }
  for (const evidenceId of episode.worldPosition?.evidenceIds ?? []) {
    if (!geographyAllowed(evidenceId) || !episode.provenance.edges.some(edge => edge.evidenceId === evidenceId && edge.role === "physical-geography")) fail("World position requires independently sourced geography");
  }
  if (episode.worldPosition && episode.memoryPosition) {
    const baseline = episode.worldPosition.position;
    let previous = baseline;
    for (const decision of episode.memoryDecisions) {
      if (JSON.stringify(decision.baseline) !== JSON.stringify(baseline) || JSON.stringify(decision.from) !== JSON.stringify(previous)) fail("Memory decision chain must start at geographic baseline");
      const dx = decision.to.x - baseline.x, dz = decision.to.z - baseline.z;
      if (Math.abs(decision.displacement.x - dx) > 1e-8 || Math.abs(decision.displacement.z - dz) > 1e-8 || Math.abs(decision.distance - Math.hypot(dx, dz)) > 1e-8) fail("Invalid recorded displacement");
      previous = decision.to;
    }
    if (episode.memoryDecisions.length && JSON.stringify(previous) !== JSON.stringify(episode.memoryPosition)) fail("Memory position does not match the last Author decision");
  }
  for (const context of episode.context) if (!nodes.has(context.evidenceId)) fail("Context requires a source node");
});
export type JourneyEpisode = z.infer<typeof journeyEpisodeSchema>;

function localDay(instantValue: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instantValue);
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
}

/** Date-only pages can match several stops on one day. Never pick one arbitrarily. */
export function attachNotionEvidence(input: JourneyEpisode[], inputEvidence: NotionEvidence[]) {
  const episodes = input.map(episode => journeyEpisodeSchema.parse(episode));
  if (new Set(episodes.map(episode => episode.id)).size !== episodes.length) throw new Error("Duplicate episode IDs");
  const evidence = z.array(notionEvidenceSchema).parse(inputEvidence);
  if (new Set(evidence.map(item => item.pageId)).size !== evidence.length) throw new Error("Duplicate Notion page IDs");
  const outcomes = evidence.map(item => {
    const candidates = episodes.filter(episode => item.date >= localDay(Date.parse(episode.start), episode.timeZone) && item.date <= localDay(Date.parse(episode.end) - 1, episode.timeZone));
    if (candidates.length !== 1) return { pageId: item.pageId, status: candidates.length ? "HUMAN_REVIEW" as const : "UNMAPPED" as const, episodeIds: candidates.map(episode => episode.id) };
    const episode = candidates[0];
    const existing = episode.notionEvidence.find(record => record.pageId === item.pageId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(item)) return { pageId: item.pageId, status: "HUMAN_REVIEW" as const, episodeIds: [episode.id] };
    if (!existing) {
      const evidenceId = `notion:${item.pageId}`;
      if (episode.provenance.nodes.some(node => node.id === evidenceId)) throw new Error("Evidence ID collision");
      episode.notionEvidence.push(item);
      episode.provenance.nodes.push({ id: evidenceId, type: "notion", sourceId: item.pageId, pageId: item.pageId });
      episode.provenance.edges.push({ evidenceId, role: "temporal-context", basis: "temporal-overlap" });
      // A suggested contextual label, never a replacement for the Author's label.
      episode.context.push({ kind: "episode-label", text: item.title, evidenceId });
      if (item.contentSummary) episode.context.push({ kind: "authored-context", text: item.contentSummary, evidenceId });
    }
    return { pageId: item.pageId, status: "ATTACHED" as const, episodeIds: [episode.id] };
  });
  return { episodes: episodes.map(episode => journeyEpisodeSchema.parse(episode)), outcomes };
}
