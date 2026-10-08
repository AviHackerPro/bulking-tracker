// Pure functions for a single day's log: building it from the plan,
// changing it (tick / swap / skip / extras) and working out totals.
// Every function returns a new object; nothing is changed in place.

import { defaultDayType, weekdayOf } from './dates';
import { findMeal, scaleMacros, SLOT_ORDER, sumMacros } from './totals';
import type { DayLog, DayType, ExtraLog, Macros, Meal, MealSnapshot, Rotation, SlotId, SlotStatus } from './types';

export function snapshotMeal(meal: Meal): MealSnapshot {
  return {
    mealId: meal.id,
    name: meal.name,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
  };
}

/** A fresh, untouched log for a date, following the weekly rotation. */
export function buildDayLog(
  date: string,
  data: { rotation: Rotation; meals: Meal[]; targets: Macros },
): DayLog {
  const day = weekdayOf(date);
  const slots = {} as DayLog['slots'];
  for (const slot of SLOT_ORDER) {
    const plannedMealId = data.rotation[day][slot];
    const meal = findMeal(data.meals, plannedMealId);
    slots[slot] = { plannedMealId, meal: meal && snapshotMeal(meal), status: 'planned' };
  }
  return { date, dayType: defaultDayType(day), targets: { ...data.targets }, slots, extras: [] };
}

// ----- Changes -------------------------------------------------------

export function setSlotStatus(log: DayLog, slot: SlotId, status: SlotStatus, meals: Meal[]): DayLog {
  const current = log.slots[slot];
  // Refresh the snapshot when ticking, so "eaten" records the meal as it is now.
  const live = current.meal && findMeal(meals, current.meal.mealId);
  const meal = status === 'eaten' && live ? snapshotMeal(live) : current.meal;
  return { ...log, slots: { ...log.slots, [slot]: { ...current, meal, status } } };
}

/** Put a different meal in a slot (for this day only). A skipped slot goes back to planned. */
export function swapSlotMeal(log: DayLog, slot: SlotId, meal: Meal): DayLog {
  const current = log.slots[slot];
  const status = current.status === 'skipped' ? 'planned' : current.status;
  return { ...log, slots: { ...log.slots, [slot]: { ...current, meal: snapshotMeal(meal), status } } };
}

export function setDayType(log: DayLog, dayType: DayType): DayLog {
  return { ...log, dayType };
}

export function setComplete(log: DayLog, complete: boolean): DayLog {
  return { ...log, complete };
}

export function addExtra(log: DayLog, extra: ExtraLog): DayLog {
  return { ...log, extras: [...log.extras, extra] };
}

export function removeExtra(log: DayLog, id: string): DayLog {
  return { ...log, extras: log.extras.filter((e) => e.id !== id) };
}

// ----- Reading -------------------------------------------------------

export function isSwapped(log: DayLog, slot: SlotId): boolean {
  const s = log.slots[slot];
  return !!s.meal && s.meal.mealId !== s.plannedMealId;
}

export function extraMacros(extra: ExtraLog): Macros {
  return scaleMacros(extra.base, extra.multiplier);
}

/** What's been eaten: ticked meals plus all extras. */
export function eatenTotals(log: DayLog): Macros {
  const meals = SLOT_ORDER.map((s) => log.slots[s])
    .filter((s) => s.status === 'eaten' && s.meal)
    .map((s) => s.meal!);
  return sumMacros([...meals, ...log.extras.map(extraMacros)]);
}

/** Meals not yet ticked or skipped. */
export function stillPlannedTotals(log: DayLog): Macros {
  return sumMacros(
    SLOT_ORDER.map((s) => log.slots[s])
      .filter((s) => s.status === 'planned' && s.meal)
      .map((s) => s.meal!),
  );
}

/** Where the day ends up if the remaining planned meals are eaten. */
export function projectedTotals(log: DayLog): Macros {
  return sumMacros([eatenTotals(log), stillPlannedTotals(log)]);
}

export function slotCounts(log: DayLog): Record<SlotStatus, number> {
  const counts: Record<SlotStatus, number> = { planned: 0, eaten: 0, skipped: 0 };
  for (const s of SLOT_ORDER) if (log.slots[s].meal) counts[log.slots[s].status]++;
  return counts;
}

/** True if anything has been ticked, skipped, swapped, added, or the day type changed. */
export function hasActivity(log: DayLog): boolean {
  return (
    !!log.complete ||
    log.extras.length > 0 ||
    SLOT_ORDER.some((s) => log.slots[s].status !== 'planned' || isSwapped(log, s)) ||
    log.dayType !== defaultDayType(weekdayOf(log.date))
  );
}
