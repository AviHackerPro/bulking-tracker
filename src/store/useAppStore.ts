// The app's state, saved automatically to localStorage.
// Components read from it with useAppStore((s) => s.something).

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  createInitialData,
  newId,
  SCHEMA_VERSION,
  STORAGE_KEY,
  type AppData,
  type ThemeSetting,
} from '../lib/storage';
import * as day from '../lib/daylog';
import * as edits from '../lib/planEdits';
import { todayStr } from '../lib/dates';
import { findMeal } from '../lib/totals';
import { defaultPlan } from '../data/plan';
import { adjustTargets } from '../lib/progress';
import type { AdjustDirection, DayLog, DayType, ExtraLog, Food, GoalSettings, Macros, Meal, SlotId, SlotStatus, Weekday } from '../lib/types';

interface Actions {
  /** First-run setup: sets the start date and records the first weigh-in. */
  completeSetup: (startDate: string, startWeightKg: number) => void;

  // Day log (all take a "yyyy-MM-dd" date)
  setSlotStatus: (date: string, slot: SlotId, status: SlotStatus) => void;
  swapMeal: (date: string, slot: SlotId, mealId: string) => void;
  setDayType: (date: string, dayType: DayType) => void;
  addExtra: (date: string, extra: Omit<ExtraLog, 'id'>) => void;
  removeExtra: (date: string, extraId: string) => void;
  /** Mark a day as fully logged (or not). */
  setDayComplete: (date: string, complete: boolean) => void;

  // Weekly rotation
  setRotationMeal: (day: Weekday, slot: SlotId, mealId: string) => void;
  resetRotation: () => void;

  // Meal library
  addMeal: (meal: Omit<Meal, 'id'>) => string;
  updateMeal: (meal: Meal) => void;
  /** Delete a meal; anywhere it's planned switches to replacementId (same slot). */
  deleteMeal: (mealId: string, replacementId: string) => void;

  // Weight
  /** Log a weigh-in. One per day: logging the same date again replaces it. */
  logWeight: (date: string, weightKg: number) => void;
  deleteWeighIn: (id: string) => void;
  /** Accept a ±calorie suggestion: updates targets from today onwards. */
  acceptCalorieChange: (direction: AdjustDirection, deltaCalories: number, source?: 'suggestion' | 'coach') => void;
  dismissSuggestion: (weekStart: string, direction: AdjustDirection) => void;

  // Training
  logTraining: (date: string, notes: string) => void;
  deleteTraining: (id: string) => void;

  // Settings
  /** Change daily targets by hand (applies from today). */
  updateTargets: (targets: Macros) => void;
  updateProfile: (profile: { startDate: string; startWeightKg: number }) => void;
  updateGoal: (goal: Partial<Pick<GoalSettings, 'goalWeightKg' | 'weeklyRateKg'>>) => void;
  setSlotTime: (slot: SlotId, kind: 'schoolTime' | 'homeTime', time: string) => void;
  setWhey: (enabled: boolean) => void;
  markBackedUp: (date: string) => void;
  /** Restore default meals, food list and weekly plan (your own meals and all logs are kept). */
  restoreDefaultPlan: () => void;
  /** Replace everything with data from a backup file. */
  importData: (data: AppData) => void;
  /** Delete everything and start again. */
  resetAll: () => void;

  // Scanned foods & AI
  /** Save a scanned product to the food list (replaces an earlier save of the same barcode). */
  saveFood: (food: Omit<Food, 'id'>) => void;
  deleteFood: (id: string) => void;
  setGeminiKey: (key: string) => void;
  setGeminiModel: (model: string) => void;

  // Passcode lock
  setLockEnabled: (enabled: boolean) => void;
  setPinHash: (hash: string) => void;

  setTheme: (theme: ThemeSetting) => void;
}

export type AppState = AppData & Actions;

/** The saved log for a date, or a fresh one from the current plan if there isn't one yet. */
export function getDayLog(s: AppData, date: string): DayLog {
  return s.dayLogs[date] ?? day.buildDayLog(date, s);
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      /** Apply a change to one day's log, creating the log first if needed. */
      const updateDay = (date: string, change: (log: DayLog, s: AppState) => DayLog) =>
        set((s) => ({ dayLogs: { ...s.dayLogs, [date]: change(getDayLog(s, date), s) } }));

      return {
        ...createInitialData(),

        completeSetup: (startDate, startWeightKg) =>
          set((s) => ({
            profile: { startDate, startWeightKg },
            weighIns: [
              ...s.weighIns.filter((w) => w.date !== startDate),
              { id: newId(), date: startDate, weightKg: startWeightKg },
            ],
          })),

        setSlotStatus: (date, slot, status) =>
          updateDay(date, (log, s) => day.setSlotStatus(log, slot, status, s.meals)),

        swapMeal: (date, slot, mealId) =>
          updateDay(date, (log, s) => {
            const meal = findMeal(s.meals, mealId);
            return meal ? day.swapSlotMeal(log, slot, meal) : log;
          }),

        setDayType: (date, dayType) => updateDay(date, (log) => day.setDayType(log, dayType)),

        addExtra: (date, extra) => updateDay(date, (log) => day.addExtra(log, { ...extra, id: newId() })),

        removeExtra: (date, extraId) => updateDay(date, (log) => day.removeExtra(log, extraId)),

        setDayComplete: (date, complete) => updateDay(date, (log) => day.setComplete(log, complete)),

        setRotationMeal: (weekday, slot, mealId) =>
          set((s) => {
            const rotation = edits.setRotationSlot(s.rotation, weekday, slot, mealId);
            return { rotation, dayLogs: edits.syncLogsWithRotation(s.dayLogs, todayStr(), rotation, s.meals) };
          }),

        resetRotation: () =>
          set((s) => {
            const rotation = edits.repairRotation(structuredClone(defaultPlan.rotation), s.meals);
            return { rotation, dayLogs: edits.syncLogsWithRotation(s.dayLogs, todayStr(), rotation, s.meals) };
          }),

        addMeal: (meal) => {
          const id = edits.mealIdFor(meal.name, get().meals);
          set((s) => ({ meals: [...s.meals, { ...meal, id }] }));
          return id;
        },

        updateMeal: (meal) =>
          set((s) => ({
            meals: s.meals.map((m) => (m.id === meal.id ? meal : m)),
            dayLogs: edits.refreshMealInLogs(s.dayLogs, todayStr(), meal),
          })),

        deleteMeal: (mealId, replacementId) =>
          set((s) => {
            const old = findMeal(s.meals, mealId);
            const replacement = findMeal(s.meals, replacementId);
            if (!old || !replacement || replacement.id === old.id || replacement.slot !== old.slot) return {};
            const meals = s.meals.filter((m) => m.id !== mealId);
            const rotation = edits.replaceMealInRotation(s.rotation, mealId, replacementId);
            const today = todayStr();
            const logs = edits.replaceMealInLogs(s.dayLogs, today, mealId, replacement);
            return { meals, rotation, dayLogs: edits.syncLogsWithRotation(logs, today, rotation, meals) };
          }),

        logWeight: (date, weightKg) =>
          set((s) => ({
            weighIns: [...s.weighIns.filter((w) => w.date !== date), { id: newId(), date, weightKg }].sort((a, b) =>
              a.date.localeCompare(b.date),
            ),
          })),

        deleteWeighIn: (id) => set((s) => ({ weighIns: s.weighIns.filter((w) => w.id !== id) })),

        acceptCalorieChange: (direction, deltaCalories, source = 'suggestion') =>
          set((s) => {
            const today = todayStr();
            const to = adjustTargets(s.targets, deltaCalories);
            // Today's (and any later) logs switch to the new targets; past days keep theirs.
            const dayLogs = Object.fromEntries(
              Object.entries(s.dayLogs).map(([d, log]) => [d, d >= today ? { ...log, targets: { ...to } } : log]),
            );
            return {
              targets: to,
              dayLogs,
              dismissedSuggestion: null,
              targetChanges: [
                ...s.targetChanges,
                { id: newId(), date: today, direction, deltaCalories, from: s.targets, to, source },
              ],
            };
          }),

        dismissSuggestion: (weekStart, direction) => set({ dismissedSuggestion: { weekStart, direction } }),

        logTraining: (date, notes) =>
          set((s) => ({
            training: [...s.training, { id: newId(), date, notes: notes.trim() }].sort((a, b) => a.date.localeCompare(b.date)),
          })),

        deleteTraining: (id) => set((s) => ({ training: s.training.filter((t) => t.id !== id) })),

        updateTargets: (next) =>
          set((s) => {
            const today = todayStr();
            const delta = next.calories - s.targets.calories;
            const dayLogs = Object.fromEntries(
              Object.entries(s.dayLogs).map(([d, log]) => [d, d >= today ? { ...log, targets: { ...next } } : log]),
            );
            const change =
              delta !== 0
                ? [{ id: newId(), date: today, direction: (delta > 0 ? 'increase' : 'decrease') as AdjustDirection, deltaCalories: delta, from: s.targets, to: { ...next }, source: 'manual' as const }]
                : [];
            return { targets: { ...next }, dayLogs, targetChanges: [...s.targetChanges, ...change] };
          }),

        updateProfile: (profile) => set({ profile: { ...profile } }),

        updateGoal: (goal) => set((s) => ({ goal: { ...s.goal, ...goal } })),

        setSlotTime: (slot, kind, time) =>
          set((s) => ({ slots: s.slots.map((c) => (c.id === slot ? { ...c, [kind]: time } : c)) })),

        setWhey: (enabled) => set((s) => ({ settings: { ...s.settings, wheyEnabled: enabled } })),

        markBackedUp: (date) => set((s) => ({ settings: { ...s.settings, lastBackupDate: date } })),

        restoreDefaultPlan: () =>
          set((s) => {
            const fresh = structuredClone(defaultPlan);
            const meals = edits.mergeDefaultMeals(s.meals, fresh.meals);
            const today = todayStr();
            let dayLogs = edits.syncLogsWithRotation(s.dayLogs, today, fresh.rotation, meals);
            for (const m of fresh.meals) dayLogs = edits.refreshMealInLogs(dayLogs, today, m);
            // Keep foods you saved from barcode scans.
            const foods = [...fresh.foods, ...s.foods.filter((f) => f.category === 'saved')];
            return { meals, rotation: fresh.rotation, foods, dayLogs };
          }),

        // A backup never contains the API key or passcode, so keep the ones on this phone.
        importData: (data) =>
          set((s) => ({
            ...data,
            settings: { ...data.settings, geminiApiKey: s.settings.geminiApiKey, pinHash: s.settings.pinHash },
          })),

        resetAll: () => set({ ...createInitialData() }),

        saveFood: (food) =>
          set((s) => {
            const existing = food.barcode ? s.foods.find((f) => f.barcode === food.barcode) : undefined;
            const saved: Food = { ...food, id: existing?.id ?? `saved-${newId()}`, category: 'saved' };
            return { foods: existing ? s.foods.map((f) => (f.id === existing.id ? saved : f)) : [...s.foods, saved] };
          }),

        deleteFood: (id) => set((s) => ({ foods: s.foods.filter((f) => !(f.id === id && f.category === 'saved')) })),

        setGeminiKey: (key) => set((s) => ({ settings: { ...s.settings, geminiApiKey: key.trim() } })),

        setGeminiModel: (model) => set((s) => ({ settings: { ...s.settings, geminiModel: model } })),

        setLockEnabled: (enabled) => set((s) => ({ settings: { ...s.settings, lockEnabled: enabled } })),

        setPinHash: (hash) => set((s) => ({ settings: { ...s.settings, pinHash: hash } })),

        setTheme: (theme) => set((s) => ({ settings: { ...s.settings, theme } })),
      };
    },
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      // Saved data is merged over fresh defaults, so fields added in later
      // versions get sensible values on existing phones.
      merge: (persisted, current) => {
        // Drop fields from older versions that no longer exist (e.g. sleep).
        const { sleep: _removed, ...rest } = persisted as Partial<AppData> & { sleep?: unknown };
        return { ...current, ...rest };
      },
    },
  ),
);
