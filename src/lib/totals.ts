// All calorie and macro maths lives here as small pure functions,
// so it can be tested without the UI. Totals are always calculated
// from the data — never hardcoded.

import type { Macros, Meal, Rotation, SlotConfig, SlotId, Weekday } from './types';
import { WEEKDAYS } from './dates';

export const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

export const SLOT_ORDER: SlotId[] = ['breakfast', 'recess', 'lunch', 'afterSchool', 'dinner'];

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

/** Multiply a serving, e.g. 1.5× a food. */
export function scaleMacros(m: Macros, factor: number): Macros {
  return {
    calories: m.calories * factor,
    protein: m.protein * factor,
    carbs: m.carbs * factor,
    fat: m.fat * factor,
  };
}

export function sumMacros(items: Macros[]): Macros {
  // Strip any extra fields (name, id, …) so the result is just macros.
  return items.reduce<Macros>(addMacros, { ...ZERO });
}

export function averageMacros(items: Macros[]): Macros {
  if (items.length === 0) return { ...ZERO };
  return scaleMacros(sumMacros(items), 1 / items.length);
}

/** Target minus eaten. Negative means over target. */
export function remainingMacros(target: Macros, eaten: Macros): Macros {
  return addMacros(target, scaleMacros(eaten, -1));
}

/**
 * Calories implied by macros (4 cal/g protein & carbs, 9 cal/g fat).
 * Only used for targets. Meal calories are stored as given and never
 * recalculated with this.
 */
export function caloriesFromMacros(m: Pick<Macros, 'protein' | 'carbs' | 'fat'>): number {
  return m.protein * 4 + m.carbs * 4 + m.fat * 9;
}

/** Round each value for display (calories to whole numbers, grams to 0 dp by default). */
export function roundMacros(m: Macros, gramDecimals = 0): Macros {
  const f = 10 ** gramDecimals;
  return {
    calories: Math.round(m.calories),
    protein: Math.round(m.protein * f) / f,
    carbs: Math.round(m.carbs * f) / f,
    fat: Math.round(m.fat * f) / f,
  };
}

/** Look up a meal by id. Returns undefined if it was deleted. */
export function findMeal(meals: Meal[], id: string): Meal | undefined {
  return meals.find((m) => m.id === id);
}

/** The planned meal for each slot on a weekday, in slot order. Missing meals are skipped. */
export function plannedMealsForDay(rotation: Rotation, meals: Meal[], day: Weekday): Meal[] {
  const dayPlan = rotation[day];
  return SLOT_ORDER.map((slot) => findMeal(meals, dayPlan[slot])).filter(
    (m): m is Meal => m !== undefined,
  );
}

/** Total of the planned rotation for one weekday. */
export function plannedDayTotals(rotation: Rotation, meals: Meal[], day: Weekday): Macros {
  return sumMacros(plannedMealsForDay(rotation, meals, day));
}

export interface WeekPlanTotals {
  days: Record<Weekday, Macros>;
  average: Macros;
}

/** Daily totals for the whole rotation plus the weekly average. */
export function plannedWeekTotals(rotation: Rotation, meals: Meal[]): WeekPlanTotals {
  const days = {} as Record<Weekday, Macros>;
  for (const day of WEEKDAYS) days[day] = plannedDayTotals(rotation, meals, day);
  return { days, average: averageMacros(WEEKDAYS.map((d) => days[d])) };
}

/** Meals that are valid choices for a slot (for swap dropdowns, the rotation editor). */
export function mealsForSlot(meals: Meal[], slot: SlotId): Meal[] {
  return meals.filter((m) => m.slot === slot);
}

/** Slots sorted in the standard order. */
export function orderedSlots(slots: SlotConfig[]): SlotConfig[] {
  return [...slots].sort((a, b) => SLOT_ORDER.indexOf(a.id) - SLOT_ORDER.indexOf(b.id));
}
