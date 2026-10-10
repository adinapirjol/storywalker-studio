import { describe, expect, it } from "vitest";
import { INITIAL_CAMERA, projectRoom, projectSegment, unprojectRoom, zoomCamera } from "./journey-camera";

describe("journey camera", () => {
  it("round trips geographic floor points through an orbited, panned perspective view", () => {
    for (const yaw of [-2, 0, 1.5]) for (const elevation of [.35, 1.1, Math.PI / 2]) {
      const camera = { ...INITIAL_CAMERA, yaw, elevation, target: { x: 4, z: -2 } };
      for (const p of [{ x: -18, z: 18 }, { x: 3, z: 7 }, { x: 0, z: 0 }]) {
        const projected = projectRoom(p, camera), restored = unprojectRoom(projected, camera)!;
        expect(restored.x).toBeCloseTo(p.x, 8); expect(restored.z).toBeCloseTo(p.z, 8);
      }
    }
  });
  it("keeps north up and east right initially, and magnifies the focused place", () => {
    const center = projectRoom({ x: 0, z: 0 }, INITIAL_CAMERA);
    expect(projectRoom({ x: 0, z: -10 }, INITIAL_CAMERA).y).toBeLessThan(center.y);
    expect(projectRoom({ x: 10, z: 0 }, INITIAL_CAMERA).x).toBeGreaterThan(center.x);
    const camera = { ...INITIAL_CAMERA, target: { x: 12, z: -5 }, distance: 8 };
    expect(projectRoom(camera.target, camera)).toMatchObject({ x: 400, y: 300 });
    expect(projectRoom(camera.target, camera).scale).toBeGreaterThan(center.scale);
  });
  it("bounds repeated scroll zoom without mutating the geographic target", () => {
    let camera = INITIAL_CAMERA;
    for (let i = 0; i < 100; i++) camera = zoomCamera(camera, -10000);
    expect(camera.distance).toBe(3);
    for (let i = 0; i < 100; i++) camera = zoomCamera(camera, 10000);
    expect(camera.distance).toBe(140);
    expect(camera.target).toEqual(INITIAL_CAMERA.target); expect(INITIAL_CAMERA.distance).toBe(64);
  });
  it("rejects ground-plane drags beyond the perspective horizon", () => {
    expect(unprojectRoom({ x: 400, y: -10000 }, { ...INITIAL_CAMERA, elevation: .35 })).toBeNull();
  });
  it("clips either end of a route crossing behind a close camera", () => {
    const camera = { ...INITIAL_CAMERA, distance: 3, elevation: .35 };
    const a = { x: -2, z: -20 }, b = { x: 2, z: 20 };
    const forward = projectSegment(a, b, camera)!, reverse = projectSegment(b, a, camera)!;
    expect(forward.to.depth).toBeCloseTo(.2); expect(reverse.from.depth).toBeCloseTo(.2);
    expect(forward.from).toEqual(reverse.to);
    expect(forward.to.x).toBeCloseTo(reverse.from.x);
    expect(projectSegment(b, { x: 3, z: 30 }, camera)).toBeNull();
  });
});
