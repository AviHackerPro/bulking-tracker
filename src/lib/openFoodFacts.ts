// Barcode lookups using Open Food Facts: a free, open food database.
// No API key or account needed. https://world.openfoodfacts.org

import type { Macros } from './types';
import { scaleMacros } from './totals';

export interface ScannedProduct {
  barcode: string;
  name: string;
  brand: string;
  /** Macros per 100 g (or 100 ml). Null if the label data is missing. */
  per100: Macros | null;
  /** Macros per serving, if the product lists one. */
  perServing: Macros | null;
  /** Serving size in grams, if known (e.g. 170). */
  servingGrams: number | null;
  /** Serving as printed, e.g. "170 g" or "1 tub (170 g)". */
  servingLabel: string | null;
}

const FIELDS = 'code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments';

export function productUrl(barcode: string): string {
  return `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;
}

/** Barcodes on food are 8–14 digits (EAN-8, UPC-A, EAN-13, ITF-14). */
export function isValidBarcode(code: string): boolean {
  return /^\d{8,14}$/.test(code.trim());
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Read one set of macros from the nutriments object, e.g. suffix "_100g" or "_serving". */
function readMacros(n: Record<string, unknown>, suffix: '_100g' | '_serving'): Macros | null {
  let calories = num(n[`energy-kcal${suffix}`]);
  if (calories === null) {
    const kj = num(n[`energy-kj${suffix}`]) ?? num(n[`energy${suffix}`]); // plain "energy" is kJ
    if (kj !== null) calories = kj / 4.184;
  }
  const protein = num(n[`proteins${suffix}`]);
  const carbs = num(n[`carbohydrates${suffix}`]);
  const fat = num(n[`fat${suffix}`]);
  if (calories === null || protein === null || carbs === null || fat === null) return null;
  return { calories: Math.round(calories), protein: round1(protein), carbs: round1(carbs), fat: round1(fat) };
}

/** Turn an Open Food Facts API response into a product, or null if it wasn't found. */
export function parseProduct(json: unknown, barcode: string): ScannedProduct | null {
  if (typeof json !== 'object' || json === null) return null;
  const body = json as { status?: number; product?: Record<string, unknown> };
  if (body.status !== 1 || !body.product) return null;
  const p = body.product;
  const nutriments = (typeof p.nutriments === 'object' && p.nutriments) || {};

  const name = String(p.product_name_en || p.product_name || '').trim() || 'Unnamed product';
  const brand = String(p.brands || '').split(',')[0].trim();
  const servingGrams = num(p.serving_quantity);
  const servingLabel = String(p.serving_size || '').trim() || null;

  const per100 = readMacros(nutriments as Record<string, unknown>, '_100g');
  let perServing = readMacros(nutriments as Record<string, unknown>, '_serving');
  if (!perServing && per100 && servingGrams) perServing = macrosForGrams(per100, servingGrams);

  return { barcode, name, brand, per100, perServing, servingGrams: servingGrams || null, servingLabel };
}

/** Macros for a given number of grams, from per-100 g values. */
export function macrosForGrams(per100: Macros, grams: number): Macros {
  const m = scaleMacros(per100, grams / 100);
  return { calories: Math.round(m.calories), protein: round1(m.protein), carbs: round1(m.carbs), fat: round1(m.fat) };
}

export function displayName(p: ScannedProduct): string {
  return p.brand && !p.name.toLowerCase().includes(p.brand.toLowerCase()) ? `${p.brand} ${p.name}` : p.name;
}

export type LookupResult =
  | { ok: true; product: ScannedProduct }
  | { ok: false; reason: 'not-found' | 'offline' | 'error' };

export async function lookupBarcode(barcode: string, signal?: AbortSignal): Promise<LookupResult> {
  try {
    const res = await fetch(productUrl(barcode), { signal });
    if (res.status === 404) return { ok: false, reason: 'not-found' };
    if (!res.ok) return { ok: false, reason: 'error' };
    const product = parseProduct(await res.json(), barcode);
    return product ? { ok: true, product } : { ok: false, reason: 'not-found' };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    return { ok: false, reason: navigator.onLine === false ? 'offline' : 'error' };
  }
}
