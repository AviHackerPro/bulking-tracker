import { describe, expect, it } from 'vitest';
import { defaultPlan } from '../src/data/plan';
import { addExtra, buildDayLog, setSlotStatus, swapSlotMeal } from '../src/lib/daylog';
import { sessionsInWeek, sessionsOn, trainingMessage } from '../src/lib/habits';
import { loggedDays, summariseDay, summariseWeek } from '../src/lib/history';
import { SLOT_ORDER } from '../src/lib/totals';
import type { DayLog, TrainingSession } from '../src/lib/types';

const { meals, rotation, targets, foods, goal } = defaultPlan;
const build = (date: string) => buildDayLog(date, { rotation, meals, targets });
const WEEK = '2026-10-05';

function allEatenMonday(): DayLog {
  let log = build('2026-10-05');
  for (const s of SLOT_ORDER) log = setSlotStatus(log, s, 'eaten', meals);
  return log;
}

function partialTuesday(): DayLog {
  const milk = foods.find((f) => f.id === 'milk')!;
  let log = build('2026-10-06');
  log = setSlotStatus(log, 'breakfast', 'eaten', meals); // overnight oats 565/29/71/16
  log = setSlotStatus(log, 'recess', 'eaten', meals); // cheese sandwich 450/16/59/17
  log = setSlotStatus(log, 'lunch', 'skipped', meals);
  log = swapSlotMeal(log, 'dinner', meals.find((m) => m.id === 'burrito-bowl')!);
  log = addExtra(log, { id: 'm', name: milk.name, serving: milk.serving, base: milk, multiplier: 1, foodId: milk.id });
  return log;
}

const dayLogs: Record<string, DayLog> = {
  '2026-10-05': allEatenMonday(),
  '2026-10-06': partialTuesday(),
  '2026-10-07': build('2026-10-07'), // opened but nothing logged
};

const training: TrainingSession[] = [
  { id: 'a', date: '2026-10-05', notes: 'Squat 40 kg 3×8' },
  { id: 'b', date: '2026-10-07', notes: '' },
  { id: 'c', date: '2026-10-12', notes: '' }, // next week
];


describe('daily history', () => {
  it('lists only days with something logged, newest first', () => {
    expect(loggedDays(dayLogs).map((d) => d.date)).toEqual(['2026-10-06', '2026-10-05']);
  });

  it('summarises a full day', () => {
    expect(summariseDay(dayLogs['2026-10-05'])).toEqual({
      eaten: { calories: 2710, protein: 118, carbs: 359, fat: 90 },
      mealsEaten: 5, mealsSkipped: 0, mealsPlanned: 5, swaps: 0, extras: 0, proteinHit: true,
    });
  });

  it('summarises a partial day with a skip, a swap and an extra', () => {
    expect(summariseDay(dayLogs['2026-10-06'])).toEqual({
      eaten: { calories: 1183, protein: 53.5, carbs: 142, fat: 41.5 },
      mealsEaten: 2, mealsSkipped: 1, mealsPlanned: 5, swaps: 1, extras: 1, proteinHit: false,
    });
  });
});

describe('weekly summary', () => {
  const summary = summariseWeek({
    weekStart: WEEK,
    today: '2026-10-07',
    dayLogs,
    weightWeek: { weekStart: WEEK, count: 3, average: 55.4, change: 0.3, complete: false },
    training,
  });

  it('averages food over logged days only', () => {
    expect(summary.loggedDays).toBe(2);
    expect(summary.averageEaten).toEqual({ calories: 1946.5, protein: 85.75, carbs: 250.5, fat: 65.75 });
    expect(summary.averageTargets).toEqual(targets);
  });

  it('works out adherence and protein days', () => {
    expect(summary.mealsEaten).toBe(7);
    expect(summary.mealsPlanned).toBe(10);
    expect(summary.adherencePct).toBe(70);
    expect(summary.proteinDays).toBe(1);
  });

  it('includes weight and training', () => {
    expect(summary.weightAverage).toBe(55.4);
    expect(summary.weightChange).toBe(0.3);
    expect(summary.trainingSessions).toBe(2);
  });

  it('knows whether the week is still going', () => {
    expect(summary.current).toBe(true);
    expect(summariseWeek({ weekStart: WEEK, today: '2026-10-12', dayLogs, training }).current).toBe(false);
  });

  it('handles an empty week', () => {
    const empty = summariseWeek({ weekStart: '2026-09-28', today: '2026-10-07', dayLogs, training: [] });
    expect(empty).toMatchObject({ loggedDays: 0, averageEaten: null, adherencePct: null, weightChange: null, trainingSessions: 0 });
  });
});

describe('training', () => {
  it('counts sessions by week and by day', () => {
    expect(sessionsInWeek(training, WEEK)).toBe(2);
    expect(sessionsInWeek(training, '2026-10-12')).toBe(1);
    expect(sessionsOn(training, '2026-10-05').map((t) => t.id)).toEqual(['a']);
    expect(sessionsOn(training, '2026-10-06')).toEqual([]);
  });

  it('training messages stay positive', () => {
    const t = goal.trainingSessionsPerWeek;
    expect(trainingMessage(0, t)).toMatch(/fresh week/);
    expect(trainingMessage(1, t)).toBe('Good start! 2 more sessions reaches 3 this week.');
    expect(trainingMessage(2, t)).toBe('Good start! 1 more session reaches 3 this week.');
    expect(trainingMessage(4, t)).toMatch(/on target/);
    expect(trainingMessage(5, t)).toMatch(/Rest days/);
  });
});
