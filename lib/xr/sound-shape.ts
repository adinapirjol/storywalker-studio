import { fingerSpread } from './palm-open';
import type { HandPoint } from './finger-tracking';

export const SKETCH_BPM = 148;
export type SoundShape = { stretch: number; fold: number };
export const INITIAL_SHAPE: SoundShape = { stretch: 0.55, fold: 0.15 };

export function unit(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

/** Two palm centres stretch the ribbon; finger openness folds it. No identity or emotion. */
export function shapeFromHands(hands: HandPoint[][], previous: SoundShape): SoundShape | null {
  if (hands.length < 1 || hands.length > 2 || hands.some(hand =>
    hand.length !== 21 || !hand.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) &&
      p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1))) return null;
  const openness = hands.map(hand => fingerSpread([hand]));
  if (openness.some(amount => amount === null)) return null;
  const fold = 1 - openness.reduce<number>((sum, amount) => sum + amount!, 0) / hands.length;
  if (hands.length === 1) return { stretch: previous.stretch, fold: unit(fold) };
  const centre = (hand: HandPoint[]) => ({
    x: (hand[0].x + hand[5].x + hand[17].x) / 3,
    y: (hand[0].y + hand[5].y + hand[17].y) / 3,
  });
  const a = centre(hands[0]), b = centre(hands[1]);
  return { stretch: unit((Math.hypot(a.x - b.x, a.y - b.y) - 0.12) / 0.55), fold: unit(fold) };
}

export function soundParameters(shape: SoundShape) {
  return {
    cutoff: 450 * Math.pow(32, unit(shape.stretch)),
    echo: unit(shape.fold) * 0.32,
    delay: 60 / SKETCH_BPM / 2,
    // The source rate never follows hand distance: the groove remains at 148 BPM.
    playbackRate: 1,
  };
}

/** A short-lived RMS level, not a recording, transcript, location or mood classification. */
export function ambientLevel(samples: Float32Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (const sample of samples) sum += Number.isFinite(sample) ? sample * sample : 0;
  return unit((Math.sqrt(sum / samples.length) - 0.006) * 9);
}

export function followLevel(previous: number, next: number): number {
  return unit(previous + (unit(next) - previous) * (next > previous ? 0.24 : 0.07));
}
