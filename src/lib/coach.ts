// The maintenance coach: estimates the calories you actually burn from what
// you log and how your weight changes, then suggests a calorie target for
// your goal rate. Plain maths, no AI. Inspired by adaptive-expenditure
// apps like MacroFactor.
//
// Each finished week (Mon–Sun) is a "check-in":
//  1. Look back over the last 21 days.
//  2. Average intake = mean calories on days you marked "logged everything".
//  3. Weight rate   = straight-line trend through your weigh-ins (kg/week).
//  4. Measured maintenance = average intake − (energy stored by the weight change).
//  5. The estimate moves halfway towards that measurement, by at most 150 cal
//     a week, starting from your plan's maintenance. It "holds" in weeks
//     without enough data.
//  6. Ideal target = estimate + the surplus needed for your goal rate.
//     Suggest a change only if it's at least 100 cal and at most 250 cal per
//     week; when easing back, never below maintenance + 100 (a bulk always
//     keeps a surplus).
// Nothing changes unless you accept.

import { addDays, differenceInCalendarDays } from 'date-fns';
import { fromDateStr, toDateStr, weekStartOf } from './dates';
import { eatenTotals } from './daylog';
import type { AdjustDirection, DayLog, DismissedSuggestion, TargetChange, WeighIn } from './types';

/**
 * Calories stored per kg gained. Pure fat is ~7,700–9,500; muscle (mostly
 * water) ~1,000–1,800. A training teen's bulk is a mix, so ~6,000. At slow
 * gain rates the exact value changes targets by well under 100 cal.
 */
export const ENERGY_PER_KG = 6000;
export const WINDOW_DAYS = 21;
export const MIN_COMPLETE_DAYS = 10;
export const MIN_WEIGH_INS = 4;
export const MIN_WEIGH_SPAN_DAYS = 10;
export const SMOOTHING = 0.5;
export const MAX_ESTIMATE_STEP = 150;
export const MIN_CHANGE = 100;
export const MAX_CHANGE = 250;
export const WEEKS_TO_CALIBRATE = 3;

const round10 = (n: number) => Math.round(n / 10) * 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export interface WindowStats {
  from: string;
  to: string;
  completeDays: number;
  avgIntake: number | null;
  weighIns: number;
  /** Trend rate in kg/week, from a least-squares line through the weigh-ins. */
  ratePerWeek: number | null;
  valid: boolean;
}

/** Least-squares slope (per day) of weights against dates. */
function slopePerDay(points: { date: string; weightKg: number }[], origin: string): number | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => differenceInCalendarDays(fromDateStr(p.date), fromDateStr(origin)));
  const ys = points.map((p) => p.weightKg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    den += (x - mx) ** 2;
  });
  return den === 0 ? null : num / den;
}

/** Intake and weight trend over the 21 days ending on `to` (never before the start date). */
export function windowStats(dayLogs: Record<string, DayLog>, weighIns: WeighIn[], to: string, startDate: string): WindowStats {
  const earliest = toDateStr(addDays(fromDateStr(to), -(WINDOW_DAYS - 1)));
  const from = earliest > startDate ? earliest : startDate;

  const complete = Object.values(dayLogs).filter((l) => l.complete && l.date >= from && l.date <= to);
  const avgIntake = complete.length ? complete.reduce((n, l) => n + eatenTotals(l).calories, 0) / complete.length : null;

  const points = weighIns.filter((w) => w.date >= from && w.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  const slope = slopePerDay(points, from);
  const span = points.length ? differenceInCalendarDays(fromDateStr(points.at(-1)!.date), fromDateStr(points[0].date)) : 0;

  return {
    from,
    to,
    completeDays: complete.length,
    avgIntake,
    weighIns: points.length,
    ratePerWeek: slope === null ? null : slope * 7,
    valid: complete.length >= MIN_COMPLETE_DAYS && points.length >= MIN_WEIGH_INS && span >= MIN_WEIGH_SPAN_DAYS && slope !== null,
  };
}

export interface CoachWeek {
  /** Monday of the finished week this check-in belongs to. */
  weekStart: string;
  /** Maintenance estimate after this week (cal/day). */
  estimate: number;
  /** What this week's data alone measured, if there was enough. */
  measured: number | null;
  stats: WindowStats;
}

/** Replays every finished week since the start date, so the estimate is always reproducible from your data. */
export function coachHistory(input: {
  dayLogs: Record<string, DayLog>;
  weighIns: WeighIn[];
  startDate: string;
  today: string;
  prior: number;
}): CoachWeek[] {
  const weeks: CoachWeek[] = [];
  const thisWeek = weekStartOf(input.today);
  let estimate = input.prior;
  for (let ws = weekStartOf(input.startDate); ws < thisWeek; ws = toDateStr(addDays(fromDateStr(ws), 7))) {
    const to = toDateStr(addDays(fromDateStr(ws), 6));
    const stats = windowStats(input.dayLogs, input.weighIns, to, input.startDate);
    let measured: number | null = null;
    if (stats.valid) {
      measured = stats.avgIntake! - (stats.ratePerWeek! / 7) * ENERGY_PER_KG;
      estimate += clamp(SMOOTHING * (measured - estimate), -MAX_ESTIMATE_STEP, MAX_ESTIMATE_STEP);
    }
    weeks.push({ weekStart: ws, estimate: Math.round(estimate), measured: measured === null ? null : Math.round(measured), stats });
  }
  return weeks;
}

export type Confidence = 'calibrating' | 'good' | 'high';

export function confidenceOf(history: CoachWeek[]): { level: Confidence; validWeeks: number } {
  const validWeeks = history.filter((w) => w.stats.valid).length;
  const last = history.at(-1);
  if (!last || validWeeks < WEEKS_TO_CALIBRATE || !last.stats.valid) return { level: 'calibrating', validWeeks };
  if (validWeeks >= 5 && last.stats.completeDays >= 15 && last.stats.weighIns >= 6) return { level: 'high', validWeeks };
  return { level: 'good', validWeeks };
}

export interface CoachCheckIn {
  weekStart: string;
  estimate: number;
  confidence: Confidence;
  validWeeks: number;
  stats: WindowStats;
  idealTarget: number;
  currentTarget: number;
  /** 'updated' = your target already changed since this check-in, so it waits for next week. */
  status: 'calibrating' | 'on-track' | 'adjust' | 'updated';
  /** Present when status is 'adjust' and it hasn't been dismissed this week. */
  suggestion: { direction: AdjustDirection; deltaCalories: number; newCalories: number } | null;
  /** The weight trend is going down (worth a gentle heads-up on a bulk). */
  losingWeight: boolean;
  history: CoachWeek[];
}

export function coachCheckIn(input: {
  dayLogs: Record<string, DayLog>;
  weighIns: WeighIn[];
  startDate: string;
  today: string;
  prior: number;
  currentTarget: number;
  goalRateKgPerWeek: number;
  dismissed: DismissedSuggestion | null;
  /** Past target changes: one suggestion per week, so a change since this check-in pauses it. */
  targetChanges?: TargetChange[];
}): CoachCheckIn | null {
  const history = coachHistory(input);
  const last = history.at(-1);
  if (!last) return null;
  const { level, validWeeks } = confidenceOf(history);
  const surplus = (input.goalRateKgPerWeek / 7) * ENERGY_PER_KG;
  const idealTarget = round10(last.estimate + surplus);

  let status: CoachCheckIn['status'] = 'calibrating';
  let suggestion: CoachCheckIn['suggestion'] = null;
  const checkInDate = toDateStr(addDays(fromDateStr(last.weekStart), 7));
  const changedSince = (input.targetChanges ?? []).some((c) => c.date >= checkInDate);
  if (level !== 'calibrating' && changedSince) {
    status = 'updated';
  } else if (level !== 'calibrating') {
    let delta = clamp(idealTarget - input.currentTarget, -MAX_CHANGE, MAX_CHANGE);
    // When easing back, never go below maintenance + 100: a bulk always keeps a surplus.
    if (delta < 0) delta = Math.max(delta, Math.ceil((last.estimate + MIN_CHANGE - input.currentTarget) / 10) * 10);
    const newCalories = input.currentTarget + delta;
    if (Math.abs(delta) < MIN_CHANGE) {
      status = 'on-track';
    } else {
      status = 'adjust';
      const direction: AdjustDirection = delta > 0 ? 'increase' : 'decrease';
      const dismissed = input.dismissed?.weekStart === last.weekStart && input.dismissed.direction === direction;
      if (!dismissed) suggestion = { direction, deltaCalories: delta, newCalories };
    }
  }

  return {
    weekStart: last.weekStart,
    estimate: last.estimate,
    confidence: level,
    validWeeks,
    stats: last.stats,
    idealTarget,
    currentTarget: input.currentTarget,
    status,
    suggestion,
    losingWeight: last.stats.valid && last.stats.ratePerWeek! < -0.05,
    history,
  };
}
