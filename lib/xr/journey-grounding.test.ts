import { expect, it } from "vitest";
import { groundJourney, moveJourneyEpisode } from "./journey-grounding";
import { DEMO_XR_SCENE, parseSceneFile, reviewExport } from "./xr-scene";
import { validateDraftReview } from "./xr-draft";
const at = (day: number, hour = 0) => `2026-05-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00Z`;
const visit = (day: number, latitude: number, longitude: number) => ({ kind: "visit", startAt: at(day), endAt: at(day + 1), latitude, longitude, certainty: "platform-inferred", authorCorrected: false });
const timeline = (records: unknown[]) => ({ schemaVersion: 1, source: "google-timeline", importedAt: at(28), schemaEncountered: "fixture", records });
const history = (records: unknown[]) => ({ schemaVersion: 1, source: "lastfm-scrobbles", importedAt: at(28), records });
const play = (day: number, hour = 0, artistName = "Artist A") => ({ playedAt: at(day, hour), artistName, trackName: "Track", albumName: "Album", importerProvenance: "fixture" });
const options = { from: at(15), toExclusive: at(28), timelineToExclusive: at(27), timeZone: "UTC", sources: [{ type: "timeline" as const, id: "fixture-timeline", fingerprint: "fixture", capturedAt: at(28) }, { type: "lastfm" as const, id: "fixture-lastfm", fingerprint: "fixture", capturedAt: at(28) }] };

it("projects geography with uniform scale and assigns half-open timestamps without bridging gaps or routes", () => {
  const scene = groundJourney(DEMO_XR_SCENE, timeline([visit(17, 12, 22), visit(15, 10, 20), { ...visit(16, 11, 21), kind: "route" }]), history([play(15), play(16), play(17), play(17), play(27)]), options);
  expect(scene.cues).toEqual(DEMO_XR_SCENE.cues);
  expect(scene.journeyEpisodes?.map(e => e.start)).toEqual([at(15), at(17)].map(value => new Date(value).toISOString()));
  expect(scene.journeyLayout?.coverage).toMatchObject({ baselinePlays: 4, matchedPlays: 2, unmatchedPlays: 2, ambiguousPlays: 0, duplicatePlays: 1, excludedRoutes: 1 });
  const [a, b] = scene.journeyEpisodes!;
  expect(a.worldPosition!.position.x).toBeLessThan(b.worldPosition!.position.x);
  expect(a.worldPosition!.position.z).toBeGreaterThan(b.worldPosition!.position.z);
  expect(a.memoryPosition).toEqual(a.worldPosition!.position);
  expect(Math.max(...scene.journeyEpisodes!.map(e => Math.abs(e.worldPosition!.position.z)))).toBeCloseTo(18);
  const reversed = groundJourney(DEMO_XR_SCENE, timeline([visit(17, 10, 20), visit(15, 12, 22)]), history([]), options);
  expect(reversed.journeyEpisodes![1].worldPosition!.position).toEqual(a.worldPosition!.position);
});
it("leaves overlaps ambiguous; preserves explicit Author and Timeline geographic provenance independently", () => {
  const scene = groundJourney(DEMO_XR_SCENE, timeline([visit(15, 10, 20)]), history([play(15)]), { ...options, authorStops: [{ id: "confirmed", start: at(15), end: at(16), label: "Author stop", latitude: 20, longitude: 30, statement: "I confirm this stop", sourceId: "author-fixture" }] });
  expect(scene.journeyLayout?.coverage.ambiguousPlays).toBe(1);
  expect(scene.journeyEpisodes?.every(e => e.listening?.count === 0)).toBe(true);
  expect(scene.journeyEpisodes?.flatMap(e => e.provenance.nodes.map(n => n.type))).toContain("author");
});
it("keeps baseline counts from outside geographic coverage and computes episode concentration", () => {
  const rows = [...Array.from({ length: 12 }, (_, i) => play(15, i)), ...Array.from({ length: 24 }, (_, i) => play(27, i, "Artist B"))];
  const scene = groundJourney(DEMO_XR_SCENE, timeline([visit(15, 10, 20)]), history(rows), options);
  const profile = scene.journeyEpisodes![0].listening!;
  expect(profile.dominantArtist).toBe("Artist A"); expect(profile.recurrentArtists).toContain("Artist A");
  expect(profile.artists[0].lift).toBe(3);
  expect(profile.concentrations[0]).toMatchObject({ kind: "artist", count: 12, lift: 3 });
  expect(scene.journeyLayout?.coverage.unmatchedPlays).toBe(24);
});
it("records memory displacement, protects baseline and decisions, round-trips a large geographic scene", () => {
  const world = groundJourney(DEMO_XR_SCENE, timeline([visit(15, 10, 20), visit(17, 12, 22)]), history([play(15)]), options);
  expect(() => moveJourneyEpisode(world, world.journeyEpisodes![0].id, 4, 5)).toThrow("MEMORY");
  const memory = { ...world, journeyLayout: { ...world.journeyLayout!, mode: "MEMORY" as const } };
  const moved = moveJourneyEpisode(memory, memory.journeyEpisodes![0].id, 4, 5, at(28));
  const decisions = { listening: "accepted" as const };
  expect(validateDraftReview(world, { scene: moved, decisions }).decisions).toEqual(decisions);
  expect(moved.journeyEpisodes![0].worldPosition).toEqual(world.journeyEpisodes![0].worldPosition);
  expect(moved.journeyEpisodes![0].memoryDecisions[0]).toMatchObject({ author: "Author", interpretation: "None inferred", to: { x: 4, y: 0, z: 5 } });
  expect(parseSceneFile(JSON.parse(JSON.stringify(reviewExport(moved, decisions)))).scene).toEqual(moved);
  const forged = structuredClone(moved); forged.journeyEpisodes![0].label = "Rewritten evidence";
  expect(() => validateDraftReview(world, { scene: forged, decisions })).toThrow();
  const rewritten = structuredClone(moved); rewritten.journeyEpisodes![0].memoryDecisions[0].at = at(27);
  expect(() => validateDraftReview(moved, { scene: rewritten, decisions })).toThrow();
});
it("matches existing accepted musical selections by grouping key, never old x/z", () => {
  const scene = { ...DEMO_XR_SCENE, cues: [{ ...DEMO_XR_SCENE.cues[0], source: "lastfm" as const, note: "Candidate recurring artist: fixture", evidence: { kind: "source-analysis" as const, sourceId: "fixture-lastfm", facts: ['Grouping key: ["Artist A"]'], authorLabels: [], interpretation: "None" } }] };
  const result = groundJourney(scene, timeline([visit(15, 10, 20)]), history([play(15)]), options);
  expect(result.journeyEpisodes![0].listening!.selectedCues).toEqual([{ cueId: "listening", count: 1 }]);
});
it("unwraps the date line and rejects invalid coordinates without inventing visits", () => {
  const result = groundJourney(DEMO_XR_SCENE, timeline([visit(15, 0, 179), visit(16, 0, -179), visit(17, 100, 2)]), history([]), options);
  expect(result.journeyLayout?.projection.originLongitude).toBe(180);
  expect(result.journeyLayout?.coverage.invalidVisits).toBe(1);
  expect(result.journeyLayout!.projection.metresPerUnit).toBeLessThan(7000);
});

it("keeps Author date boundaries and transit ambiguous while matching only conservative stay interiors", () => {
  const author = { id: "reconstruction", start: at(25), end: at(28), label: "Author city", latitude: 40, longitude: 8, statement: "Date-only reconstruction", sourceId: "author-fixture", episodeKind: "stay" as const, reconstructedTiming: { precision: "day" as const, label: "25–27 May · dates only", note: "No arrival time supplied", listeningWindows: [{ start: at(26), end: at(27) }] } };
  const transit = { ...author, id: "transfer", start: at(27), episodeKind: "transit" as const, reconstructedTiming: { ...author.reconstructedTiming, listeningWindows: [] } };
  const scene = groundJourney(DEMO_XR_SCENE, timeline([visit(15, 10, 20)]), history([play(25, 12), play(26, 12), play(27, 12)]), { ...options, authorStops: [author, transit] });
  expect(scene.journeyLayout!.coverage).toMatchObject({ matchedPlays: 1, ambiguousPlays: 2, unmatchedPlays: 0 });
  expect(scene.journeyEpisodes!.find(e => e.id === "author:reconstruction")!.listening!.count).toBe(1);
  expect(scene.journeyEpisodes!.find(e => e.id === "author:transfer")!.listening!.count).toBe(0);
  expect(parseSceneFile(reviewExport(scene, { listening: "accepted" })).scene).toEqual(scene);
  expect(() => groundJourney(DEMO_XR_SCENE, timeline([]), history([]), { ...options, authorStops: [{ ...transit, reconstructedTiming: author.reconstructedTiming }] })).toThrow();
});
