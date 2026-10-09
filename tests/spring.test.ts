import { describe, expect, it } from 'vitest';
import { isSettled, MOMENTUM, project, rubberband, SMOOTH, stepSpring, VelocityTracker } from '../src/lib/spring';

/** Run a spring for `seconds` at 60 fps and record every value. */
function run(from: number, to: number, velocity: number, config = SMOOTH, seconds = 2) {
  let value = from;
  let v = velocity;
  const values: number[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    ({ value, velocity: v } = stepSpring(value, v, to, config, 1 / 60));
    values.push(value);
  }
  return { values, value, velocity: v };
}

describe('springs', () => {
  it('a critically damped spring settles without overshooting', () => {
    const { values, value, velocity } = run(0, 100, 0, SMOOTH);
    expect(Math.max(...values)).toBeLessThanOrEqual(100.01);
    expect(isSettled(value, velocity, 100)).toBe(true);
  });

  it('a bouncy spring overshoots a little, then settles', () => {
    const { values, value, velocity } = run(0, 100, 0, MOMENTUM);
    const peak = Math.max(...values);
    expect(peak).toBeGreaterThan(100);
    expect(peak).toBeLessThan(110);
    expect(isSettled(value, velocity, 100)).toBe(true);
  });

  it('carries the release velocity (no seam between drag and animation)', () => {
    // Moving fast towards the target: it should cover more ground in the first frame.
    const still = stepSpring(0, 0, 100, SMOOTH, 1 / 60);
    const flicked = stepSpring(0, 2000, 100, SMOOTH, 1 / 60);
    expect(flicked.value).toBeGreaterThan(still.value + 20);
  });

  it('can be re-targeted mid-flight without a jump', () => {
    const mid = run(0, 100, 0, SMOOTH, 0.1);
    const next = stepSpring(mid.value, mid.velocity, 0, SMOOTH, 1 / 60);
    expect(Math.abs(next.value - mid.value)).toBeLessThan(10); // continuous, not snapped
  });

  it('a smaller response gets there sooner', () => {
    const fast = run(0, 100, 0, { damping: 1, response: 0.2 }, 0.2).value;
    const slow = run(0, 100, 0, { damping: 1, response: 0.6 }, 0.2).value;
    expect(fast).toBeGreaterThan(slow);
  });
});

describe('gesture helpers', () => {
  it('projects where a flick would land', () => {
    expect(project(1000)).toBeCloseTo(499);
    expect(project(-1000)).toBeCloseTo(-499);
    expect(project(1000, 0.99)).toBeCloseTo(99);
  });

  it('rubber-bands: follows less the further you pull, never past the limit', () => {
    expect(rubberband(0, 400)).toBe(0);
    const a = rubberband(50, 400);
    const b = rubberband(200, 400);
    expect(a).toBeLessThan(50);
    expect(b).toBeGreaterThan(a);
    expect(b / 200).toBeLessThan(a / 50); // diminishing returns
    expect(rubberband(1e6, 400)).toBeLessThan(400);
    expect(rubberband(-50, 400)).toBeCloseTo(-a);
  });

  it('measures release velocity from the last ~100 ms', () => {
    const t = new VelocityTracker();
    t.add(0, 0);
    t.add(10, 50);
    t.add(40, 100);
    t.add(80, 150);
    expect(t.velocity()).toBeCloseTo(700); // (80 − 10) px over 0.1 s
  });
});
