import { useMemo } from 'react';
import { useAppStore } from './useAppStore';
import { todayStr } from '../lib/dates';
import { coachCheckIn } from '../lib/coach';
import { calorieSuggestion, weeklyStats } from '../lib/progress';

/**
 * Weekly stats, the maintenance coach's check-in, and the simple ±200 rule.
 * Once the coach is confident it takes over, so the ±200 rule only applies
 * while the coach is still calibrating.
 */
export function useProgress(today: string = todayStr()) {
  const weighIns = useAppStore((s) => s.weighIns);
  const profile = useAppStore((s) => s.profile);
  const targetChanges = useAppStore((s) => s.targetChanges);
  const dismissed = useAppStore((s) => s.dismissedSuggestion);
  const dayLogs = useAppStore((s) => s.dayLogs);
  const targets = useAppStore((s) => s.targets);
  const goal = useAppStore((s) => s.goal);
  const startDate = profile.startDate ?? today;

  return useMemo(() => {
    const coach = coachCheckIn({
      dayLogs,
      weighIns,
      startDate,
      today,
      prior: goal.maintenanceCalories,
      currentTarget: targets.calories,
      goalRateKgPerWeek: goal.weeklyRateKg,
      dismissed,
      targetChanges,
    });
    const coachInCharge = coach !== null && coach.confidence !== 'calibrating';
    return {
      stats: weeklyStats(weighIns, startDate, today),
      coach,
      suggestion: coachInCharge ? null : calorieSuggestion({ weighIns, startDate, today, targetChanges, dismissed }),
    };
  }, [weighIns, startDate, today, targetChanges, dismissed, dayLogs, targets.calories, goal.maintenanceCalories, goal.weeklyRateKg]);
}
