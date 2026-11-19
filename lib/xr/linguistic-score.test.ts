import { describe, expect, it } from 'vitest';
import { cueAt, matchesScoreAudio, parseLinguisticScore, reviseCue, sceneFrame, type LinguisticScore } from './linguistic-score';

function fictionalScore(): LinguisticScore {
  return {
    version: 1, private: true, canonical: false, title: 'Fictional room study',
    authorTranscript: 'Invented words about a window and a door.', notes: 'Proposed times, not aligned words.',
    source: { offsetSeconds: 10, durationSeconds: 20, sha256: 'a'.repeat(64) }, gridBpm: 112,
    cues: [
      { id: 'window', title: 'Window', excerpt: 'A fictional window', reading: 'A proposed opening', startSeconds: 0, timing: 'proposed', decision: 'unresolved', formation: 'open', openness: 0.7, echo: 0.2 },
      { id: 'door', title: 'Door', excerpt: 'An invented door', reading: 'Another proposed opening', startSeconds: 9, timing: 'proposed', decision: 'unresolved', formation: 'gather', openness: 0.4, echo: 0.1 },
    ], history: [],
  };
}

describe('private linguistic scene score', () => {
  it('requires the selected audio fingerprint as well as duration', () => {
    const score = fictionalScore();
    expect(matchesScoreAudio(score, 20, score.source.sha256)).toBe(true);
    expect(matchesScoreAudio(score, 20, 'b'.repeat(64))).toBe(false);
    expect(matchesScoreAudio(score, null, score.source.sha256)).toBe(false);
    expect(matchesScoreAudio(score, 25, score.source.sha256)).toBe(false);
  });
  it('leaves unresolved readings off until explicit preview and withholds refused cues even in preview', () => {
    const cue = fictionalScore().cues[0];
    expect(sceneFrame(cue, false)).toBeNull();
    expect(sceneFrame(cue, true)?.formation).toBe('open');
    expect(sceneFrame({ ...cue, decision: 'accepted' }, false)).not.toBeNull();
    expect(sceneFrame({ ...cue, decision: 'refused' }, true)).toBeNull();
  });
  it('retains original words and dated disagreement across revisions and refusal', () => {
    const original = fictionalScore();
    const revised = reviseCue(original, 'window', { reading: 'The Author disagrees', decision: 'revised', formation: 'carry', echo: 0 }, '2026-10-20T12:00:00.000Z');
    const refused = reviseCue(revised, 'window', { decision: 'refused' }, '2026-10-20T12:01:00.000Z');
    expect(refused.authorTranscript).toBe(original.authorTranscript);
    expect(refused.cues[0].excerpt).toBe(original.cues[0].excerpt);
    expect(refused.history[0].before.reading).toBe('A proposed opening');
    expect(refused.history[1].before.reading).toBe('The Author disagrees');
    expect(refused.history[1].at).toBe('2026-10-20T12:01:00.000Z');
    expect(original.history).toHaveLength(0);
    expect(refused.cues[0].decision).toBe('refused');
    expect(revised.cues[0].formation).toBe('carry');
    expect(sceneFrame(revised.cues[0], false)?.echo).toBe(0);
  });
  it('uses clip-relative cue times with explicit boundaries and keeps manual marks ordered', () => {
    const score = fictionalScore();
    expect(cueAt(score, 8.99)).toBe(0); expect(cueAt(score, 9)).toBe(1);
    expect(cueAt(score, NaN)).toBe(0); expect(cueAt(score, 20)).toBe(1);
    const marked = reviseCue(score, 'door', { startSeconds: 10.5, timing: 'author-adjusted' });
    expect(cueAt(marked, 10)).toBe(0); expect(cueAt(marked, 10.5)).toBe(1);
    expect(() => reviseCue(score, 'door', { startSeconds: 0 })).toThrow();
    expect(() => reviseCue(score, 'door', { startSeconds: 20 })).toThrow();
    expect(() => reviseCue(score, 'window', { startSeconds: 1 })).toThrow();
  });
  it('rejects public/canonical scores, duplicate cues, foreign fields and oversized inputs', () => {
    const score = fictionalScore();
    const parse = (value: unknown) => parseLinguisticScore(JSON.stringify(value));
    expect(parse(score)).toEqual(score);
    expect(() => parse({ ...score, private: false })).toThrow();
    expect(() => parse({ ...score, canonical: true })).toThrow();
    expect(() => parse({ ...score, fetchUrl: 'https://example.test' })).toThrow();
    expect(() => parse({ ...score, cues: [score.cues[0], { ...score.cues[1], id: 'window' }] })).toThrow();
    expect(() => parse({ ...score, gridBpm: Infinity })).toThrow();
    expect(() => parseLinguisticScore(' '.repeat(128 * 1024 + 1))).toThrow('large');
  });
  it('fails before overwriting the history limit', () => {
    let score = fictionalScore();
    for (let index = 0; index < 128; index++) score = reviseCue(score, 'window', { decision: index % 2 ? 'refused' : 'accepted' });
    expect(() => reviseCue(score, 'window', { decision: 'revised' })).toThrow('history');
    expect(score.history).toHaveLength(128);
  });
});
