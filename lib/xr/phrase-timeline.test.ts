import { describe, expect, it } from 'vitest';
import { formatPhraseTime, phraseTimeline } from './phrase-timeline';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { XRPhraseTimeline } from '@/components/xr/xr-phrase-timeline';
import type { LinguisticScore } from './linguistic-score';

describe('visible source-time markers', () => {
  it('shows original recording time separately from clip elapsed time', () => {
    const timeline = phraseTimeline(11.2, 22, 26);
    expect(timeline.sourceTime).toBe(37.2);
    expect(formatPhraseTime(timeline.sourceTime)).toBe('00:37.2');
    expect(formatPhraseTime(timeline.elapsed)).toBe('00:11.2');
    expect(timeline.percent).toBeCloseTo(11.2 / 22 * 100);
    expect(timeline.ticks[0]).toMatchObject({ sourceSeconds: 26, percent: 0 });
    expect(timeline.ticks.at(-1)).toMatchObject({ sourceSeconds: 48, percent: 100 });
  });
  it('holds the last source time at the end instead of displaying the clip length as source time', () => {
    const end = phraseTimeline(22, 22, 26);
    expect(formatPhraseTime(end.sourceTime)).toBe('00:48.0');
    expect(end.percent).toBe(100);
    expect(phraseTimeline(25, 22, 26).sourceTime).toBe(48);
  });
  it('rolls rounded tenths across minute boundaries correctly', () => {
    expect(formatPhraseTime(59.96)).toBe('01:00.0');
    expect(formatPhraseTime(60.14)).toBe('01:00.1');
    expect(formatPhraseTime(NaN)).toBe('00:00.0');
    expect(formatPhraseTime(-2)).toBe('00:00.0');
  });
  it('bounds drawing work and does not fabricate progress for missing or invalid durations', () => {
    expect(phraseTimeline(5, 0, 26)).toMatchObject({ sourceTime: 26, percent: 0, ticks: [] });
    expect(phraseTimeline(Infinity, NaN, NaN)).toMatchObject({ sourceTime: 0, percent: 0, ticks: [] });
    expect(phraseTimeline(-3, 22, 26).elapsed).toBe(0);
    expect(phraseTimeline(10, 86400, 0).ticks.length).toBeLessThanOrEqual(61);
  });
  it('retains the exact source window when decoding rounds the audio length slightly', () => {
    const score: LinguisticScore = {
      version: 1, private: true, canonical: false, title: 'Fictional temporal fixture',
      authorTranscript: 'An invented window.', notes: 'Fictional timing check.',
      source: { offsetSeconds: 10, durationSeconds: 12, sha256: '0'.repeat(64) }, gridBpm: 112,
      cues: [{ id: 'window', title: 'Window', excerpt: 'Invented words', reading: 'A possible opening', startSeconds: 0, timing: 'proposed', decision: 'unresolved', formation: 'open', openness: 0.5, echo: 0 }], history: [],
    };
    const html = renderToStaticMarkup(createElement(XRPhraseTimeline, { position: 7.2, duration: 11.99997, playing: true, starting: false, score, activeCue: 0, onTogglePlayback: () => {} }));
    expect(html).toContain('aria-valuemin="10"');
    expect(html).toContain('aria-valuemax="22"');
    expect(html).toContain('aria-valuenow="17.2"');
    expect(html).toContain('<small>00:22</small>');
    expect(html).toContain('00:17.2'); expect(html).toContain('00:07.2');
  });
  it('labels an ordinary selected sketch with clip time instead of inventing a source offset', () => {
    const html = renderToStaticMarkup(createElement(XRPhraseTimeline, { position: 4.2, duration: 12, playing: false, starting: true, score: null, activeCue: 0, onTogglePlayback: () => {} }));
    expect(html).toContain('aria-label="Clip playback time"');
    expect(html).toContain('00:04.2'); expect(html).not.toContain('SOURCE TIME');
    expect(html).toContain('disabled=""'); expect(html).toContain('Starting…');
  });
});
