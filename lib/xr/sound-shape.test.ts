import { describe, expect, it } from 'vitest';
import { ambientLevel, followLevel, INITIAL_SHAPE, shapeFromHands, soundParameters } from './sound-shape';
import type { HandPoint } from './finger-tracking';

function hand(x: number, open: boolean): HandPoint[] {
  const points = Array.from({ length: 21 }, () => ({ x, y: 0.55 }));
  points[0] = { x, y: 0.7 }; points[5] = { x: x - 0.04, y: 0.55 }; points[17] = { x: x + 0.04, y: 0.55 };
  for (const [i, tip] of [4, 8, 12, 16, 20].entries()) {
    points[tip] = open ? { x: x + (i - 2) * 0.05, y: 0.35 } : { x, y: 0.55 };
  }
  return points;
}

describe('hand-shaped sound', () => {
  it('stretches with two separated hands without relying on hand ordering', () => {
    const close = shapeFromHands([hand(0.4, true), hand(0.6, true)], INITIAL_SHAPE)!;
    const far = shapeFromHands([hand(0.15, true), hand(0.85, true)], INITIAL_SHAPE)!;
    expect(far.stretch).toBeGreaterThan(close.stretch);
    expect(shapeFromHands([hand(0.85, true), hand(0.15, true)], INITIAL_SHAPE)).toEqual(far);
  });
  it('uses one hand to fold while preserving stretch; missing hands hold the last shape', () => {
    const open = shapeFromHands([hand(0.5, true)], INITIAL_SHAPE)!;
    const closed = shapeFromHands([hand(0.5, false)], INITIAL_SHAPE)!;
    expect(open.stretch).toBe(INITIAL_SHAPE.stretch);
    expect(closed.fold).toBeGreaterThan(open.fold);
    expect(shapeFromHands([], closed)).toBeNull();
  });
  it('rejects malformed landmarks rather than sending jumps to the instrument', () => {
    const invalid = hand(0.5, true); invalid[8].x = NaN;
    expect(shapeFromHands([invalid], INITIAL_SHAPE)).toBeNull();
    expect(shapeFromHands([hand(2, true)], INITIAL_SHAPE)).toBeNull();
    expect(shapeFromHands([[{ x: 0.5, y: 0.5 }]], INITIAL_SHAPE)).toBeNull();
  });
  it('keeps the 148 BPM source rate fixed and echo bounded at all hand extremes', () => {
    for (const stretch of [-1, 0, 1, Infinity]) for (const fold of [-1, 0, 1, NaN]) {
      const value = soundParameters({ stretch, fold });
      expect(value.playbackRate).toBe(1);
      expect(value.delay).toBeCloseTo(60 / 148 / 2);
      expect(value.echo).toBeGreaterThanOrEqual(0); expect(value.echo).toBeLessThanOrEqual(0.32);
      expect(value.cutoff).toBeGreaterThanOrEqual(450); expect(value.cutoff).toBeLessThanOrEqual(14400);
    }
  });
});

describe('ambient influence', () => {
  it('reduces silence and louder sound to a bounded scalar; no semantic classification', () => {
    expect(ambientLevel(new Float32Array(512))).toBe(0);
    const quiet = ambientLevel(new Float32Array(512).fill(0.02));
    const loud = ambientLevel(new Float32Array(512).fill(0.2));
    expect(loud).toBeGreaterThan(quiet); expect(loud).toBeLessThanOrEqual(1);
    expect(ambientLevel(new Float32Array([NaN, Infinity]))).toBe(0);
  });
  it('smooths sudden sound changes and settles back towards silence', () => {
    const first = followLevel(0, 1);
    expect(first).toBeGreaterThan(0); expect(first).toBeLessThan(1);
    let level = first;
    for (let i = 0; i < 150; i++) level = followLevel(level, 0);
    expect(level).toBeLessThan(0.001);
  });
});
