/** Frame-rate independent visual follow; navigation commits only after settling. */
export function followWindowDrag(current: number, target: number, dt: number, reducedMotion = false) {
  const bounded = Number.isFinite(target) ? Math.max(-1, Math.min(1, target)) : 0;
  if (reducedMotion) return bounded;
  const next = current + (bounded - current) * (1 - Math.exp(-Math.max(0, Math.min(.1, dt)) * 18));
  return Math.abs(next - bounded) < .002 ? bounded : next;
}
