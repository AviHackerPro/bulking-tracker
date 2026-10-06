// Pure functions for editing the plan (rotation and meal library), and
// for keeping today's (and later) day logs in step with those edits.
//
// Rule: edits apply to today onwards. Past days keep exactly what was
// logged, so history never changes.

import { snapshotMeal } from './daylog';
import { WEEKDAYS, weekdayOf } from './dates';
import { findMeal, SLOT_ORDER } from './totals';
import type { DayLog, Meal, Rotation, SlotId, Weekday } from './types';

export function setRotationSlot(rotation: Rotation, day: Weekday, slot: SlotId, mealId: string): Rotation {
  return { ...rotation, [day]: { ...rotation[day], [slot]: mealId } };
}

/** Every place in the rotation a meal is used. */
export function usesOfMeal(rotation: Rotation, mealId: string): { day: Weekday; slot: SlotId }[] {
  return WEEKDAYS.flatMap((day) =>
    SLOT_ORDER.filter((slot) => rotation[day][slot] === mealId).map((slot) => ({ day, slot })),
  );
}

export function replaceMealInRotation(rotation: Rotation, oldId: string, newId: string): Rotation {
  const next = {} as Rotation;
  for (const day of WEEKDAYS) {
    next[day] = { ...rotation[day] };
    for (const slot of SLOT_ORDER) if (next[day][slot] === oldId) next[day][slot] = newId;
  }
  return next;
}

/** Apply a change to every log dated fromDate or later. */
function mapLogsFrom(
  logs: Record<string, DayLog>,
  fromDate: string,
  change: (log: DayLog) => DayLog,
): Record<string, DayLog> {
  const next: Record<string, DayLog> = {};
  for (const [date, log] of Object.entries(logs)) next[date] = date >= fromDate ? change(log) : log;
  return next;
}

/**
 * Bring logs (fromDate onwards) in line with the rotation:
 * - an untouched planned slot follows the new planned meal;
 * - a swapped slot keeps its swap, but remembers the new planned meal;
 * - an eaten or skipped slot that wasn't swapped is left alone.
 */
export function syncLogsWithRotation(
  logs: Record<string, DayLog>,
  fromDate: string,
  rotation: Rotation,
  meals: Meal[],
): Record<string, DayLog> {
  return mapLogsFrom(logs, fromDate, (log) => {
    const day = weekdayOf(log.date);
    let changed = false;
    const slots = { ...log.slots };
    for (const slot of SLOT_ORDER) {
      const entry = slots[slot];
      const plannedMealId = rotation[day][slot];
      if (entry.plannedMealId === plannedMealId) continue;
      const swapped = !!entry.meal && entry.meal.mealId !== entry.plannedMealId;
      if (swapped) {
        slots[slot] = { ...entry, plannedMealId };
      } else if (entry.status === 'planned') {
        const meal = findMeal(meals, plannedMealId);
        slots[slot] = { ...entry, plannedMealId, meal: meal && snapshotMeal(meal) };
      } else {
        continue;
      }
      changed = true;
    }
    return changed ? { ...log, slots } : log;
  });
}

/** After a meal is edited, update its copies in logs from fromDate onwards. */
export function refreshMealInLogs(logs: Record<string, DayLog>, fromDate: string, meal: Meal): Record<string, DayLog> {
  return mapLogsFrom(logs, fromDate, (log) => {
    const hits = SLOT_ORDER.filter((s) => log.slots[s].meal?.mealId === meal.id);
    if (hits.length === 0) return log;
    const slots = { ...log.slots };
    for (const s of hits) slots[s] = { ...slots[s], meal: snapshotMeal(meal) };
    return { ...log, slots };
  });
}

/** After a meal is deleted, put the replacement into any not-yet-eaten slots that held it. */
export function replaceMealInLogs(
  logs: Record<string, DayLog>,
  fromDate: string,
  oldId: string,
  replacement: Meal,
): Record<string, DayLog> {
  return mapLogsFrom(logs, fromDate, (log) => {
    const hits = SLOT_ORDER.filter((s) => log.slots[s].meal?.mealId === oldId && log.slots[s].status !== 'eaten');
    if (hits.length === 0) return log;
    const slots = { ...log.slots };
    for (const s of hits) slots[s] = { ...slots[s], meal: snapshotMeal(replacement) };
    return { ...log, slots };
  });
}

/** A readable, unique id for a new meal, e.g. "paneer-wrap-k3x9". */
export function mealIdFor(name: string, existing: Meal[]): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'meal';
  let id = slug;
  while (existing.some((m) => m.id === id)) id = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  return id;
}

/** Point any rotation entries at missing meals to the first meal for that slot. */
export function repairRotation(rotation: Rotation, meals: Meal[]): Rotation {
  const next = {} as Rotation;
  for (const day of WEEKDAYS) {
    next[day] = { ...rotation[day] };
    for (const slot of SLOT_ORDER) {
      if (!findMeal(meals, next[day][slot])) {
        const fallback = meals.find((m) => m.slot === slot);
        if (fallback) next[day][slot] = fallback.id;
      }
    }
  }
  return next;
}

/**
 * Bring back the default meals: every default meal is restored to its
 * original values, and meals you added yourself are kept.
 */
export function mergeDefaultMeals(current: Meal[], defaults: Meal[]): Meal[] {
  const defaultIds = new Set(defaults.map((m) => m.id));
  return [...defaults.map((m) => ({ ...m })), ...current.filter((m) => !defaultIds.has(m.id))];
}
