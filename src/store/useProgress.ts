import { useMemo } from 'react';
import { useAppStore } from './useAppStore';
import { todayStr } from '../lib/dates';
import { calorieSuggestion, weeklyStats } from '../lib/progress';

/** Weekly stats and the current calorie suggestion (if any), worked out from saved data. */
export function useProgress(today: string = todayStr()) {
  const weighIns = useAppStore((s) => s.weighIns);
  const profile = useAppStore((s) => s.profile);
  const targetChanges = useAppStore((s) => s.targetChanges);
  const dismissed = useAppStore((s) => s.dismissedSuggestion);
  const startDate = profile.startDate ?? today;

  return useMemo(
    () => ({
      stats: weeklyStats(weighIns, startDate, today),
      suggestion: calorieSuggestion({ weighIns, startDate, today, targetChanges, dismissed }),
    }),
    [weighIns, startDate, today, targetChanges, dismissed],
  );
}
