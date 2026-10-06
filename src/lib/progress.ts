// Weight progress maths: weekly averages, the ±200 cal suggestion rule,
// the target trajectory and projections. All pure functions.
//
// The suggestion rule (agreed plan):
//  • Compare WEEKLY AVERAGES (Mon–Sun), never single weigh-ins.
//  • A week's gain = its average minus the previous week's average.
//  • Only completed weeks count, and both weeks in a comparison need
//    at least 2 weigh-ins.
//  • The gain into week 2 (week 2 avg − week 1 avg) is ignored: early
//    water/food weight makes it misleading.
//  • After you accept a change, only weeks that start after that change
//    count, so the new target gets 2 full weeks to show.
//  • 2 counted weeks in a row under +0.15 kg → suggest +200 cal/day.
//    2 counted weeks in a row over +0.5 kg → suggest −200 cal/day.
//  • It only ever SUGGESTS. Targets change only when you accept.

import { addDays, differenceInCalendarDays } from 'date-fns';
import { fromDateStr, toDateStr, weekStartOf } from './dates';
import type { AdjustDirection, DismissedSuggestion, Macros, TargetChange, WeighIn } from './types';

export const MIN_WEIGH_INS_PER_WEEK = 3; // the habit to aim for
export const MIN_WEIGH_INS_FOR_RULE = 2; // needed for a week to count
export const SLOW_GAIN_KG = 0.15;
export const FAST_GAIN_KG = 0.5;
export const ADJUST_CALORIES = 200;
export const WEEKS_IN_A_ROW = 2;

export interface WeekStat {
  weekStart: string; // Monday
  count: number;
  average: number | null;
  /** This week's average minus last week's, if both have weigh-ins. */
  change: number | null;
  /** True once the week is over. */
  complete: boolean;
}

function average(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

/** One entry per calendar week, from the week you started to this week. */
export function weeklyStats(weighIns: WeighIn[], startDate: string, today: string): WeekStat[] {
  const first = weekStartOf(startDate);
  const current = weekStartOf(today);
  const stats: WeekStat[] = [];
  for (let ws = first; ws <= current; ws = toDateStr(addDays(fromDateStr(ws), 7))) {
    const end = toDateStr(addDays(fromDateStr(ws), 6));
    const inWeek = weighIns.filter((w) => w.date >= ws && w.date <= end);
    const avg = average(inWeek.map((w) => w.weightKg));
    const prev = stats.at(-1);
    stats.push({
      weekStart: ws,
      count: inWeek.length,
      average: avg,
      change: avg !== null && prev?.average != null ? avg - prev.average : null,
      complete: ws < current,
    });
  }
  return stats;
}

/** The Monday after the week containing `date`. */
function mondayAfter(date: string): string {
  return toDateStr(addDays(fromDateStr(weekStartOf(date)), 7));
}

export interface CalorieSuggestion {
  direction: AdjustDirection;
  deltaCalories: number;
  /** The weeks that triggered it, oldest first. */
  weeks: WeekStat[];
  /** Last completed week (used when dismissing). */
  weekStart: string;
}

export function calorieSuggestion(input: {
  weighIns: WeighIn[];
  startDate: string;
  today: string;
  targetChanges: TargetChange[];
  dismissed: DismissedSuggestion | null;
}): CalorieSuggestion | null {
  const stats = weeklyStats(input.weighIns, input.startDate, input.today);
  const lastChange = input.targetChanges.at(-1);
  const countFrom = lastChange ? mondayAfter(lastChange.date) : null;

  // Index 1 (the gain into week 2) is never counted, so start at 2.
  const counts = (i: number) =>
    i >= 2 &&
    stats[i].complete &&
    stats[i].change !== null &&
    stats[i].count >= MIN_WEIGH_INS_FOR_RULE &&
    stats[i - 1].count >= MIN_WEIGH_INS_FOR_RULE &&
    (countFrom === null || stats[i].weekStart >= countFrom);

  const lastComplete = stats.findLastIndex((s) => s.complete);
  if (lastComplete < 0) return null;
  const idx = Array.from({ length: WEEKS_IN_A_ROW }, (_, k) => lastComplete - (WEEKS_IN_A_ROW - 1) + k);
  if (!idx.every(counts)) return null;

  const weeks = idx.map((i) => stats[i]);
  let direction: AdjustDirection | null = null;
  if (weeks.every((w) => w.change! < SLOW_GAIN_KG)) direction = 'increase';
  else if (weeks.every((w) => w.change! > FAST_GAIN_KG)) direction = 'decrease';
  if (!direction) return null;

  const weekStart = stats[lastComplete].weekStart;
  if (input.dismissed && input.dismissed.weekStart === weekStart && input.dismissed.direction === direction) return null;

  return {
    direction,
    deltaCalories: direction === 'increase' ? ADJUST_CALORIES : -ADJUST_CALORIES,
    weeks,
    weekStart,
  };
}

/**
 * New targets after a calorie change. Protein stays the same; the change
 * is split between carbs and fat in the same ratio as their current
 * calories (4 cal/g carbs, 9 cal/g fat).
 */
export function adjustTargets(targets: Macros, deltaCalories: number): Macros {
  const carbCal = targets.carbs * 4;
  const fatCal = targets.fat * 9;
  const carbShare = carbCal / (carbCal + fatCal);
  return {
    calories: targets.calories + deltaCalories,
    protein: targets.protein,
    carbs: Math.round(targets.carbs + (deltaCalories * carbShare) / 4),
    fat: Math.round(targets.fat + (deltaCalories * (1 - carbShare)) / 9),
  };
}

// ----- Trajectory & projections ---------------------------------------

/** Where the plan says you'd be on a date (start + rate per week, capped at goal). */
export function targetWeightOn(
  date: string,
  plan: { startDate: string; startWeightKg: number; weeklyRateKg: number; goalWeightKg: number },
): number {
  const weeks = differenceInCalendarDays(fromDateStr(date), fromDateStr(plan.startDate)) / 7;
  return Math.min(plan.goalWeightKg, plan.startWeightKg + plan.weeklyRateKg * Math.max(0, weeks));
}

/** The date the plan reaches the goal weight. */
export function plannedFinishDate(plan: {
  startDate: string;
  startWeightKg: number;
  weeklyRateKg: number;
  goalWeightKg: number;
}): string {
  const weeks = Math.max(0, (plan.goalWeightKg - plan.startWeightKg) / plan.weeklyRateKg);
  return toDateStr(addDays(fromDateStr(plan.startDate), Math.round(weeks * 7)));
}

/** Most recent weekly average (this week's if you've weighed in, otherwise the latest one). */
export function currentWeight(stats: WeekStat[]): number | null {
  for (let i = stats.length - 1; i >= 0; i--) if (stats[i].average !== null) return stats[i].average;
  return null;
}

/**
 * Your actual rate in kg/week: the trend line (least squares) through all
 * weigh-ins. Needs weigh-ins spanning at least 14 days.
 */
export function actualWeeklyRate(weighIns: WeighIn[]): number | null {
  if (weighIns.length < 3) return null;
  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date));
  const origin = fromDateStr(sorted[0].date);
  const xs = sorted.map((w) => differenceInCalendarDays(fromDateStr(w.date), origin));
  if (xs.at(-1)! < 14) return null;
  const ys = sorted.map((w) => w.weightKg);
  const mx = average(xs)!;
  const my = average(ys)!;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    den += (x - mx) ** 2;
  });
  return den === 0 ? null : (num / den) * 7;
}

/** When you'd reach the goal at your actual rate, or null if not gaining. */
export function projectedFinishDate(current: number, goal: number, ratePerWeek: number, today: string): string | null {
  if (current >= goal) return today;
  if (ratePerWeek < 0.02) return null;
  return toDateStr(addDays(fromDateStr(today), Math.round(((goal - current) / ratePerWeek) * 7)));
}

/** 0–1 progress from start weight to goal weight. */
export function progressFraction(start: number, current: number, goal: number): number {
  if (goal === start) return 1;
  return Math.max(0, Math.min(1, (current - start) / (goal - start)));
}

/** Weigh-ins logged in the week containing `today`. */
export function weighInsThisWeek(weighIns: WeighIn[], today: string): number {
  const ws = weekStartOf(today);
  return weighIns.filter((w) => w.date >= ws && w.date <= today).length;
}
