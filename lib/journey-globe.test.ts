import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { episodeGeography, GLOBE_CAMERA, globeTurn, globeZoom, projectSphere, sphereArc, spherePoint, visibleArcPath } from "./journey-globe";
import type { JourneyEpisode } from "./journey-episode";

describe("spherical journey geography", () => {
  it("places latitude/longitude on a unit sphere with north at the pole", () => {
    expect(spherePoint({ latitude: 0, longitude: 0 })).toEqual({ x: 0, y: 0, z: 1 });
    const north = spherePoint({ latitude: 90, longitude: 30 }); expect(north.y).toBeCloseTo(1);
    for (const longitude of [-180, -90, 0, 90, 180]) {
      const p = spherePoint({ latitude: 51, longitude }); expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1);
    }
  });
  it("centres the focused location, includes the UK, and hides the far hemisphere", () => {
    const uk = { latitude: 54, longitude: -3 };
    expect(projectSphere(spherePoint(uk), GLOBE_CAMERA).depth).toBeGreaterThan(.8);
    const focused = projectSphere(spherePoint(uk), { ...uk, zoom: 12 });
    expect(focused.x).toBeCloseTo(400); expect(focused.y).toBeCloseTo(300);
    expect(projectSphere(spherePoint({ latitude: -48, longitude: -170 }), GLOBE_CAMERA).depth).toBeCloseTo(-1);
  });
  it("wraps rotation and zooms back to an entire globe without changing geography", () => {
    let c = GLOBE_CAMERA;
    for (let i = 0; i < 100; i++) c = globeZoom(c, -300);
    expect(c.zoom).toBe(24);
    for (let i = 0; i < 100; i++) c = globeZoom(c, 300);
    expect(c).toEqual(GLOBE_CAMERA);
    const turned = globeTurn(c, 10000, 10000);
    expect(turned.longitude).toBeGreaterThanOrEqual(-180); expect(turned.longitude).toBeLessThan(180); expect(turned.latitude).toBe(89.9);
  });
  it("takes the short spherical arc across the date line, and never draws a back-side arc", () => {
    const arc = sphereArc(spherePoint({ latitude: 0, longitude: 179 }), spherePoint({ latitude: 0, longitude: -179 }));
    expect(arc.length).toBeLessThan(5); expect(arc.every(p => p.z < -.99)).toBe(true);
    expect(visibleArcPath(arc, { latitude: 0, longitude: 0, zoom: 1 })).toBe("");
    expect(visibleArcPath(arc, { latitude: 0, longitude: 180, zoom: 1 })).toContain("L");
    expect(sphereArc({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 })).toEqual([]);
  });
  it("uses sourced geography, never MEMORY displacement or a contextual place label", () => {
    const episode = { worldPosition: { evidenceIds: ["geo"] }, memoryPosition: { x: -20, y: 0, z: 20 }, provenance: { nodes: [
      { id: "geo", type: "timeline", coordinates: { latitude: 45, longitude: 15 } },
      { id: "context", type: "author", statement: "A closing episode" },
    ] } } as JourneyEpisode;
    expect(episodeGeography(episode)).toEqual({ latitude: 45, longitude: 15 });
    expect(episodeGeography({ ...episode, worldPosition: undefined })).toBeNull();
  });
  it("ships worldwide reference geometry including the United Kingdom", () => {
    const data = JSON.parse(readFileSync(new URL("../public/maps/natural-earth.json", import.meta.url), "utf8"));
    expect(data.countries.find((c: { name: string }) => c.name === "United Kingdom").polygons.length).toBeGreaterThan(0);
    expect(data.countries.length).toBe(177);
  });
});
