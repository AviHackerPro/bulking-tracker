// Shared types for the whole app.

/** Calories and macros. Protein, carbs and fat are in grams. */
export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type SlotId = 'breakfast' | 'recess' | 'lunch' | 'afterSchool' | 'dinner';

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** 'school' uses school-day labels (e.g. "Recess"); 'home' uses weekend/holiday ones. Times are the same. */
export type DayType = 'school' | 'home';

export interface SlotConfig {
  id: SlotId;
  /** Label on school days, e.g. "Recess". */
  label: string;
  /** Label on home days (weekends, holidays), e.g. "Morning snack". */
  homeLabel: string;
  /** 24-hour "HH:mm", the same on school and home days. */
  time: string;
  /** Optional reminder shown under the slot, e.g. "Pack with an ice pack". */
  note?: string;
}

export interface Meal extends Macros {
  id: string;
  slot: SlotId;
  name: string;
  ingredients: string;
}

/** A product you scanned by barcode and saved for one-tap adding. */
export interface Food extends Macros {
  id: string;
  name: string;
  /** Human-readable serving, e.g. "200 g" or "1 bar (40 g)". */
  serving: string;
  barcode?: string;
}

/** Which meal id is planned for each slot, on each day of the week. */
export type Rotation = Record<Weekday, Record<SlotId, string>>;

export interface GoalSettings {
  goalWeightKg: number;
  weeklyRateKg: number;
  maintenanceCalories: number;
  trainingSessionsPerWeek: { min: number; max: number };
}

/** The full default plan (see src/data/plan.ts). */
export interface Plan {
  targets: Macros;
  goal: GoalSettings;
  slots: SlotConfig[];
  meals: Meal[];
  rotation: Rotation;
}

// ----- Daily logs ----------------------------------------------------

export type SlotStatus = 'planned' | 'eaten' | 'skipped';

/** A copy of a meal's name and macros, so history stays right if the meal is edited later. */
export interface MealSnapshot extends Macros {
  mealId: string;
  name: string;
}

export interface SlotLog {
  /** What the weekly rotation planned for this slot on this day. */
  plannedMealId: string;
  /** What's actually in the slot (differs from plannedMealId when swapped). Undefined if no meal. */
  meal?: MealSnapshot;
  status: SlotStatus;
}

export interface ExtraLog {
  id: string;
  name: string;
  /** e.g. "200 g". Empty for fully custom foods. */
  serving: string;
  /** Macros for one serving (1×). */
  base: Macros;
  multiplier: number;
  /** Set when picked from saved foods ("saved-…") or the food database ("afcd:…"). */
  foodId?: string;
}

export interface DayLog {
  date: string; // "yyyy-MM-dd"
  dayType: DayType;
  /** The targets that applied on this day (so later target changes don't rewrite history). */
  targets: Macros;
  slots: Record<SlotId, SlotLog>;
  extras: ExtraLog[];
  /** You marked this day as fully logged. Only complete days feed the maintenance coach. */
  complete?: boolean;
}

// ----- Weight & targets ----------------------------------------------

export interface WeighIn {
  id: string;
  date: string; // "yyyy-MM-dd" (one per day, ideally in the morning)
  weightKg: number;
}

export type AdjustDirection = 'increase' | 'decrease';

/** A change to your daily targets: accepted from a suggestion, or edited in Settings. */
export interface TargetChange {
  id: string;
  date: string;
  direction: AdjustDirection;
  deltaCalories: number;
  from: Macros;
  to: Macros;
  /** Missing on older saved data, which means 'suggestion'. */
  source?: 'suggestion' | 'manual' | 'coach';
}

/** A suggestion you said "not now" to. It comes back after the next week ends. */
export interface DismissedSuggestion {
  /** The last completed week when it was dismissed. */
  weekStart: string;
  direction: AdjustDirection;
}

// ----- Training ------------------------------------------------------

export interface TrainingSession {
  id: string;
  date: string; // "yyyy-MM-dd"
  /** Optional, e.g. "Squat 40 kg 3×8, bench 30 kg 3×8". */
  notes: string;
}
