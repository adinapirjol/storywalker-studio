import { describe, expect, it } from 'vitest';
import { replayDelay, replayFinished } from './context-replay';

describe('fictional replay lifecycle', () => {
  it('starts an uninitialized scenario but never schedules an exhausted one', () => {
    expect(replayDelay(null, 20)).toBe(0);
    const exhausted = { now: '2030-05-01T12:02:00Z', next_delivery_at: null };
    expect(replayFinished(exhausted)).toBe(true);
    expect(replayDelay(exhausted, 20)).toBeNull();
  });
  it('uses the arrival schedule at every replay speed', () => {
    const pending = { now: '2030-05-01T12:00:00Z', next_delivery_at: '2030-05-01T12:00:10Z' };
    expect(replayFinished(pending)).toBe(false);
    expect([1, 5, 20].map(speed => replayDelay(pending, speed))).toEqual([10000, 2000, 500]);
  });
  it('delivers overdue observations immediately without reviving a finished replay', () => {
    expect(replayDelay({ now: '2030-05-01T12:00:20Z', next_delivery_at: '2030-05-01T12:00:10Z' }, 1)).toBe(0);
    // Review, refusal and source deletion can change status after exhaustion.
    for (const status of ['done', 'awaiting-Author', 'accepted', 'refused']) {
      expect(replayDelay({ now: '2030-05-01T12:02:00Z', next_delivery_at: null, ...{ status } }, 1)).toBeNull();
    }
  });
});
