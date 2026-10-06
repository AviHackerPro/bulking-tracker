import { describe, expect, it } from 'vitest';
import { defaultPlan } from '../src/data/plan';
import {
  caloriesFromMacros,
  mealsForSlot,
  plannedDayTotals,
  plannedWeekTotals,
  remainingMacros,
  roundMacros,
  scaleMacros,
  SLOT_ORDER,
  sumMacros,
} from '../src/lib/totals';
import { WEEKDAYS } from '../src/lib/dates';
import type { Macros, Weekday } from '../src/lib/types';

const { rotation, meals, targets, foods } = defaultPlan;

// Expected daily totals from the plan brief (section 5).
const EXPECTED_DAYS: Record<Weekday, Macros> = {
  mon: { calories: 2710, protein: 118, carbs: 359, fat: 90 },
  tue: { calories: 2700, protein: 120, carbs: 366, fat: 83 },
  wed: { calories: 2800, protein: 123, carbs: 367, fat: 95 },
  thu: { calories: 2780, protein: 119, carbs: 369, fat: 93 },
  fri: { calories: 2810, protein: 115, carbs: 395, fat: 88 },
  sat: { calories: 2690, protein: 124, carbs: 358, fat: 83 },
  sun: { calories: 2730, protein: 120, carbs: 361, fat: 93 },
};
const EXPECTED_AVERAGE: Macros = { calories: 2746, protein: 120, carbs: 368, fat: 89 };

describe('default rotation daily totals', () => {
  it.each(WEEKDAYS)('%s matches the expected totals', (day) => {
    expect(plannedDayTotals(rotation, meals, day)).toEqual(EXPECTED_DAYS[day]);
  });

  it('weekly average matches (rounded)', () => {
    const { average } = plannedWeekTotals(rotation, meals);
    expect(roundMacros(average)).toEqual(EXPECTED_AVERAGE);
  });

  it('weekly average is calculated, not rounded early', () => {
    const { average } = plannedWeekTotals(rotation, meals);
    expect(average.calories).toBeCloseTo(19220 / 7, 6);
  });

  it('only Friday sits right at the 115 g protein target, and no day is below it', () => {
    const { days } = plannedWeekTotals(rotation, meals);
    expect(WEEKDAYS.filter((d) => days[d].protein < targets.protein)).toEqual([]);
    expect(days.fri.protein).toBe(115);
  });
});

describe('plan data integrity', () => {
  it('every rotation entry points to an existing meal in the right slot', () => {
    for (const day of WEEKDAYS) {
      for (const slot of SLOT_ORDER) {
        const meal = meals.find((m) => m.id === rotation[day][slot]);
        expect(meal, `${day}.${slot}`).toBeDefined();
        expect(meal!.slot).toBe(slot);
      }
    }
  });

  it('meal and food ids are unique', () => {
    expect(new Set(meals.map((m) => m.id)).size).toBe(meals.length);
    expect(new Set(foods.map((f) => f.id)).size).toBe(foods.length);
  });

  it('has the expected number of options per slot', () => {
    expect(mealsForSlot(meals, 'breakfast')).toHaveLength(4);
    expect(mealsForSlot(meals, 'recess')).toHaveLength(2);
    expect(mealsForSlot(meals, 'lunch')).toHaveLength(3);
    expect(mealsForSlot(meals, 'afterSchool')).toHaveLength(2);
    expect(mealsForSlot(meals, 'dinner')).toHaveLength(3);
  });

  it('whey is the only food flagged as whey', () => {
    expect(foods.filter((f) => f.isWhey).map((f) => f.id)).toEqual(['whey']);
  });

  it('macro targets add up to 2,747 cal (vs the 2,745 calorie target)', () => {
    expect(caloriesFromMacros(targets)).toBe(2747);
    expect(targets.calories).toBe(2745);
  });

  it('stored meal calories are used as-is, not recalculated from macros', () => {
    const smoothie = meals.find((m) => m.id === 'banana-oat-smoothie')!;
    expect(caloriesFromMacros(smoothie)).not.toBe(590); // 22*4 + 74*4 + 22*9 = 582
    expect(plannedDayTotals(rotation, meals, 'mon').calories).toBe(2710);
  });
});

describe('macro helpers', () => {
  const milk = foods.find((f) => f.id === 'milk')!;

  it('scales a serving', () => {
    expect(scaleMacros(milk, 1.5)).toEqual({ calories: 252, protein: 12.75, carbs: 18, fat: 12.75 });
    expect(scaleMacros(milk, 0.5).calories).toBe(84);
  });

  it('sums a list of foods into plain macros', () => {
    expect(sumMacros([milk, milk])).toEqual({ calories: 336, protein: 17, carbs: 24, fat: 17 });
  });

  it('works out what is left to go (negative = over)', () => {
    const eaten = { calories: 2800, protein: 95, carbs: 300, fat: 91 };
    expect(remainingMacros(targets, eaten)).toEqual({ calories: -55, protein: 20, carbs: 67, fat: 0 });
  });
});
