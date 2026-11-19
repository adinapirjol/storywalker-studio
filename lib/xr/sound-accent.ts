import { cueAt, readingEnabled, type LinguisticScore, type SoundAccent } from './linguistic-score';
import { unit, type SoundShape } from './sound-shape';

export type VisualAccent = SoundAccent & { progress: number; intensity: number; cueId: string };

/** A bounded, audio-clock envelope. No beat detection, word recognition or queued timers. */
export function visualAccentAt(score: LinguisticScore, seconds: number, preview: boolean, playing: boolean): VisualAccent | null {
  if (!playing || !Number.isFinite(seconds) || seconds < 0 || seconds >= score.source.durationSeconds) return null;
  const cue = score.cues[cueAt(score, seconds)];
  if (!cue.accent || !readingEnabled(cue, preview)) return null;
  const elapsed = seconds - cue.startSeconds;
  if (elapsed < 0 || elapsed >= cue.accent.durationSeconds) return null;
  const progress = elapsed / cue.accent.durationSeconds;
  return { ...cue.accent, cueId: cue.id, progress, intensity: cue.accent.strength * (1 - progress) ** 2 };
}

/** Temporary geometry layered on the held hand shape; never writes back into it. */
export function accentedShape(shape: SoundShape, accent: VisualAccent | null, reducedMotion: boolean): SoundShape {
  if (!accent || reducedMotion) return shape;
  const amount = unit(accent.intensity);
  const movement: Record<SoundAccent['reaction'], SoundShape> = {
    gather: { stretch: -0.12, fold: 0.08 },
    ripple: { stretch: 0, fold: 0.2 },
    compress: { stretch: -0.28, fold: 0.14 },
    burst: { stretch: 0.14, fold: 0.12 },
    release: { stretch: 0.32, fold: -0.18 },
    halo: { stretch: 0.07, fold: -0.08 },
  };
  const delta = movement[accent.reaction];
  return { stretch: unit(shape.stretch + delta.stretch * amount), fold: unit(shape.fold + delta.fold * amount) };
}
