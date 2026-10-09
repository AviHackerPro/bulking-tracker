// Friendly status messages for the Today screen.
// Tone rule: always positive, never shaming.

import { eatenTotals, slotCounts } from './daylog';
import type { DayLog, Macros } from './types';

export type MacroKey = keyof Macros;

const UNIT: Record<MacroKey, string> = { calories: ' cal', protein: ' g', carbs: ' g', fat: ' g' };
const LABEL: Record<MacroKey, string> = { calories: 'Calories', protein: 'Protein', carbs: 'Carbs', fat: 'Fat' };

export interface MacroStatus {
  text: string;
  done: boolean;
}

/** "Protein: 20 g to go" or "Protein: target reached". */
export function macroStatus(key: MacroKey, target: number, eaten: number): MacroStatus {
  const toGo = Math.round(target - eaten);
  if (toGo > 0) return { text: `${LABEL[key]}: ${toGo.toLocaleString('en-AU')}${UNIT[key]} to go`, done: false };
  return { text: `${LABEL[key]}: target reached`, done: true };
}

/** One encouraging line summarising the day so far. */
export function dayHeadline(log: DayLog, isToday: boolean): string {
  const eaten = eatenTotals(log);
  const counts = slotCounts(log);
  const total = counts.planned + counts.eaten + counts.skipped;
  const proteinHit = eaten.protein >= log.targets.protein;
  const caloriesHit = eaten.calories >= log.targets.calories;

  if (proteinHit && caloriesHit) return 'Calories and protein both hit. Brilliant work!';
  if (proteinHit) return 'Protein target hit. Nice one!';
  if (counts.eaten === 0 && log.extras.length === 0) {
    return isToday ? "Here's your plan for today. Tick meals off as you eat them." : 'Nothing logged for this day yet.';
  }
  if (counts.planned === 0) return 'All meals logged for the day. Nice work keeping track!';
  return `${counts.eaten} of ${total} meals done. Keep it going!`;
}
