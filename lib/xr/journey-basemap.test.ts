import { describe, expect, it } from "vitest";
import { geographicToRoom, clipToRoom, polygonPath, journeyAtTime, basemapInRoom, type BasemapData } from "./journey-basemap";
import { INITIAL_CAMERA } from "./journey-camera";

describe("geographic basemap alignment", () => {
  const projection = { originLatitude: 45, originLongitude: 375, metresPerUnit: 10000 };
  it("uses the existing unwrapped origin, radius, uniform scale and north axis", () => {
    expect(geographicToRoom(15, 45, projection)).toEqual({ x: 0, z: -0 });
    const p = geographicToRoom(16, 46, projection);
    expect(p.x).toBeCloseTo(6371008.8 * Math.PI / 180 * Math.cos(Math.PI / 4) / 10000);
    expect(p.z).toBeCloseTo(-6371008.8 * Math.PI / 180 / 10000);
    expect(geographicToRoom(-179, 0, { ...projection, originLongitude: 180 }).x).toBeCloseTo(geographicToRoom(181, 0, { ...projection, originLongitude: 180 }).x);
  });
  it("clips enclosing and intersecting polygons without moving the geographic stops", () => {
    const ring = [{ x: -40, z: -40 }, { x: 40, z: -40 }, { x: 40, z: 40 }, { x: -40, z: 40 }];
    const clipped = clipToRoom(ring);
    expect(clipped).toHaveLength(4);
    expect(clipped.every(p => Math.abs(p.x) === 20 && Math.abs(p.z) === 20)).toBe(true);
    expect(ring[0].x).toBe(-40);
    expect(polygonPath(clipped, { ...INITIAL_CAMERA, distance: 3, elevation: .35 })).not.toMatch(/NaN|Infinity/);
  });
  it("keeps city labels as public context and clips out distant map features", () => {
    const data: BasemapData = { version: 1, attribution: "Fixture", sources: [], countries: [], cities: [
      { name: "Local label", rank: 1, coordinates: [15, 45] }, { name: "Far label", rank: 2, coordinates: [-90, -45] },
    ] };
    expect(basemapInRoom(data, projection).cities.map(c => c.name)).toEqual(["Local label"]);
  });
});
describe("journey time cursor", () => {
  const episodes = [
    { start: "2026-05-15T10:00:00Z", end: "2026-05-15T12:00:00Z" },
    { start: "2026-05-17T10:00:00Z", end: "2026-05-17T12:00:00Z" },
    { start: "2026-05-17T11:00:00Z", end: "2026-05-17T13:00:00Z" },
  ];
  it("reveals observations but reports gaps instead of interpolated presence", () => {
    expect(journeyAtTime(episodes, Date.parse("2026-05-15T09:00:00Z"))).toMatchObject({ count: 0, activeCount: 0, latest: -1 });
    expect(journeyAtTime(episodes, Date.parse(episodes[0].start))).toMatchObject({ count: 1, activeCount: 1, latest: 0 });
    expect(journeyAtTime(episodes, Date.parse(episodes[0].end))).toMatchObject({ count: 1, activeCount: 0 });
    expect(journeyAtTime(episodes, Date.parse("2026-09-28T12:00:00Z"))).toMatchObject({ count: 3, activeCount: 0 });
  });
  it("retains simultaneous windows rather than choosing one as true location", () => {
    expect(journeyAtTime(episodes, Date.parse("2026-05-17T11:30:00Z"))).toMatchObject({ active: [false, true, true], activeCount: 2 });
    expect(journeyAtTime(episodes, null).visible).toEqual([true, true, true]);
  });
});

it("never highlights an uncertain transit envelope as continuous presence", () => {
  const start = "2026-09-15T00:00:00Z", end = "2026-09-20T00:00:00Z";
  const result = journeyAtTime([{ start, end, reconstructedTiming: { listeningWindows: [] } }], Date.parse("2026-09-17T12:00:00Z"));
  expect(result.visible).toEqual([true]); expect(result.activeCount).toBe(0);
});
