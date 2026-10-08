import { describe, expect, it } from 'vitest';
import { addDays, format } from 'date-fns';
import { defaultPlan } from '../src/data/plan';
import { buildDayLog } from '../src/lib/daylog';
import {
  coachCheckIn,
  coachHistory,
  confidenceOf,
  ENERGY_PER_KG,
  MAX_CHANGE,
  MAX_ESTIMATE_STEP,
  windowStats,
} from '../src/lib/coach';
import type { DayLog, WeighIn } from '../src/lib/types';

const { rotation, meals, targets, goal } = defaultPlan;
const START = '2026-10-05'; // Monday
const day = (n: number) => format(addDays(new Date(2026, 9, 5), n), 'yyyy-MM-dd');

/** Deterministic pseudo-random numbers so the simulation is repeatable. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** A day where everything eaten is one extra of `calories` (meals left unticked). */
function loggedDay(date: string, calories: number, complete = true): DayLog {
  const log = buildDayLog(date, { rotation, meals, targets });
  return {
    ...log,
    complete,
    extras: [{ id: date, name: 'Food', serving: '', base: { calories, protein: 0, carbs: 0, fat: 0 }, multiplier: 1 }],
  };
}

/**
 * Simulates a person with a known maintenance who eats around `intake`,
 * gains/loses accordingly, logs ~6 of 7 days as complete and weighs in
 * 4 times a week with scale noise.
 */
function simulate(opts: { trueMaintenance: number; intake: number; days: number; seed?: number; completeEvery?: number }) {
  const rand = rng(opts.seed ?? 7);
  const dayLogs: Record<string, DayLog> = {};
  const weighIns: WeighIn[] = [];
  let weight = 55;
  for (let n = 0; n < opts.days; n++) {
    const date = day(n);
    if (n % 7 === 0 || n % 7 === 2 || n % 7 === 4 || n % 7 === 5) {
      weighIns.push({ id: date, date, weightKg: Math.round((weight + (rand() - 0.5) * 0.8) * 10) / 10 });
    }
    const eaten = opts.intake + (rand() - 0.5) * 400;
    const complete = n % (opts.completeEvery ?? 7) !== 6; // skip one day a week
    dayLogs[date] = loggedDay(date, Math.round(eaten), complete);
    weight += (eaten - opts.trueMaintenance) / ENERGY_PER_KG;
  }
  return { dayLogs, weighIns };
}

const base = { startDate: START, prior: goal.maintenanceCalories, goalRateKgPerWeek: goal.weeklyRateKg, dismissed: null };

describe('window stats', () => {
  it('averages only complete days and fits a weight trend', () => {
    const dayLogs = {
      [day(0)]: loggedDay(day(0), 2600),
      [day(1)]: loggedDay(day(1), 2800),
      [day(2)]: loggedDay(day(2), 1000, false), // not marked complete: ignored
    };
    const weighIns = [
      { id: 'a', date: day(0), weightKg: 55.0 },
      { id: 'b', date: day(7), weightKg: 55.3 },
      { id: 'c', date: day(14), weightKg: 55.6 },
    ];
    const s = windowStats(dayLogs, weighIns, day(20), START);
    expect(s.completeDays).toBe(2);
    expect(s.avgIntake).toBe(2700);
    expect(s.ratePerWeek).toBeCloseTo(0.3);
    expect(s.valid).toBe(false); // too few complete days and weigh-ins
  });

  it('never looks before the start date', () => {
    expect(windowStats({}, [], day(6), START).from).toBe(START);
    expect(windowStats({}, [], day(30), START).from).toBe(day(10));
  });
});

describe('maintenance estimate', () => {
  it('finds a higher-than-planned maintenance and moves towards it gently', () => {
    const { dayLogs, weighIns } = simulate({ trueMaintenance: 2650, intake: 2745, days: 70 });
    const history = coachHistory({ dayLogs, weighIns, startDate: START, today: day(70), prior: 2441 });
    expect(history).toHaveLength(10);
    // Never jumps more than the weekly cap.
    let prev = 2441;
    for (const w of history) {
      expect(Math.abs(w.estimate - prev)).toBeLessThanOrEqual(MAX_ESTIMATE_STEP + 1);
      prev = w.estimate;
    }
    // Ends up close to the truth.
    expect(Math.abs(history.at(-1)!.estimate - 2650)).toBeLessThan(120);
  });

  it('holds the estimate in weeks without enough data', () => {
    const { dayLogs, weighIns } = simulate({ trueMaintenance: 2650, intake: 2745, days: 35 });
    const sparse = weighIns.filter((w) => w.date <= day(2)); // stopped weighing in after day 2
    const history = coachHistory({ dayLogs, weighIns: sparse, startDate: START, today: day(35), prior: 2441 });
    expect(history.every((w) => w.estimate === 2441)).toBe(true);
  });

  it('calibrates for the first weeks, then becomes confident', () => {
    const { dayLogs, weighIns } = simulate({ trueMaintenance: 2500, intake: 2745, days: 56 });
    const early = coachHistory({ dayLogs, weighIns, startDate: START, today: day(14), prior: 2441 });
    expect(confidenceOf(early).level).toBe('calibrating');
    const later = coachHistory({ dayLogs, weighIns, startDate: START, today: day(56), prior: 2441 });
    expect(confidenceOf(later).level).not.toBe('calibrating');
  });
});

describe('weekly check-in', () => {
  it('says "calibrating" before it has enough weeks', () => {
    const { dayLogs, weighIns } = simulate({ trueMaintenance: 2500, intake: 2745, days: 14 });
    const c = coachCheckIn({ ...base, dayLogs, weighIns, today: day(14), currentTarget: 2745 })!;
    expect(c.status).toBe('calibrating');
    expect(c.suggestion).toBeNull();
  });

  it('says "on track" when you are gaining close to the goal rate', () => {
    // Maintenance 2,510 + ~236 surplus ≈ 2,745: right on target.
    const { dayLogs, weighIns } = simulate({ trueMaintenance: 2510, intake: 2745, days: 63 });
    const c = coachCheckIn({ ...base, dayLogs, weighIns, today: day(63), currentTarget: 2745 })!;
    expect(c.status).toBe('on-track');
    expect(c.suggestion).toBeNull();
  });

  it('suggests more food when gaining too slowly, capped at 250 cal', () => {
    const { dayLogs, weighIns } = simulate({ trueMaintenance: 2900, intake: 2745, days: 63 });
    const c = coachCheckIn({ ...base, dayLogs, weighIns, today: day(63), currentTarget: 2745 })!;
    expect(c.status).toBe('adjust');
    expect(c.suggestion?.direction).toBe('increase');
    expect(c.suggestion?.deltaCalories).toBeLessThanOrEqual(MAX_CHANGE);
    expect(c.suggestion?.newCalories).toBe(2745 + c.suggestion!.deltaCalories);
    expect(c.losingWeight).toBe(true);
  });

  it('suggests easing back when gaining too fast, but keeps a surplus', () => {
    const { dayLogs, weighIns } = simulate({ trueMaintenance: 2200, intake: 2745, days: 63 });
    const c = coachCheckIn({ ...base, dayLogs, weighIns, today: day(63), currentTarget: 2745 })!;
    expect(c.suggestion?.direction).toBe('decrease');
    expect(c.suggestion!.deltaCalories).toBeGreaterThanOrEqual(-MAX_CHANGE);
    expect(c.suggestion!.newCalories).toBeGreaterThanOrEqual(c.estimate + 100);
  });

  it('a dismissed check-in stays hidden for that week only', () => {
    const { dayLogs, weighIns } = simulate({ trueMaintenance: 2900, intake: 2745, days: 63 });
    const first = coachCheckIn({ ...base, dayLogs, weighIns, today: day(63), currentTarget: 2745 })!;
    const dismissed = { weekStart: first.weekStart, direction: first.suggestion!.direction };
    expect(coachCheckIn({ ...base, dayLogs, weighIns, today: day(63), currentTarget: 2745, dismissed })!.suggestion).toBeNull();
    expect(coachCheckIn({ ...base, dayLogs, weighIns, today: day(70), currentTarget: 2745, dismissed })!.suggestion).not.toBeNull();
  });

  it('makes only one suggestion per week: a change since the check-in pauses it', () => {
    const { dayLogs, weighIns } = simulate({ trueMaintenance: 2900, intake: 2745, days: 63 });
    const first = coachCheckIn({ ...base, dayLogs, weighIns, today: day(63), currentTarget: 2745 })!;
    const accepted = 2745 + first.suggestion!.deltaCalories;
    const change = { id: 'c', date: day(63), direction: 'increase' as const, deltaCalories: first.suggestion!.deltaCalories, from: targets, to: targets, source: 'coach' as const };
    const same = coachCheckIn({ ...base, dayLogs, weighIns, today: day(63), currentTarget: accepted, targetChanges: [change] })!;
    expect(same.status).toBe('updated');
    expect(same.suggestion).toBeNull();
    // Next week's check-in can suggest again.
    const next = coachCheckIn({ ...base, dayLogs, weighIns, today: day(70), currentTarget: accepted, targetChanges: [change] })!;
    expect(next.status).not.toBe('updated');
  });

  it('after accepting, the next week does not keep pushing the same way', () => {
    const { dayLogs, weighIns } = simulate({ trueMaintenance: 2900, intake: 2745, days: 63 });
    const c = coachCheckIn({ ...base, dayLogs, weighIns, today: day(63), currentTarget: 2745 })!;
    const accepted = coachCheckIn({ ...base, dayLogs, weighIns, today: day(63), currentTarget: c.idealTarget })!;
    expect(accepted.status).toBe('on-track');
  });
});
