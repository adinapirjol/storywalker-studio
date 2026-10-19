import { describe, expect, it } from 'vitest';
import { headPerspective, relativeHead } from './head-perspective';
import { projectPoint } from './spatial-projection';

describe('fictional viewing perspective', () => {
  const base = { x: 0, z: 0, yaw: 0, eye: 1.7 };
  it('never mutates the navigation camera, and anchors the focal plane', () => {
    const before = { ...base }, view = headPerspective(base, { x: 1, y: 1 });
    expect(base).toEqual(before);
    const point = { x: 1, z: -4, y: 1 };
    const original = projectPoint(point, base, 800, 600)!;
    const shifted = projectPoint(point, view, 800, 600)!;
    expect(shifted.x).toBeCloseTo(original.x); expect(shifted.y).toBeCloseTo(original.y);
  });
  it('reveals depth through different near/far movement', () => {
    const view = headPerspective(base, { x: 1, y: 0 });
    expect(projectPoint({ x: 0, z: -2 }, view, 800, 600)!.x).toBeLessThan(400);
    expect(projectPoint({ x: 0, z: -8 }, view, 800, 600)!.x).toBeGreaterThan(400);
  });
  it('bounds movement and treats invalid coordinates as neutral', () => {
    const bounded=headPerspective(base,{x:90,y:-90},5);
    expect(bounded.x).toBe(.9);expect(bounded.eye).toBeCloseTo(.8);
    expect(headPerspective(base, { x: NaN, y: Infinity })).toMatchObject(base);
    expect(relativeHead({ x: .1, y: .9 }, { x: .5, y: .5 })).toEqual({ x: 1, y: -1 });
  });
  it('moves along the viewing axes after turning', () => {
    const view = headPerspective({ ...base, yaw: Math.PI / 2 }, { x: 1, y: 0 });
    expect(view.x).toBeCloseTo(0); expect(view.z).toBeCloseTo(.6);
  });
});
