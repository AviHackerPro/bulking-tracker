// Friendly status messages and protein suggestions for the Today screen.
// Tone rule: always positive, never shaming.

import { eatenTotals, projectedTotals, slotCounts } from './daylog';
import type { DayLog, Food, Macros, SlotConfig } from './types';

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

/** Minutes since midnight for "HH:mm". */
function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function isAtOrPast(now: Date, hhmm: string): boolean {
  return now.getHours() * 60 + now.getMinutes() >= minutes(hhmm);
}

/**
 * How much protein the day will be short, if we should suggest extras.
 * Only for today, once it's past the after-school slot (or every meal is
 * ticked/skipped), and only if eaten + still-planned meals fall short.
 * Returns 0 when no suggestion is needed.
 */
export function proteinGapToSuggest(log: DayLog, slots: SlotConfig[], now: Date, isToday: boolean): number {
  if (!isToday) return 0;
  const afterSchool = slots.find((s) => s.id === 'afterSchool');
  const time = afterSchool ? (log.dayType === 'school' ? afterSchool.schoolTime : afterSchool.homeTime) : '15:00';
  const allDone = slotCounts(log).planned === 0;
  if (!isAtOrPast(now, time) && !allDone) return 0;
  const gap = log.targets.protein - projectedTotals(log).protein;
  return gap >= 1 ? gap : 0;
}

export interface ProteinSuggestion {
  food: Food;
  multiplier: number;
  protein: number;
}

/**
 * Best high-protein foods to close a gap, ranked by protein per calorie.
 * Each comes with a serving multiplier (0.5× steps, up to 2×) that covers
 * the gap where possible.
 */
export function proteinSuggestions(foods: Food[], gap: number, wheyEnabled: boolean, limit = 3): ProteinSuggestion[] {
  return foods
    .filter((f) => (f.category === 'protein' || f.category === 'extra') && f.protein > 0)
    .filter((f) => wheyEnabled || !f.isWhey)
    .sort((a, b) => b.protein / b.calories - a.protein / a.calories)
    .slice(0, limit)
    .map((food) => {
      const multiplier = Math.min(2, Math.max(0.5, Math.ceil((gap / food.protein) * 2) / 2));
      return { food, multiplier, protein: food.protein * multiplier };
    });
}
