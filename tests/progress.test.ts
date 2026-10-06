import { describe, expect, it } from 'vitest';
import { defaultPlan } from '../src/data/plan';
import {
  actualWeeklyRate,
  adjustTargets,
  calorieSuggestion,
  currentWeight,
  plannedFinishDate,
  progressFraction,
  projectedFinishDate,
  targetWeightOn,
  weeklyStats,
  weighInsThisWeek,
} from '../src/lib/progress';
import { addDays, format } from 'date-fns';
import type { TargetChange, WeighIn } from '../src/lib/types';

const START = '2026-10-05'; // Monday, week 1
const day = (offset: number) => format(addDays(new Date(2026, 9, 5), offset), 'yyyy-MM-dd');
const WEEK = (n: number) => day(n * 7); // Monday of week n (0-based)

/** 3 weigh-ins per week (Mon/Wed/Fri) averaging the given values. */
function weeks(avgs: number[], perWeek = 3): WeighIn[] {
  const offsets = [0, 2, 4].slice(0, perWeek);
  const wiggle = perWeek === 3 ? [-0.1, 0, 0.1] : perWeek === 2 ? [-0.1, 0.1] : [0];
  return avgs.flatMap((avg, w) =>
    offsets.map((o, i) => ({ id: `${w}-${i}`, date: day(w * 7 + o), weightKg: avg + wiggle[i] })),
  );
}

const suggest = (weighIns: WeighIn[], today: string, targetChanges: TargetChange[] = [], dismissed = null) =>
  calorieSuggestion({ weighIns, startDate: START, today, targetChanges, dismissed });

describe('weekly stats', () => {
  it('averages each Mon–Sun week and works out the change', () => {
    const stats = weeklyStats(weeks([55, 55.4, 55.6]), START, WEEK(3));
    expect(stats.map((s) => s.weekStart)).toEqual([WEEK(0), WEEK(1), WEEK(2), WEEK(3)]);
    expect(stats[0].average).toBeCloseTo(55);
    expect(stats[0].change).toBeNull();
    expect(stats[1].change).toBeCloseTo(0.4);
    expect(stats[2].change).toBeCloseTo(0.2);
    expect(stats.map((s) => s.complete)).toEqual([true, true, true, false]);
    expect(stats[3]).toMatchObject({ count: 0, average: null, change: null });
  });

  it('starts from the week containing the start date (mid-week start)', () => {
    const stats = weeklyStats([], '2026-10-08', '2026-10-13');
    expect(stats.map((s) => s.weekStart)).toEqual(['2026-10-05', '2026-10-12']);
  });

  it('counts this week’s weigh-ins for the reminder', () => {
    expect(weighInsThisWeek(weeks([55, 55.2]), day(9))).toBe(2); // Wed of week 2: Mon + Wed
  });
});

describe('calorie suggestion rule', () => {
  it('suggests +200 after 2 weeks in a row under 0.15 kg', () => {
    const data = weeks([55, 55.6, 55.7, 55.8]); // gains: .6 (ignored), .1, .1
    const s = suggest(data, WEEK(4));
    expect(s?.direction).toBe('increase');
    expect(s?.deltaCalories).toBe(200);
    expect(s?.weeks.map((w) => w.weekStart)).toEqual([WEEK(2), WEEK(3)]);
    expect(s?.weekStart).toBe(WEEK(3));
  });

  it('suggests −200 after 2 weeks in a row over 0.5 kg', () => {
    const s = suggest(weeks([55, 55.3, 55.9, 56.5]), WEEK(4));
    expect(s?.direction).toBe('decrease');
    expect(s?.deltaCalories).toBe(-200);
  });

  it('stays quiet when gaining on track', () => {
    expect(suggest(weeks([55, 55.3, 55.6, 55.9]), WEEK(4))).toBeNull();
  });

  it('needs both weeks to agree', () => {
    expect(suggest(weeks([55, 55.3, 55.4, 55.8]), WEEK(4))).toBeNull(); // .1 then .4
    expect(suggest(weeks([55, 55.3, 55.9, 56.2]), WEEK(4))).toBeNull(); // .6 then .3
  });

  it('ignores the gain into week 2', () => {
    const data = weeks([55, 55.05, 55.1, 55.15]);
    expect(suggest(data, WEEK(3))).toBeNull(); // only weeks 2 (ignored) and 3 counted so far
    expect(suggest(data, WEEK(4))?.direction).toBe('increase');
  });

  it('only uses completed weeks', () => {
    const data = weeks([55, 55.3, 55.4, 55.45]);
    expect(suggest(data, day(3 * 7 + 6))).toBeNull(); // Sunday of week 4: not over yet
    expect(suggest(data, WEEK(4))?.direction).toBe('increase');
  });

  it('needs at least 2 weigh-ins in each week compared', () => {
    const data = weeks([55, 55.3, 55.4, 55.5]).filter((w) => !(w.date >= WEEK(2) && w.date < WEEK(3) && w.date !== WEEK(2)));
    expect(weeklyStats(data, START, WEEK(4))[2].count).toBe(1);
    expect(suggest(data, WEEK(4))).toBeNull();
    expect(suggest(weeks([55, 55.3, 55.4, 55.5], 2), WEEK(4))?.direction).toBe('increase');
  });

  it('waits for 2 full weeks after an accepted change', () => {
    const data = weeks([55, 55.3, 55.4, 55.5, 55.6, 55.7]);
    const change: TargetChange = {
      id: 'c1', date: day(3 * 7 + 2), direction: 'increase', deltaCalories: 200,
      from: defaultPlan.targets, to: adjustTargets(defaultPlan.targets, 200),
    };
    expect(suggest(data, WEEK(4), [change])).toBeNull(); // week 4 had the change
    expect(suggest(data, WEEK(5), [change])).toBeNull(); // only 1 week since
    expect(suggest(data, WEEK(6), [change])?.weeks.map((w) => w.weekStart)).toEqual([WEEK(4), WEEK(5)]);
  });

  it('a dismissed suggestion comes back after the next week ends', () => {
    const data = weeks([55, 55.3, 55.4, 55.5, 55.6]);
    const dismissed = { weekStart: WEEK(3), direction: 'increase' as const };
    expect(calorieSuggestion({ weighIns: data, startDate: START, today: WEEK(4), targetChanges: [], dismissed })).toBeNull();
    expect(calorieSuggestion({ weighIns: data, startDate: START, today: WEEK(5), targetChanges: [], dismissed })?.direction).toBe('increase');
  });
});

describe('adjusting targets', () => {
  it('+200 keeps protein and splits by the carb:fat ratio', () => {
    expect(adjustTargets(defaultPlan.targets, 200)).toEqual({ calories: 2945, protein: 115, carbs: 399, fat: 99 });
  });

  it('−200 works the same way', () => {
    expect(adjustTargets(defaultPlan.targets, -200)).toEqual({ calories: 2545, protein: 115, carbs: 335, fat: 83 });
  });
});

describe('trajectory and projections', () => {
  const plan = { startDate: START, startWeightKg: 55, weeklyRateKg: 0.275, goalWeightKg: 65 };

  it('target line rises 0.275 kg/week and stops at the goal', () => {
    expect(targetWeightOn(START, plan)).toBe(55);
    expect(targetWeightOn(WEEK(4), plan)).toBeCloseTo(56.1);
    expect(targetWeightOn(WEEK(60), plan)).toBe(65);
  });

  it('plan finishes in about 36 weeks', () => {
    expect(plannedFinishDate(plan)).toBe(day(255)); // 36.36 weeks ≈ 255 days
  });

  it('actual rate is the trend through all weigh-ins', () => {
    expect(actualWeeklyRate(weeks([55, 55.3, 55.6, 55.9]))).toBeCloseTo(0.3, 1);
    expect(actualWeeklyRate(weeks([55, 55.3]))).toBeNull(); // under 14 days of data
  });

  it('projects the finish date from the actual rate', () => {
    expect(projectedFinishDate(56, 65, 0.3, WEEK(4))).toBe(day(28 + 210)); // 30 weeks
    expect(projectedFinishDate(56, 65, 0, WEEK(4))).toBeNull();
    expect(projectedFinishDate(65.2, 65, 0.3, WEEK(4))).toBe(WEEK(4));
  });

  it('progress and current weight', () => {
    expect(progressFraction(55, 57.5, 65)).toBeCloseTo(0.25);
    expect(progressFraction(55, 54, 65)).toBe(0);
    const stats = weeklyStats(weeks([55, 55.4]), START, WEEK(2)); // this week empty
    expect(currentWeight(stats)).toBeCloseTo(55.4);
  });
});
