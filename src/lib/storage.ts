// What gets saved on the device, and how a fresh copy is created.
//
// Everything lives in one localStorage entry (STORAGE_KEY), managed by
// the Zustand store in src/store/useAppStore.ts. SCHEMA_VERSION lets us
// upgrade old saved data safely when the app changes.

import { defaultPlan, LEGACY_SCHOOL_TIMES } from '../data/plan';
import { DEFAULT_PIN_HASH } from './lock';
import type {
  DayLog,
  DismissedSuggestion,
  Food,
  GoalSettings,
  Macros,
  Meal,
  Rotation,
  SlotConfig,
  TargetChange,
  TrainingSession,
  WeighIn,
} from './types';

export type { WeighIn } from './types';

export const STORAGE_KEY = 'bulking-tracker';
export const SCHEMA_VERSION = 1;

export interface Profile {
  /** The day you started using the app ("yyyy-MM-dd"). Null until first-run setup. */
  startDate: string | null;
  startWeightKg: number | null;
}

export interface AppSettings {
  /** Date of the last JSON export ("yyyy-MM-dd"), for the backup reminder. */
  lastBackupDate?: string | null;
  /** Gemini API key for photo analysis. Stays on this phone: never in backups. */
  geminiApiKey?: string;
  geminiModel?: string;
  /** Passcode lock (on unless turned off). Missing on older saved data means on. */
  lockEnabled?: boolean;
  /** Hash of the passcode, never the digits. Missing means the default passcode. */
  pinHash?: string;
  /** Colour theme. Missing means dark. */
  theme?: ThemeSetting;
}

export type ThemeSetting = 'dark' | 'light' | 'system';

/** All saved data. New fields get added here in later phases. */
export interface AppData {
  profile: Profile;
  targets: Macros;
  goal: GoalSettings;
  slots: SlotConfig[];
  meals: Meal[];
  rotation: Rotation;
  /** Products you saved from barcode scans. */
  foods: Food[];
  settings: AppSettings;
  weighIns: WeighIn[];
  /** Keyed by date. A day only gets a log once you tick, swap, skip or add something. */
  dayLogs: Record<string, DayLog>;
  /** Calorie changes you've accepted, oldest first. */
  targetChanges: TargetChange[];
  dismissedSuggestion: DismissedSuggestion | null;
  training: TrainingSession[];
}

/** A fresh copy of the default plan plus empty logs. */
export function createInitialData(): AppData {
  const plan = structuredClone(defaultPlan);
  return {
    profile: { startDate: null, startWeightKg: null },
    targets: plan.targets,
    goal: plan.goal,
    slots: plan.slots,
    meals: plan.meals,
    rotation: plan.rotation,
    foods: [],
    settings: { lastBackupDate: null, lockEnabled: true, pinHash: DEFAULT_PIN_HASH, theme: 'dark' },
    weighIns: [],
    dayLogs: {},
    targetChanges: [],
    dismissedSuggestion: null,
    training: [],
  };
}

type Loose = Record<string, unknown>;
const isObj = (v: unknown): v is Loose => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Bring data saved by an older version of the app up to date. Safe to run
 * on data that's already current. Used when the app loads and on import.
 *  - Meal slots had separate school and home times; now there's one. Times
 *    still on the old defaults move to the new ones; your own edits are kept.
 *  - The built-in food list was replaced by the food database, so only the
 *    foods you saved from barcode scans are kept.
 *  - Removed features (sleep, whey toggle) are dropped.
 */
export function upgradeSavedData<T extends object>(data: T): T {
  const { sleep: _sleep, ...rest } = data as Loose;
  const out: Loose = { ...rest };
  if (Array.isArray(out.slots)) {
    out.slots = out.slots.map((slot: unknown) => {
      if (!isObj(slot) || typeof slot.time === 'string') return slot;
      const { schoolTime, homeTime: _home, ...keep } = slot;
      const fresh = defaultPlan.slots.find((d) => d.id === slot.id);
      const time =
        typeof schoolTime === 'string' && schoolTime !== LEGACY_SCHOOL_TIMES[slot.id as string] ? schoolTime : (fresh?.time ?? '12:00');
      return { ...keep, time };
    });
  }
  if (Array.isArray(out.foods)) {
    out.foods = out.foods
      .filter((f: unknown) => isObj(f) && (f.category === undefined || f.category === 'saved'))
      .map((f: Loose) => {
        const { category: _c, isWhey: _w, ...food } = f;
        return food;
      });
  }
  if (isObj(out.settings)) {
    const { wheyEnabled: _whey, ...settings } = out.settings;
    out.settings = settings;
  }
  return out as T;
}

/** Short unique id. (crypto.randomUUID isn't available over plain http on a phone.) */
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Ask the browser not to clear our data when the phone is low on space.
 * Works on Android Chrome once the app is installed or used often; harmless otherwise.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
