// What gets saved on the device, and how a fresh copy is created.
//
// Everything lives in one localStorage entry (STORAGE_KEY), managed by
// the Zustand store in src/store/useAppStore.ts. SCHEMA_VERSION lets us
// upgrade old saved data safely when the app changes.

import { defaultPlan } from '../data/plan';
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
  wheyEnabled: boolean;
  /** Date of the last JSON export ("yyyy-MM-dd"), for the backup reminder. */
  lastBackupDate?: string | null;
}

/** All saved data. New fields get added here in later phases. */
export interface AppData {
  profile: Profile;
  targets: Macros;
  goal: GoalSettings;
  slots: SlotConfig[];
  meals: Meal[];
  rotation: Rotation;
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
    foods: plan.foods,
    settings: { wheyEnabled: false, lastBackupDate: null },
    weighIns: [],
    dayLogs: {},
    targetChanges: [],
    dismissedSuggestion: null,
    training: [],
  };
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
