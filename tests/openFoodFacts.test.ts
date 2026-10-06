import { describe, expect, it } from 'vitest';
import { displayName, isValidBarcode, macrosForGrams, parseProduct, productUrl } from '../src/lib/openFoodFacts';

// Trimmed real-world shape of an Open Food Facts v2 response.
const yoghurt = {
  status: 1,
  product: {
    product_name: 'Greek Yogurt Plain',
    brands: 'Chobani,Chobani Australia',
    serving_size: '170 g',
    serving_quantity: '170',
    nutriments: {
      'energy-kcal_100g': 71,
      proteins_100g: 9.4,
      carbohydrates_100g: 3.8,
      fat_100g: 2,
    },
  },
};

describe('Open Food Facts', () => {
  it('reads name, brand and per-100 g macros', () => {
    const p = parseProduct(yoghurt, '9300000000001')!;
    expect(p.name).toBe('Greek Yogurt Plain');
    expect(p.brand).toBe('Chobani');
    expect(p.per100).toEqual({ calories: 71, protein: 9.4, carbs: 3.8, fat: 2 });
    expect(p.servingGrams).toBe(170);
    expect(p.servingLabel).toBe('170 g');
  });

  it('works out per-serving macros from per-100 g when not listed', () => {
    const p = parseProduct(yoghurt, '9300000000001')!;
    expect(p.perServing).toEqual({ calories: 121, protein: 16, carbs: 6.5, fat: 3.4 });
  });

  it('prefers the label’s own per-serving values', () => {
    const withServing = {
      status: 1,
      product: {
        ...yoghurt.product,
        nutriments: { ...yoghurt.product.nutriments, 'energy-kcal_serving': 120, proteins_serving: 16, carbohydrates_serving: 6.5, fat_serving: 3.4 },
      },
    };
    expect(parseProduct(withServing, 'x')!.perServing).toEqual({ calories: 120, protein: 16, carbs: 6.5, fat: 3.4 });
  });

  it('converts kJ when kcal is missing (Australian labels)', () => {
    const kjOnly = { status: 1, product: { product_name: 'Weet-Bix', nutriments: { 'energy-kj_100g': 1500, proteins_100g: 12, carbohydrates_100g: 67, fat_100g: 1.4 } } };
    expect(parseProduct(kjOnly, 'x')!.per100!.calories).toBe(359);
  });

  it('handles missing nutrition and not-found products', () => {
    expect(parseProduct({ status: 1, product: { product_name: 'Mystery', nutriments: {} } }, 'x')!.per100).toBeNull();
    expect(parseProduct({ status: 0, status_verbose: 'product not found' }, 'x')).toBeNull();
    expect(parseProduct(null, 'x')).toBeNull();
  });

  it('scales by grams', () => {
    expect(macrosForGrams({ calories: 71, protein: 9.4, carbs: 3.8, fat: 2 }, 200)).toEqual({ calories: 142, protein: 18.8, carbs: 7.6, fat: 4 });
  });

  it('builds a friendly name and validates barcodes', () => {
    expect(displayName(parseProduct(yoghurt, 'x')!)).toBe('Chobani Greek Yogurt Plain');
    expect(isValidBarcode('9300633000001')).toBe(true);
    expect(isValidBarcode('12ab')).toBe(false);
    expect(productUrl('123')).toContain('/api/v2/product/123.json');
  });
});
