// Spring physics for touch-driven motion, using Apple's designer-friendly
// parameters: a damping ratio (1 = no overshoot, < 1 = bouncy) and a
// response time in seconds. Springs start from wherever the element is now
// and keep its current velocity, so any motion can be grabbed and reversed.

export interface SpringConfig {
  /** 1 = critically damped (no bounce). ~0.8 = a little bounce. */
  damping: number;
  /** Roughly how quickly it gets there, in seconds (not a fixed duration). */
  response: number;
}

/** Default for most UI: smooth, no overshoot. */
export const SMOOTH: SpringConfig = { damping: 1, response: 0.35 };
/** After a flick: a touch of bounce, because the gesture carried momentum. */
export const MOMENTUM: SpringConfig = { damping: 0.8, response: 0.3 };

/** One simulation step. Mass is 1; stiffness and damping come from Apple's formulas. */
export function stepSpring(
  value: number,
  velocity: number,
  target: number,
  config: SpringConfig,
  dt: number,
): { value: number; velocity: number } {
  const stiffness = (2 * Math.PI / config.response) ** 2;
  const damping = (4 * Math.PI * config.damping) / config.response;
  // Small sub-steps keep the simulation stable at low frame rates.
  const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / steps;
  let x = value;
  let v = velocity;
  for (let i = 0; i < steps; i++) {
    const accel = -stiffness * (x - target) - damping * v;
    v += accel * h; // semi-implicit Euler: update velocity first
    x += v * h;
  }
  return { value: x, velocity: v };
}

export function isSettled(value: number, velocity: number, target: number, precision = 0.5): boolean {
  return Math.abs(value - target) < precision && Math.abs(velocity) < precision * 10;
}

export interface SpringHandle {
  /** Stop and return where it was (for interrupting mid-flight). */
  stop: () => { value: number; velocity: number };
}

/**
 * Animate a number with a spring on the display clock. Starts from `from`
 * with `velocity` (px/s), so a drag release hands its speed straight over.
 */
export function animateSpring(opts: {
  from: number;
  to: number;
  velocity?: number;
  config?: SpringConfig;
  onUpdate: (value: number) => void;
  onComplete?: () => void;
}): SpringHandle {
  const config = opts.config ?? SMOOTH;
  let value = opts.from;
  let velocity = opts.velocity ?? 0;
  let last = performance.now();
  let frame = requestAnimationFrame(function tick(now) {
    const dt = Math.min(0.064, (now - last) / 1000); // don't explode after a long pause
    last = now;
    ({ value, velocity } = stepSpring(value, velocity, opts.to, config, dt));
    if (isSettled(value, velocity, opts.to)) {
      opts.onUpdate(opts.to);
      opts.onComplete?.();
      return;
    }
    opts.onUpdate(value);
    frame = requestAnimationFrame(tick);
  });
  return {
    stop: () => {
      cancelAnimationFrame(frame);
      return { value, velocity };
    },
  };
}

/**
 * Where a flick would come to rest, like scroll deceleration
 * (Apple's projection function; rate ≈ 0.998 for a normal scroll feel).
 */
export function project(velocityPxPerSec: number, decelerationRate = 0.998): number {
  return ((velocityPxPerSec / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Soft resistance past an edge: the further you pull, the less it follows. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  const sign = Math.sign(overshoot);
  const o = Math.abs(overshoot);
  return (sign * (o * dimension * constant)) / (dimension + constant * o);
}

/** Tracks recent pointer positions to measure release velocity (px/s). */
export class VelocityTracker {
  private points: { t: number; y: number }[] = [];
  add(y: number, t = performance.now()) {
    this.points.push({ t, y });
    // Only the last ~100 ms matter for release speed.
    while (this.points.length > 2 && t - this.points[0].t > 100) this.points.shift();
  }
  velocity(): number {
    if (this.points.length < 2) return 0;
    const a = this.points[0];
    const b = this.points.at(-1)!;
    const dt = (b.t - a.t) / 1000;
    return dt > 0 ? (b.y - a.y) / dt : 0;
  }
  reset() {
    this.points = [];
  }
}
