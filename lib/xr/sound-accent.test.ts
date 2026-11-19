import { describe, expect, it } from 'vitest';
import { parseLinguisticScore, reviseCue, type LinguisticScore } from './linguistic-score';
import { accentedShape, visualAccentAt } from './sound-accent';

function fictionalScore(): LinguisticScore {
  return {
    version: 1, private: true, canonical: false, title: 'Fictional accent rehearsal',
    authorTranscript: 'Invented window, uncertain doorway.', notes: 'Fictional only.',
    source: { offsetSeconds: 10, durationSeconds: 12, sha256: 'a'.repeat(64) }, gridBpm: 112,
    cues: [
      { id: 'start', title: 'Start', excerpt: 'Invented lead-in', reading: 'A quiet entry', startSeconds: 0, timing: 'proposed', decision: 'unresolved', formation: 'open', openness: 0.4, echo: 0 },
      { id: 'hit', title: 'Doorway', excerpt: 'A working label', note: 'Alternative: window; unresolved hearing retained.', reading: 'An opening pulse', startSeconds: 2, timing: 'author-adjusted', decision: 'unresolved', formation: 'open', openness: 0.6, echo: 0.1, accent: { kind: 'drop', reaction: 'release', durationSeconds: 1, strength: 0.8 } },
      { id: 'next', title: 'Next word', excerpt: 'Invented word', reading: 'A new pulse', startSeconds: 4, timing: 'author-adjusted', decision: 'unresolved', formation: 'gather', openness: 0.4, echo: 0, accent: { kind: 'word', reaction: 'gather', durationSeconds: 0.5, strength: 0.6 } },
    ], history: [],
  };
}

describe('word, beat and drop visual accents', () => {
  it('starts at the marked clip-relative time, decays, and stops without trailing timers', () => {
    const score = fictionalScore();
    expect(visualAccentAt(score, 1.999, true, true)).toBeNull();
    expect(visualAccentAt(score, 2, true, true)).toMatchObject({ cueId: 'hit', intensity: 0.8, progress: 0 });
    expect(visualAccentAt(score, 2.5, true, true)?.intensity).toBeCloseTo(0.2);
    expect(visualAccentAt(score, 3, true, true)).toBeNull();
    expect(visualAccentAt(score, 4, true, true)?.cueId).toBe('next');
    expect(visualAccentAt(score, 2, true, false)).toBeNull();
    expect(visualAccentAt(score, 12, true, true)).toBeNull();
    expect(visualAccentAt(score, NaN, true, true)).toBeNull();
  });
  it('keeps timing agreement separate from meaning consent and never previews a refused cue', () => {
    const score = fictionalScore();
    expect(visualAccentAt(score, 2, false, true)).toBeNull();
    const accepted = reviseCue(score, 'hit', { decision: 'accepted' });
    expect(visualAccentAt(accepted, 2, false, true)).not.toBeNull();
    const refused = reviseCue(accepted, 'hit', { decision: 'refused' });
    expect(visualAccentAt(refused, 2, true, true)).toBeNull();
    expect(refused.cues[1].startSeconds).toBe(2);
  });
  it('replays from the audio clock and ends a preceding accent when the next marker starts', () => {
    const score = fictionalScore();
    const overlap = reviseCue(score, 'next', { startSeconds: 2.5 });
    expect(visualAccentAt(overlap, 2.49, true, true)?.cueId).toBe('hit');
    expect(visualAccentAt(overlap, 2.5, true, true)?.cueId).toBe('next');
    expect(visualAccentAt(overlap, 0, true, true)).toBeNull();
    expect(visualAccentAt(overlap, 2, true, true)?.intensity).toBe(0.8);
  });
  it('preserves uncertainty notes and earlier effects when a response is revised or removed', () => {
    const score = parseLinguisticScore(JSON.stringify(fictionalScore()));
    const revised = reviseCue(score, 'hit', { accent: { kind: 'beat', reaction: 'ripple', durationSeconds: 0.7, strength: 0.5 }, decision: 'revised' });
    expect(revised.cues[1].note).toBe(score.cues[1].note);
    expect(revised.history[0].before.accent?.reaction).toBe('release');
    expect(visualAccentAt(revised, 2, false, true)?.reaction).toBe('ripple');
    expect(visualAccentAt(reviseCue(revised, 'hit', { accent: null }), 2, true, true)).toBeNull();
  });
  it('layers bounded geometry over hands without mutating them and respects reduced motion', () => {
    const hands = { stretch: 0.9, fold: 0.1 };
    const accent = visualAccentAt(fictionalScore(), 2, true, true)!;
    expect(accentedShape(hands, accent, false)).toEqual({ stretch: 1, fold: 0 });
    expect(hands).toEqual({ stretch: 0.9, fold: 0.1 });
    expect(accentedShape(hands, accent, true)).toEqual(hands);
    expect(accentedShape(hands, null, false)).toEqual(hands);
  });
  it('rejects unsupported effects, excessive lengths, invalid strengths and secret extra fields', () => {
    const score = fictionalScore();
    const parse = (accent: unknown) => parseLinguisticScore(JSON.stringify({ ...score, cues: score.cues.map(cue => cue.id === 'hit' ? { ...cue, accent } : cue) }));
    const accent = score.cues[1].accent!;
    expect(() => parse({ ...accent, durationSeconds: 30 })).toThrow();
    expect(() => parse({ ...accent, strength: 2 })).toThrow();
    expect(() => parse({ ...accent, reaction: 'flash-screen' })).toThrow();
    expect(() => parse({ ...accent, remoteUrl: 'https://example.test' })).toThrow();
  });
});
