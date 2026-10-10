import { expect, it } from "vitest";
import { calendarContextForEpisodes, episodeIdentifiers } from "./journey-identifiers";
import { journeyEpisodeSchema } from "./journey-episode";
const episode = () => journeyEpisodeSchema.parse({ id: "timeline-row-123", label: "Unlabelled Timeline stop", start: "2026-07-07T21:30:00Z", end: "2026-07-07T22:00:00Z", timeZone: "Europe/Bucharest", routeOrder: 0, provenance: { nodes: [{ id: "trace", type: "timeline", sourceId: "timeline#123", start: "2026-07-07T21:30:00Z", end: "2026-07-07T22:00:00Z", coordinates: { latitude: 45, longitude: 7 }, certainty: "platform-inferred" }], edges: [{ evidenceId: "trace", role: "physical-geography", basis: "source-record" }] }, worldPosition: { position: { x: 0, y: 0, z: 0 }, projection: "test", evidenceIds: ["trace"] }, memoryPosition: { x: 0, y: 0, z: 0 } });
const event = (startsWhen: string, endsWhen?: string, allDay = false) => ({ startsWhen, endsWhen, allDay, title: "Planned workshop", location: "Unconfirmed city", timeInterpretation: allDay ? "date-only" : "utc", importerProvenance: "fixture" });
const document = (records: unknown[]) => ({ schemaVersion: 1, source: "google-calendar-takeout", importedAt: "2026-09-28T00:00:00Z", records });
it("uses stable stop ID, source coordinates and local clock without inventing a place name", () => {
 const ids = episodeIdentifiers(episode());
 expect(ids.title).toBe("Stop T123"); expect(ids.place.text).toContain("45.0000°N, 7.0000°E"); expect(ids.time.text).toContain("08 Jul"); expect(ids.time.text).toContain("30m"); expect(ids.context.music).toContain("No uniquely matched");
});
it("attaches Calendar overlap and separate date-only context without moving or relabeling episodes", () => {
 const original = episode();
 const [result] = calendarContextForEpisodes([original], document([event("2026-07-07T21:40:00Z", "2026-07-07T22:10:00Z"), event("2026-07-08", "2026-07-09", true), event("2026-07-07", "2026-07-08", true), event("2026-07-07T22:00:00Z", "2026-07-07T23:00:00Z")]), "calendar", "hash");
 expect(result.calendarEvidence.map(item => item.match)).toEqual(["timestamp-overlap", "same-local-day"]);
 expect(result.label).toBe(original.label); expect(result.worldPosition).toEqual(original.worldPosition); expect(result.memoryPosition).toEqual(original.memoryPosition);
 expect(result.provenance.edges.filter(edge => edge.role === "physical-geography")).toEqual(original.provenance.edges);
 expect(journeyEpisodeSchema.safeParse(result).success).toBe(true);
 expect(original.calendarEvidence).toBeUndefined();
});
it("does not parse floating times as exact overlap, and refresh is idempotent", () => {
 const source = document([{ ...event("2026-07-08T20:00:00[Europe/Paris]"), timeInterpretation: "local-with-declared-timezone" }]);
 const [first] = calendarContextForEpisodes([episode()], source, "calendar", "hash");
 expect(first.calendarEvidence[0].match).toBe("same-local-day");
 const [second] = calendarContextForEpisodes([first], source, "calendar", "hash"); expect(second).toEqual(first);
});
