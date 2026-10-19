export type Palm = { x: number; y: number };
export type SwipeDirection = -1 | 1;
export type SwipeFeedback = { phase: 'missing' | 'holding' | 'ready' | 'cooldown'; progress: number; direction: SwipeDirection | null };
/** One deliberate horizontal sweep per hold. Coordinates are unmirrored camera input. */
export class AirSwipe {
  constructor(private readonly distance = .12, private readonly maxSweepMs = 1800) {}
  feedback: SwipeFeedback = { phase: 'missing', progress: 0, direction: null };
  private anchor: (Palm & { at: number }) | null = null;
  private previous: (Palm & { at: number }) | null = null;
  private armed = false;
  private movementAt: number | null = null;
  private cooldown = 0;
  reset() {
    this.anchor = null; this.previous = null; this.armed = false;
    this.movementAt = null; this.cooldown = 0;
    this.feedback = { phase: 'missing', progress: 0, direction: null };
  }
  sample(palm: Palm | null, at: number): SwipeDirection | null {
    if (!Number.isFinite(at)) return null;
    // Keep success visible through the cooldown, including while the hand returns.
    if (at < this.cooldown) return null;
    if (!palm || !Number.isFinite(palm.x) || !Number.isFinite(palm.y)) {
      this.reset(); return null;
    }
    if (this.previous && (at <= this.previous.at || at - this.previous.at > 800)) {
      this.reset();
    }
    this.previous = { ...palm, at };
    if (!this.anchor) {
      this.anchor = { ...palm, at }; this.movementAt = null;
      this.feedback = { phase: 'holding', progress: 0, direction: null }; return null;
    }
    const dx = palm.x - this.anchor.x, dy = palm.y - this.anchor.y;
    if (!this.armed) {
      if (Math.hypot(dx, dy) > .075) this.anchor = { ...palm, at };
      else if (at - this.anchor.at >= 250) {
        this.armed = true; this.anchor = { ...palm, at };
        this.feedback = { phase: 'ready', progress: 0, direction: null };
      }
      return null;
    }
    // A ready palm can wait indefinitely. The sweep timer starts with movement.
    if (Math.abs(dx) < .025 && Math.abs(dy) < .08) this.movementAt = null;
    else this.movementAt ??= at;
    if (Math.abs(dy) > .2 || (this.movementAt !== null && at - this.movementAt > this.maxSweepMs)) {
      this.anchor = null; this.armed = false;
      this.feedback = { phase: 'holding', progress: 0, direction: null }; return null;
    }
    this.feedback = { phase: 'ready', progress: Math.max(-1, Math.min(1, -dx / this.distance)), direction: null };
    if (Math.abs(dx) >= this.distance && Math.abs(dx) > Math.abs(dy) * 1.25) {
      const direction = dx > 0 ? 1 : -1;
      this.armed = false; this.anchor = null; this.cooldown = at + 1200;
      this.feedback = { phase: 'cooldown', progress: -direction, direction };
      return direction;
    }
    return null;
  }
}
