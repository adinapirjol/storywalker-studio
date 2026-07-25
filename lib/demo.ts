import lifeEventDocument from "@/examples/aurora-coast/life-events.demo.json";
import musicDocument from "@/examples/aurora-coast/music-timeline.demo.json";
import reviewDocument from "@/examples/aurora-coast/review-bundle.demo.json";
import {
  DEMO_REVISION,
  lifeEventsDocumentSchema,
  musicTimelineSchema,
  reviewBundleSchema,
  studioStateSchema,
  type StudioState,
} from "@/lib/schema";

export interface DemoPreview {
  revision: typeof DEMO_REVISION;
  label: "Fictional demonstration data";
  trackCount: 12;
  lifeEventCount: 8;
  exactRevisionValidated: true;
}

export function validateAuroraCoastDemo(): DemoPreview {
  const music = musicTimelineSchema.parse(musicDocument);
  const events = lifeEventsDocumentSchema.parse(lifeEventDocument);
  const review = reviewBundleSchema.parse(reviewDocument);

  if (
    music.bundleRevision !== events.bundleRevision ||
    events.bundleRevision !== review.bundleRevision
  ) {
    throw new Error("Aurora Coast source documents do not share an exact revision.");
  }
  if (
    music.tracks.length !== review.expectedCounts.tracks ||
    events.events.length !== review.expectedCounts.lifeEvents
  ) {
    throw new Error("Aurora Coast record counts do not match the review bundle.");
  }

  return {
    revision: DEMO_REVISION,
    label: "Fictional demonstration data",
    trackCount: 12,
    lifeEventCount: 8,
    exactRevisionValidated: true,
  };
}

export function seedAuroraCoast(now = new Date("2027-07-28T08:00:00+02:00")): StudioState {
  validateAuroraCoastDemo();
  const music = musicTimelineSchema.parse(musicDocument);
  const events = lifeEventsDocumentSchema.parse(lifeEventDocument);

  return studioStateSchema.parse({
    schemaVersion: 1,
    bundleRevision: DEMO_REVISION,
    seededAt: now.toISOString(),
    tracks: music.tracks,
    lifeEvents: events.events.map((event) => ({
      ...event,
      reviewStatus: "pending",
      revision: 0,
      originalStartAt: event.startAt,
      originalEndAt: event.endAt,
    })),
    proposals: [],
  });
}

export function reviewBundle() {
  return reviewBundleSchema.parse(reviewDocument);
}
