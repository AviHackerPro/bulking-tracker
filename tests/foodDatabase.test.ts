import { describe, expect, it } from 'vitest';
import afcd from '../src/data/afcd.json';
import { fromRows, searchFoods, type DbFood } from '../src/lib/foodDatabase';
import { macrosForGrams } from '../src/lib/openFoodFacts';

const foods: DbFood[] = fromRows((afcd as unknown as { foods: Parameters<typeof fromRows>[0] }).foods);
const names = (list: { name: string }[]) => list.map((f) => f.name);

describe('food database (AFCD)', () => {
  it('has around a thousand foods with sensible numbers', () => {
    expect(foods.length).toBeGreaterThan(900);
    expect(new Set(foods.map((f) => f.id)).size).toBe(foods.length);
    for (const f of foods) {
      expect(f.id).toMatch(/^afcd:F\d+$/);
      for (const n of [f.calories, f.protein, f.carbs, f.fat]) {
        expect(Number.isFinite(n) && n >= 0, f.name).toBe(true);
      }
      expect(['g', 'ml']).toContain(f.unit);
    }
  });

  it('only has lacto-vegetarian foods', () => {
    const nonVeg = /\b(beef|chicken|pork|lamb|ham|bacon|fish|prawns?|tuna|salmon|eggs?|gelatine?|sausage)\b/i;
    const offenders = foods.filter((f) => nonVeg.test(f.name) && !/^(Meat alternative|Sausage, vegetarian)/.test(f.name));
    expect(names(offenders)).toEqual([]);
  });

  it('measures drinks in mL and solids in grams', () => {
    expect(foods.find((f) => f.name.startsWith('Milk, cow, fluid, regular fat'))?.unit).toBe('ml');
    expect(foods.find((f) => f.name.startsWith('Yoghurt, natural'))?.unit).toBe('g');
    expect(foods.find((f) => f.name === 'Chickpea, canned, drained')?.unit).toBe('g');
  });

  it('credits the source', () => {
    expect(afcd.source).toMatch(/Food Standards Australia New Zealand.*CC BY 4\.0/);
  });
});

describe('searchFoods', () => {
  it('matches words in any order, ignoring plurals', () => {
    expect(names(searchFoods(foods, 'chickpeas canned'))[0]).toBe('Chickpea, canned, drained');
    expect(names(searchFoods(foods, 'canned chickpea'))[0]).toBe('Chickpea, canned, drained');
  });

  it('puts names that start with the first word first', () => {
    const top = searchFoods(foods, 'milk', 5);
    expect(top.every((f) => f.name.toLowerCase().startsWith('milk'))).toBe(true);
  });

  it('matches the start of words only', () => {
    expect(names(searchFoods(foods, 'weet')).some((n) => /sweet/i.test(n) && !/\bweet/i.test(n))).toBe(false);
  });

  it('returns nothing for an empty search, and respects the limit', () => {
    expect(searchFoods(foods, '   ')).toEqual([]);
    expect(searchFoods(foods, 'a', 7)).toHaveLength(7);
  });

  it('works on saved foods too', () => {
    const saved = [{ name: 'Chobani Greek Yoghurt' }, { name: 'Mainland Tasty Cheese' }];
    expect(names(searchFoods(saved, 'greek'))).toEqual(['Chobani Greek Yoghurt']);
  });
});

describe('amounts', () => {
  it('scales per-100 values to the amount eaten', () => {
    const chickpea = foods.find((f) => f.name === 'Chickpea, canned, drained')!;
    const m = macrosForGrams(chickpea, 150);
    expect(m.calories).toBe(Math.round(chickpea.calories * 1.5));
    expect(Math.abs(m.protein - chickpea.protein * 1.5)).toBeLessThanOrEqual(0.05 + 1e-9); // rounded to 0.1 g
  });
});
