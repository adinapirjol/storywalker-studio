type ReplayState = { next_delivery_at: string | null; now: string };

// Workflow review status can change after the final delivery. The schedule,
// not an Author decision, determines whether playback has finished.
export function replayFinished(state: ReplayState | null): boolean {
  return state !== null && state.next_delivery_at === null;
}

export function replayDelay(state: ReplayState | null, speed: number): number | null {
  if (replayFinished(state)) return null;
  if (!state) return 0;
  return Math.max(0, Date.parse(state.next_delivery_at!) - Date.parse(state.now)) / speed;
}
