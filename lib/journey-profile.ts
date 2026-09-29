import { z } from "zod";
const vector = z.object({ x: z.number().finite().min(-20).max(20), y: z.literal(0), z: z.number().finite().min(-20).max(20) }).strict();
export const memoryDecisionSchema = z.object({
  author: z.literal("Author"), at: z.string().datetime({ offset: true }),
  from: vector, to: vector, baseline: vector,
  displacement: vector, distance: z.number().finite().nonnegative(),
  interpretation: z.literal("None inferred"),
  representationBase: z.enum(["WORLD", "TIME"]).optional(),
  spaceId: z.string().optional(),
}).strict();
// Displacement may span the entire 40m room, unlike positions.
export const displacementDecisionSchema = memoryDecisionSchema.extend({ displacement: z.object({ x: z.number().finite().min(-40).max(40), y: z.literal(0), z: z.number().finite().min(-40).max(40) }).strict() });
const rank = z.object({ key: z.string(), label: z.string(), count: z.number().int().positive(), activeDays: z.number().int().positive(), share: z.number(), baselineShare: z.number(), lift: z.number(), first: z.string(), last: z.string() }).strict();
export const listeningProfileSchema = z.object({
  count: z.number().int().nonnegative(), sourceId: z.string(),
  artists: z.array(rank), tracks: z.array(rank), albums: z.array(rank),
  dominantArtist: z.string().nullable(), recurrentArtists: z.array(z.string()),
  bursts: z.array(z.object({ day: z.string(), count: z.number().int(), baselineThreshold: z.number() }).strict()),
  arrivals: z.array(z.string()), disappearances: z.array(z.string()),
  concentrations: z.array(z.object({ kind: z.enum(["artist", "track", "album"]), key: z.string(), label: z.string(), count: z.number(), share: z.number(), baselineShare: z.number(), lift: z.number() }).strict()),
  selectedCues: z.array(z.object({ cueId: z.string(), count: z.number().int().positive() }).strict()),
}).strict();
export const journeyLayoutSchema = z.object({
  version: z.literal(1), mode: z.enum(["WORLD", "MEMORY"]),
  from: z.string(), toExclusive: z.string(), timeZone: z.string(),
  projection: z.object({ method: z.literal("local-equirectangular-uniform-v1"), originLatitude: z.number(), originLongitude: z.number(), metresPerUnit: z.number().positive(), usableRoomWidth: z.literal(36), north: z.literal("negative-z") }).strict(),
  sources: z.array(z.object({ type: z.enum(["timeline", "author", "lastfm"]), id: z.string(), fingerprint: z.string(), capturedAt: z.string() }).strict()),
  coverage: z.object({ timelineStart: z.string().nullable(), timelineEnd: z.string().nullable(), visits: z.number(), excludedRoutes: z.number(), invalidVisits: z.number(), duplicateVisits: z.number(), baselinePlays: z.number(), duplicatePlays: z.number(), matchedPlays: z.number(), ambiguousPlays: z.number(), unmatchedPlays: z.number() }).strict(),
  rules: z.array(z.string()),
}).strict();
