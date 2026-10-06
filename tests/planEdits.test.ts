import { describe, expect, it } from 'vitest';
import { defaultPlan } from '../src/data/plan';
import { buildDayLog, setSlotStatus, swapSlotMeal } from '../src/lib/daylog';
import {
  mealIdFor,
  mergeDefaultMeals,
  refreshMealInLogs,
  repairRotation,
  replaceMealInLogs,
  replaceMealInRotation,
  setRotationSlot,
  syncLogsWithRotation,
  usesOfMeal,
} from '../src/lib/planEdits';
import { plannedDayTotals, plannedWeekTotals } from '../src/lib/totals';
import type { DayLog, Meal } from '../src/lib/types';

const { meals, rotation, targets } = defaultPlan;
const meal = (id: string) => meals.find((m) => m.id === id)!;
const SAT = '2026-10-03'; // past
const MON = '2026-10-05'; // "today"
const log = (date: string) => buildDayLog(date, { rotation, meals, targets });

describe('editing the rotation', () => {
  it('recalculates daily totals and the weekly average', () => {
    // Fri: chickpea pasta salad (27 g) → chana cheese wrap (28 g)
    const next = setRotationSlot(rotation, 'fri', 'lunch', 'chana-cheese-wrap');
    expect(plannedDayTotals(next, meals, 'fri')).toEqual({ calories: 2755, protein: 116, carbs: 383, fat: 88 });
    expect(plannedWeekTotals(next, meals).average.calories).toBeCloseTo((19220 - 665 + 610) / 7, 6);
    expect(rotation.fri.lunch).toBe('chickpea-pasta-salad'); // original untouched
  });

  it('can push a day below the protein target', () => {
    const next = setRotationSlot(rotation, 'fri', 'afterSchool', 'cottage-cheese-toast');
    expect(plannedDayTotals(next, meals, 'fri').protein).toBe(112);
  });

  it('finds every use of a meal', () => {
    expect(usesOfMeal(rotation, 'tofu-stir-fry')).toEqual([
      { day: 'mon', slot: 'dinner' },
      { day: 'thu', slot: 'dinner' },
    ]);
  });

  it('replaces a meal everywhere', () => {
    const next = replaceMealInRotation(rotation, 'tofu-stir-fry', 'burrito-bowl');
    expect(usesOfMeal(next, 'tofu-stir-fry')).toEqual([]);
    expect(next.mon.dinner).toBe('burrito-bowl');
    expect(next.thu.dinner).toBe('burrito-bowl');
  });

  it('repairs entries that point at deleted meals', () => {
    const fewer = meals.filter((m) => m.id !== 'banana-oat-smoothie');
    const fixed = repairRotation(rotation, fewer);
    expect(fixed.mon.breakfast).toBe('overnight-oats');
    expect(fixed.tue.breakfast).toBe('overnight-oats');
  });
});

describe('keeping logs in step with plan edits', () => {
  it('updates untouched planned slots from today onwards only', () => {
    const logs: Record<string, DayLog> = { [SAT]: log(SAT), [MON]: log(MON) };
    const next = setRotationSlot(setRotationSlot(rotation, 'mon', 'dinner', 'burrito-bowl'), 'sat', 'dinner', 'tofu-stir-fry');
    const synced = syncLogsWithRotation(logs, MON, next, meals);
    expect(synced[MON].slots.dinner.meal?.mealId).toBe('burrito-bowl');
    expect(synced[MON].slots.dinner.plannedMealId).toBe('burrito-bowl');
    expect(synced[SAT]).toBe(logs[SAT]); // past day untouched
  });

  it('keeps a swap but remembers the new planned meal', () => {
    const logs = { [MON]: swapSlotMeal(log(MON), 'dinner', meal('gujarati-thali')) };
    const next = setRotationSlot(rotation, 'mon', 'dinner', 'burrito-bowl');
    const synced = syncLogsWithRotation(logs, MON, next, meals);
    expect(synced[MON].slots.dinner.meal?.mealId).toBe('gujarati-thali');
    expect(synced[MON].slots.dinner.plannedMealId).toBe('burrito-bowl');
  });

  it('leaves an eaten meal alone', () => {
    const logs = { [MON]: setSlotStatus(log(MON), 'dinner', 'eaten', meals) };
    const next = setRotationSlot(rotation, 'mon', 'dinner', 'burrito-bowl');
    expect(syncLogsWithRotation(logs, MON, next, meals)[MON]).toBe(logs[MON]);
  });

  it('refreshes edited meal copies from today onwards', () => {
    const edited: Meal = { ...meal('tofu-stir-fry'), calories: 900, protein: 35 };
    const logs = { [SAT]: swapSlotMeal(log(SAT), 'dinner', meal('tofu-stir-fry')), [MON]: log(MON) };
    const next = refreshMealInLogs(logs, MON, edited);
    expect(next[MON].slots.dinner.meal?.calories).toBe(900);
    expect(next[SAT].slots.dinner.meal?.calories).toBe(885);
  });

  it('swaps a deleted meal for the replacement unless already eaten', () => {
    const eatenLunch = setSlotStatus(log(MON), 'lunch', 'eaten', meals);
    const next = replaceMealInLogs({ [MON]: eatenLunch }, MON, 'tofu-stir-fry', meal('burrito-bowl'));
    expect(next[MON].slots.dinner.meal?.mealId).toBe('burrito-bowl');
    expect(next[MON].slots.lunch.meal?.mealId).toBe('bean-cheese-burrito');
  });
});

describe('new meal ids', () => {
  it('slugifies the name and avoids clashes', () => {
    expect(mealIdFor('Paneer Tikka Wrap!', meals)).toBe('paneer-tikka-wrap');
    expect(mealIdFor('Overnight oats', meals)).toMatch(/^overnight-oats-[a-z0-9]{1,4}$/);
    expect(mealIdFor('???', meals)).toBe('meal');
  });
});

describe('restoring default meals', () => {
  it('brings back deleted and edited defaults, and keeps your own meals', () => {
    const mine: Meal = { id: 'paneer-wrap', slot: 'dinner', name: 'Paneer wrap', ingredients: '', calories: 800, protein: 33, carbs: 70, fat: 40 };
    const current = meals
      .filter((m) => m.id !== 'tofu-stir-fry')
      .map((m) => (m.id === 'burrito-bowl' ? { ...m, calories: 1 } : m))
      .concat(mine);
    const restored = mergeDefaultMeals(current, meals);
    expect(restored.find((m) => m.id === 'tofu-stir-fry')).toBeDefined();
    expect(restored.find((m) => m.id === 'burrito-bowl')?.calories).toBe(895);
    expect(restored.at(-1)).toEqual(mine);
    expect(restored).toHaveLength(meals.length + 1);
  });
});
