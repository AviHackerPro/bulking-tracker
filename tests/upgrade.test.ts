import { describe, expect, it } from 'vitest';
import { makeBackup, parseBackup } from '../src/lib/backup';
import { createInitialData, upgradeSavedData } from '../src/lib/storage';

/** Data as an older version of the app saved it. */
function oldData() {
  const data = createInitialData() as unknown as Record<string, unknown>;
  return {
    ...data,
    slots: [
      { id: 'breakfast', label: 'Breakfast', homeLabel: 'Breakfast', schoolTime: '07:30', homeTime: '08:00' },
      { id: 'recess', label: 'Recess', homeLabel: 'Morning snack', schoolTime: '10:50', homeTime: '11:00', note: 'Portable, no fridge needed' },
      { id: 'lunch', label: 'Lunch', homeLabel: 'Lunch', schoolTime: '12:45', homeTime: '13:30' }, // changed by the user
      { id: 'afterSchool', label: 'After school', homeLabel: 'Afternoon snack', schoolTime: '15:00', homeTime: '16:00' },
      { id: 'dinner', label: 'Dinner', homeLabel: 'Dinner', schoolTime: '19:30', homeTime: '19:30' },
    ],
    foods: [
      { id: 'milk', category: 'protein', name: 'Full-cream milk', serving: '250 ml', calories: 168, protein: 8.5, carbs: 12, fat: 8.5 },
      { id: 'whey', category: 'protein', name: 'Whey protein', serving: '30 g scoop', calories: 120, protein: 24, carbs: 3, fat: 2, isWhey: true },
      { id: 'saved-1', category: 'saved', name: 'Chobani Greek Yoghurt', serving: '170 g', calories: 120, protein: 15, carbs: 7, fat: 3, barcode: '9300000000000' },
    ],
    settings: { ...(data.settings as object), wheyEnabled: true },
    sleep: [],
  };
}

describe('upgrading saved data', () => {
  it('gives each meal one time, moving old defaults to the new ones', () => {
    const up = upgradeSavedData(oldData());
    expect(up.slots.map((s: Record<string, unknown>) => [s.id, s.time])).toEqual([
      ['breakfast', '08:00'],
      ['recess', '10:50'],
      ['lunch', '12:45'], // the user's own time is kept
      ['afterSchool', '16:00'],
      ['dinner', '19:30'],
    ]);
    expect(up.slots[0]).not.toHaveProperty('schoolTime');
    expect(up.slots[0]).not.toHaveProperty('homeTime');
    expect(up.slots[1]).toMatchObject({ homeLabel: 'Morning snack', note: 'Portable, no fridge needed' });
  });

  it('keeps only foods saved from barcode scans', () => {
    const up = upgradeSavedData(oldData());
    expect(up.foods).toEqual([
      { id: 'saved-1', name: 'Chobani Greek Yoghurt', serving: '170 g', calories: 120, protein: 15, carbs: 7, fat: 3, barcode: '9300000000000' },
    ]);
  });

  it('drops removed features', () => {
    const up = upgradeSavedData(oldData()) as Record<string, unknown>;
    expect(up).not.toHaveProperty('sleep');
    expect(up.settings).not.toHaveProperty('wheyEnabled');
  });

  it('leaves current data unchanged', () => {
    const fresh = createInitialData();
    expect(upgradeSavedData(fresh)).toEqual(fresh);
    const once = upgradeSavedData(oldData());
    expect(upgradeSavedData(once)).toEqual(once);
  });

  it('upgrades old backup files on import', () => {
    const file = JSON.stringify({ app: 'bulking-tracker', version: 1, exportedAt: '2026-10-01T00:00:00Z', data: oldData() });
    const result = parseBackup(file);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.slots.find((s) => s.id === 'afterSchool')?.time).toBe('16:00');
    expect(result.data.foods.map((f) => f.id)).toEqual(['saved-1']);
    // and a fresh export round-trips
    expect(parseBackup(JSON.stringify(makeBackup(result.data))).ok).toBe(true);
  });
});
