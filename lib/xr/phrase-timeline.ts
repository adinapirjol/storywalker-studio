/** Presentation times follow the audio clock; never infer phrase boundaries. */
export function formatPhraseTime(seconds: number): string {
  const tenths = Math.round(Math.max(0, Number.isFinite(seconds) ? seconds : 0) * 10);
  const minutes = Math.floor(tenths / 600);
  const remainder = tenths % 600;
  return `${String(minutes).padStart(2, '0')}:${(remainder / 10).toFixed(1).padStart(4, '0')}`;
}

export function phraseTimeline(position: number, duration: number, sourceOffset: number) {
  const length = Number.isFinite(duration) ? Math.max(0, Math.min(60, duration)) : 0;
  const offset = Number.isFinite(sourceOffset) ? Math.max(0, Math.min(86400, sourceOffset)) : 0;
  const elapsed = Number.isFinite(position) ? Math.max(0, Math.min(length, position)) : 0;
  const end = offset + length;
  const interval = length > 40 ? 5 : length > 14 ? 2 : 1;
  const ticks: { sourceSeconds: number; percent: number; major: boolean }[] = [];
  if (length > 0) {
    for (let second = Math.ceil(offset); second <= Math.floor(end); second++) {
      ticks.push({ sourceSeconds: second, percent: (second - offset) / length * 100, major: second % interval === 0 });
    }
  }
  return { length, offset, end, elapsed, sourceTime: offset + elapsed, percent: length ? elapsed / length * 100 : 0, ticks };
}
