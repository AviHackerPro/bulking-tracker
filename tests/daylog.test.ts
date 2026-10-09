import { describe, expect, it } from 'vitest';
import { defaultPlan } from '../src/data/plan';
import {
  addExtra,
  buildDayLog,
  eatenTotals,
  hasActivity,
  isSwapped,
  projectedTotals,
  removeExtra,
  setDayType,
  setSlotStatus,
  slotCounts,
  swapSlotMeal,
} from '../src/lib/daylog';
import { dayHeadline, macroStatus } from '../src/lib/suggestions';
import { plannedDayTotals } from '../src/lib/totals';
import type { DayLog, ExtraLog, Meal } from '../src/lib/types';

const { meals, rotation, targets } = defaultPlan;
const MONDAY = '2026-10-05';
const meal = (id: string) => meals.find((m) => m.id === id)!;
const milk = { id: 'milk', name: 'Full-cream milk', serving: '250 ml', calories: 168, protein: 8.5, carbs: 12, fat: 8.5 };

function milkExtra(multiplier: number): ExtraLog {
  return { id: 'x1', name: milk.name, serving: milk.serving, base: milk, multiplier, foodId: milk.id };
}

/** Monday: breakfast + recess eaten, lunch skipped, dinner swapped to thali, 1.5× milk extra. */
function busyMonday(): DayLog {
  let log = buildDayLog(MONDAY, { rotation, meals, targets });
  log = setSlotStatus(log, 'breakfast', 'eaten', meals);
  log = setSlotStatus(log, 'recess', 'eaten', meals);
  log = setSlotStatus(log, 'lunch', 'skipped', meals);
  log = swapSlotMeal(log, 'dinner', meal('gujarati-thali'));
  log = addExtra(log, milkExtra(1.5));
  return log;
}

describe('building a day log', () => {
  it('follows the rotation for that weekday', () => {
    const log = buildDayLog(MONDAY, { rotation, meals, targets });
    expect(log.slots.breakfast.meal?.name).toBe('Banana oat smoothie');
    expect(log.slots.dinner.meal?.mealId).toBe('tofu-stir-fry');
    expect(log.dayType).toBe('school');
    expect(buildDayLog('2026-10-10', { rotation, meals, targets }).dayType).toBe('home');
  });

  it('projected totals of an untouched day equal the planned day totals', () => {
    const log = buildDayLog(MONDAY, { rotation, meals, targets });
    expect(projectedTotals(log)).toEqual(plannedDayTotals(rotation, meals, 'mon'));
    expect(eatenTotals(log)).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    expect(hasActivity(log)).toBe(false);
  });

  it('snapshots the targets for the day', () => {
    const log = buildDayLog(MONDAY, { rotation, meals, targets });
    expect(log.targets).toEqual(targets);
    expect(log.targets).not.toBe(targets);
  });
});

describe('ticking, skipping, swapping and extras', () => {
  it('counts only eaten meals plus extras as eaten', () => {
    // 590 + 395 + milk 1.5× (252 / 12.75 / 18 / 12.75)
    expect(eatenTotals(busyMonday())).toEqual({ calories: 1237, protein: 49.75, carbs: 144, fat: 49.75 });
  });

  it('projects the day using the swapped meal and ignores skipped ones', () => {
    // eaten + after-school yoghurt (255/21/35/5) + swapped thali (850/29/140/21)
    expect(projectedTotals(busyMonday())).toEqual({ calories: 2342, protein: 99.75, carbs: 319, fat: 75.75 });
  });

  it('tracks swaps and counts', () => {
    const log = busyMonday();
    expect(isSwapped(log, 'dinner')).toBe(true);
    expect(isSwapped(log, 'breakfast')).toBe(false);
    expect(slotCounts(log)).toEqual({ planned: 2, eaten: 2, skipped: 1 });
    expect(hasActivity(log)).toBe(true);
  });

  it('swapping back to the planned meal is no longer a swap', () => {
    const log = swapSlotMeal(busyMonday(), 'dinner', meal('tofu-stir-fry'));
    expect(isSwapped(log, 'dinner')).toBe(false);
  });

  it('swapping a skipped slot brings it back to planned', () => {
    const log = swapSlotMeal(busyMonday(), 'lunch', meal('chana-cheese-wrap'));
    expect(log.slots.lunch.status).toBe('planned');
    expect(log.slots.lunch.meal?.name).toBe('Chana cheese wrap');
  });

  it('un-ticking a meal removes it from eaten', () => {
    const log = setSlotStatus(busyMonday(), 'recess', 'planned', meals);
    expect(eatenTotals(log).calories).toBe(1237 - 395);
  });

  it('removes extras', () => {
    expect(eatenTotals(removeExtra(busyMonday(), 'x1')).calories).toBe(985);
  });

  it('records the meal as it is when ticked', () => {
    const edited: Meal[] = meals.map((m) => (m.id === 'banana-oat-smoothie' ? { ...m, calories: 600 } : m));
    const log = setSlotStatus(buildDayLog(MONDAY, { rotation, meals, targets }), 'breakfast', 'eaten', edited);
    expect(eatenTotals(log).calories).toBe(600);
  });

  it('changing to a home day counts as activity', () => {
    const log = setDayType(buildDayLog(MONDAY, { rotation, meals, targets }), 'home');
    expect(hasActivity(log)).toBe(true);
  });
});

describe('status messages', () => {
  it('shows what is left to go', () => {
    expect(macroStatus('protein', 115, 95).text).toBe('Protein: 20 g to go');
    expect(macroStatus('calories', 2745, 1710).text).toBe('Calories: 1,035 cal to go');
  });

  it('celebrates reaching a target (including going over)', () => {
    expect(macroStatus('calories', 2745, 2800)).toEqual({ text: 'Calories: target reached', done: true });
    expect(macroStatus('protein', 115, 114.6).done).toBe(true); // rounds to 0 to go
  });

  it('headline is encouraging', () => {
    const fresh = buildDayLog(MONDAY, { rotation, meals, targets });
    expect(dayHeadline(fresh, true)).toMatch(/plan for today/);
    expect(dayHeadline(busyMonday(), true)).toBe('2 of 5 meals done. Keep it going!');
  });
});
