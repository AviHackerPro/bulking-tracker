// Daily history and weekly summaries, worked out from the saved logs.

import { addDays } from 'date-fns';
import { datesOfWeek, fromDateStr, toDateStr } from './dates';
import { eatenTotals, hasActivity, isSwapped } from './daylog';
import { sessionsInWeek } from './habits';
import { averageMacros, SLOT_ORDER } from './totals';
import type { WeekStat } from './progress';
import type { DayLog, Macros, TrainingSession } from './types';

/** Days you actually logged something on, newest first. */
export function loggedDays(dayLogs: Record<string, DayLog>): DayLog[] {
  return Object.values(dayLogs)
    .filter(hasActivity)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export interface DaySummary {
  eaten: Macros;
  mealsEaten: number;
  mealsSkipped: number;
  mealsPlanned: number; // slots that had a meal
  swaps: number;
  extras: number;
  proteinHit: boolean;
}

export function summariseDay(log: DayLog): DaySummary {
  const slots = SLOT_ORDER.map((s) => log.slots[s]).filter((s) => s.meal);
  const eaten = eatenTotals(log);
  return {
    eaten,
    mealsEaten: slots.filter((s) => s.status === 'eaten').length,
    mealsSkipped: slots.filter((s) => s.status === 'skipped').length,
    mealsPlanned: slots.length,
    swaps: SLOT_ORDER.filter((s) => isSwapped(log, s)).length,
    extras: log.extras.length,
    proteinHit: eaten.protein >= log.targets.protein,
  };
}

export interface WeekSummary {
  weekStart: string;
  /** True for the week that's still going. */
  current: boolean;
  loggedDays: number;
  /** Average eaten per logged day. */
  averageEaten: Macros | null;
  /** Average of the targets that applied on those days. */
  averageTargets: Macros | null;
  mealsEaten: number;
  mealsPlanned: number;
  /** Meals eaten ÷ meals planned on logged days, 0–100. */
  adherencePct: number | null;
  proteinDays: number;
  weightAverage: number | null;
  weightChange: number | null;
  trainingSessions: number;
}

export function summariseWeek(input: {
  weekStart: string;
  today: string;
  dayLogs: Record<string, DayLog>;
  weightWeek?: WeekStat;
  training: TrainingSession[];
}): WeekSummary {
  const days = datesOfWeek(input.weekStart)
    .map((d) => input.dayLogs[d])
    .filter((log): log is DayLog => !!log && hasActivity(log));
  const summaries = days.map(summariseDay);
  const mealsEaten = summaries.reduce((n, s) => n + s.mealsEaten, 0);
  const mealsPlanned = summaries.reduce((n, s) => n + s.mealsPlanned, 0);
  const weekEnd = toDateStr(addDays(fromDateStr(input.weekStart), 6));

  return {
    weekStart: input.weekStart,
    current: input.today <= weekEnd,
    loggedDays: days.length,
    averageEaten: days.length ? averageMacros(summaries.map((s) => s.eaten)) : null,
    averageTargets: days.length ? averageMacros(days.map((d) => d.targets)) : null,
    mealsEaten,
    mealsPlanned,
    adherencePct: mealsPlanned ? Math.round((mealsEaten / mealsPlanned) * 100) : null,
    proteinDays: summaries.filter((s) => s.proteinHit).length,
    weightAverage: input.weightWeek?.average ?? null,
    weightChange: input.weightWeek?.change ?? null,
    trainingSessions: sessionsInWeek(input.training, input.weekStart),
  };
}
