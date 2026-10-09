// Searchable food database: the Australian Food Composition Database
// (AFCD Release 3, Food Standards Australia New Zealand, CC BY 4.0).
//
// The data is built into the app (src/data/afcd.json, ~20 KB zipped) and
// loaded on first use, so search is instant and works offline. It's limited
// to lacto-vegetarian foods. Values are per 100 g, or per 100 mL for drinks.
// To rebuild it from a new AFCD release, see "Food database" in the README.

import type { Macros } from './types';

export interface DbFood extends Macros {
  /** "afcd:F002880" */
  id: string;
  name: string;
  /** What the macros are per 100 of. */
  unit: 'g' | 'ml';
}

type Row = [key: string, name: string, calories: number, protein: number, carbs: number, fat: number, unit: 'g' | 'ml'];

export const FOOD_DATABASE_CREDIT = 'Australian Food Composition Database, Food Standards Australia New Zealand (CC BY 4.0)';

let cache: Promise<DbFood[]> | null = null;

/** Loads the database once; later calls reuse it. */
export function loadFoodDatabase(): Promise<DbFood[]> {
  cache ??= import('../data/afcd.json')
    .then((m) => fromRows((m.default as unknown as { foods: Row[] }).foods))
    .catch((err) => {
      cache = null; // let the next attempt retry
      throw err;
    });
  return cache;
}

export function fromRows(rows: Row[]): DbFood[] {
  return rows.map(([key, name, calories, protein, carbs, fat, unit]) => ({ id: `afcd:${key}`, name, calories, protein, carbs, fat, unit }));
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** Search terms with simple plurals trimmed ("chickpeas" → "chickpea", "oats" → "oat"). */
function terms(query: string): string[] {
  return words(query).map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
}

/**
 * Foods where every search word starts a word in the name. Best matches
 * first: the name begins with the first search word, then the earlier the
 * match, then the shorter (simpler) name.
 */
export function searchFoods<T extends { name: string }>(foods: T[], query: string, limit = 40): T[] {
  const q = terms(query);
  if (q.length === 0) return [];
  const scored: { food: T; score: number }[] = [];
  for (const food of foods) {
    const w = words(food.name);
    let first = -1;
    let ok = true;
    for (const [i, term] of q.entries()) {
      const at = w.findIndex((word) => word.startsWith(term));
      if (at === -1) {
        ok = false;
        break;
      }
      if (i === 0) first = at;
    }
    if (ok) scored.push({ food, score: first * 1000 + food.name.length });
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.food);
}
