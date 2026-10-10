import { z } from "zod";

export const DEMO_REVISION = "aurora-coast-r1-2027-07";

export const privacySchema = z.enum(["public", "friends-only", "private"]);
export const certaintySchema = z.enum([
  "exact",
  "day",
  "range-exact",
  "range-approximate",
]);
export const reviewStatusSchema = z.enum(["pending", "confirmed", "rejected"]);
export const proposalStatusSchema = z.enum([
  "pending",
  "confirmed",
  "rejected",
  "invalidated",
]);
export const confidenceSchema = z.enum(["high", "moderate", "low", "very-low"]);
export const basisSchema = z.enum([
  "within-range",
  "same-day",
  "within-24-hours",
  "within-72-hours",
]);

const offsetDateTime = z.string().datetime({ offset: true });

export const trackSchema = z.object({
  id: z.string().regex(/^demo-track-\d{3}$/u),
  trackName: z.string().min(1),
  artistName: z.string().min(1),
  albumName: z.string().min(1),
  durationMs: z.number().int().positive(),
  addedAt: offsetDateTime,
  sourceUri: z.string().regex(/^spotify:track:demo[a-z0-9]+$/u),
  privacy: privacySchema,
});

export const sourceLifeEventSchema = z.object({
  id: z.string().regex(/^demo-event-\d{3}$/u),
  title: z.string().min(1),
  location: z.string().min(1),
  startAt: offsetDateTime,
  endAt: offsetDateTime,
  certainty: certaintySchema,
  privacy: privacySchema,
  category: z.enum(["travel", "creative", "community"]),
  description: z.string().min(1).max(1200),
  authorNote: z.string().min(1).max(800),
});

export const reviewedLifeEventSchema = sourceLifeEventSchema.extend({
  reviewStatus: reviewStatusSchema,
  revision: z.number().int().nonnegative(),
  originalStartAt: offsetDateTime,
  originalEndAt: offsetDateTime,
});

export const proposalSchema = z.object({
  id: z.string().min(1),
  trackId: z.string().min(1),
  eventId: z.string().min(1),
  basis: basisSchema,
  confidence: confidenceSchema,
  distanceHours: z.number().nonnegative(),
  reason: z.string().min(1),
  status: proposalStatusSchema,
  createdAt: offsetDateTime,
  reviewedAt: offsetDateTime.optional(),
  invalidatedAt: offsetDateTime.optional(),
  eventRevision: z.number().int().nonnegative(),
});

const commonDocument = {
  schemaVersion: z.literal(1),
  bundleRevision: z.literal(DEMO_REVISION),
  label: z.literal("Fictional demonstration data"),
};

export const musicTimelineSchema = z.object({
  ...commonDocument,
  playlist: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    owner: z.literal("fictional-author"),
  }),
  tracks: z.array(trackSchema).length(12),
});

export const lifeEventsDocumentSchema = z.object({
  ...commonDocument,
  events: z.array(sourceLifeEventSchema).length(8),
});

export const reviewBundleSchema = z.object({
  ...commonDocument,
  chapter: z.object({
    id: z.literal("aurora-coast-chapter-one"),
    title: z.literal("Aurora Coast"),
    subtitle: z.literal("Chapter One: Ten Days in Transit"),
    startDate: z.literal("2027-07-18"),
    endDate: z.literal("2027-07-27"),
    route: z
      .array(z.string())
      .length(6),
  }),
  sourceDocuments: z.object({
    musicTimeline: z.literal("music-timeline.demo.json"),
    lifeEvents: z.literal("life-events.demo.json"),
  }),
  expectedCounts: z.object({
    tracks: z.literal(12),
    lifeEvents: z.literal(8),
  }),
  guidedReview: z.object({
    confirmProposalId: z.string().min(1),
    rejectProposalId: z.string().min(1),
    reviseEventId: z.string().min(1),
    revisedStartAt: offsetDateTime,
    revisedEndAt: offsetDateTime,
  }),
});

export const studioStateSchema = z.object({
  schemaVersion: z.literal(1),
  bundleRevision: z.literal(DEMO_REVISION),
  seededAt: offsetDateTime,
  tracks: z.array(trackSchema).length(12),
  lifeEvents: z.array(reviewedLifeEventSchema).length(8),
  proposals: z.array(proposalSchema),
});

export type Privacy = z.infer<typeof privacySchema>;
export type Track = z.infer<typeof trackSchema>;
export type SourceLifeEvent = z.infer<typeof sourceLifeEventSchema>;
export type LifeEvent = z.infer<typeof reviewedLifeEventSchema>;
export type Proposal = z.infer<typeof proposalSchema>;
export type ReviewBundle = z.infer<typeof reviewBundleSchema>;
export type StudioState = z.infer<typeof studioStateSchema>;
