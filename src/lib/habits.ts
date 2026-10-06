// Training: weekly counts and a friendly status line.

import { addDays } from 'date-fns';
import { fromDateStr, toDateStr } from './dates';
import type { TrainingSession } from './types';

function weekEnd(weekStart: string): string {
  return toDateStr(addDays(fromDateStr(weekStart), 6));
}

const inWeek = (date: string, weekStart: string) => date >= weekStart && date <= weekEnd(weekStart);

export function sessionsInWeek(training: TrainingSession[], weekStart: string): number {
  return training.filter((t) => inWeek(t.date, weekStart)).length;
}

export function trainingMessage(sessions: number, target: { min: number; max: number }): string {
  if (sessions === 0) return 'A fresh week. One session gets things rolling.';
  if (sessions < target.min) {
    const left = target.min - sessions;
    return `Good start! ${left} more ${left === 1 ? 'session' : 'sessions'} reaches ${target.min} this week.`;
  }
  if (sessions <= target.max) return 'Right on target this week. Great work!';
  return "You've trained a lot this week. Rest days help your muscles grow too.";
}

/** Sessions logged on a date. */
export function sessionsOn(training: TrainingSession[], date: string): TrainingSession[] {
  return training.filter((t) => t.date === date);
}
