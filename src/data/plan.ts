// ===================================================================
//  YOUR PLAN — the default data for the app.
// ===================================================================
//  Edit this file to change the starting plan: targets, meal slots,
//  meal options and the weekly rotation.
//
//  How it's used: the first time the app opens, it copies this plan
//  onto your phone. Changes you make inside the app (editing meals,
//  changing the rotation, accepting a calorie change) are saved on the
//  phone and don't touch this file. "Reset plan to defaults" in
//  Settings reloads it from here.
//
//  Calories are stored exactly as written below. They're rounded
//  estimates, so they won't exactly equal (protein×4 + carbs×4 + fat×9).
//  That's expected. The app never recalculates calories from macros.
// ===================================================================

import type { Meal, Plan, Rotation, SlotConfig } from '../lib/types';

// ----- Daily targets -------------------------------------------------
// 2,745 cal/day = 2,441 maintenance + 305 surplus (rounded).
// Protein 115 g (460 cal) · Carbs 367 g (1,468 cal) · Fat 91 g (819 cal)
export const targets = {
  calories: 2745,
  protein: 115,
  carbs: 367,
  fat: 91,
};

export const goal = {
  goalWeightKg: 65,
  weeklyRateKg: 0.275,
  maintenanceCalories: 2441,
  trainingSessionsPerWeek: { min: 3, max: 4 },
};

// ----- Meal slots ----------------------------------------------------
// Times are 24-hour "HH:mm" and the same every day. School days = Mon–Fri
// by default; home days (weekends, or any day you switch to "home day")
// only change the labels.
export const slots: SlotConfig[] = [
  { id: 'breakfast',   label: 'Breakfast',    homeLabel: 'Breakfast',       time: '08:00' },
  { id: 'recess',      label: 'Recess',       homeLabel: 'Morning snack',   time: '10:50', note: 'Portable, no fridge needed' },
  { id: 'lunch',       label: 'Lunch',        homeLabel: 'Lunch',           time: '13:20', note: 'Pack with an ice pack' },
  { id: 'afterSchool', label: 'After school', homeLabel: 'Afternoon snack', time: '16:00' },
  { id: 'dinner',      label: 'Dinner',       homeLabel: 'Dinner',          time: '19:30' },
];

/** Times from older versions of the app, which had separate school and home times. */
export const LEGACY_SCHOOL_TIMES: Record<string, string> = {
  breakfast: '07:30', recess: '10:50', lunch: '13:20', afterSchool: '15:00', dinner: '19:30',
};

// ----- Meal options --------------------------------------------------
export const meals: Meal[] = [
  // Breakfast
  { id: 'banana-oat-smoothie', slot: 'breakfast', name: 'Banana oat smoothie',
    ingredients: '300 ml full-cream milk, 50 g rolled oats, 1 banana, 1 tbsp peanut butter',
    calories: 590, protein: 22, carbs: 74, fat: 22 },
  { id: 'overnight-oats', slot: 'breakfast', name: 'Overnight oats',
    ingredients: '60 g oats, 150 g Greek yoghurt, 150 ml milk, 1 tbsp chia seeds, 1 tbsp honey (made the night before)',
    calories: 565, protein: 29, carbs: 71, fat: 16 },
  { id: 'pb-toast-milk', slot: 'breakfast', name: 'PB toast & milk',
    ingredients: '2 slices wholemeal toast, 2 tbsp peanut butter, 300 ml milk',
    calories: 590, protein: 26, carbs: 54, fat: 29 },
  { id: 'weetbix-bowl', slot: 'breakfast', name: 'Weet-Bix bowl',
    ingredients: '3 Weet-Bix, 300 ml milk, 1 banana, 20 g almonds',
    calories: 580, protein: 22, carbs: 75, fat: 21 },

  // Recess
  { id: 'pb-banana-sandwich', slot: 'recess', name: 'PB & banana sandwich',
    ingredients: '2 slices bread, 1½ tbsp peanut butter, ½ banana',
    calories: 395, protein: 15, carbs: 52, fat: 15 },
  { id: 'cheese-sandwich-apple', slot: 'recess', name: 'Cheese sandwich & apple',
    ingredients: '2 slices bread, 30 g cheddar, 1 tsp butter, 1 apple',
    calories: 450, protein: 16, carbs: 59, fat: 17 },

  // Lunch
  { id: 'chana-cheese-wrap', slot: 'lunch', name: 'Chana cheese wrap',
    ingredients: '1 wrap or 2 rotli, 1 cup dry chana masala (cooked with 1 tsp oil), 30 g cheddar',
    calories: 610, protein: 28, carbs: 75, fat: 23 },
  { id: 'bean-cheese-burrito', slot: 'lunch', name: 'Bean & cheese burrito',
    ingredients: '1 large wrap, 1 cup kidney beans, 30 g cheese, ¼ avocado, salsa',
    calories: 585, protein: 28, carbs: 73, fat: 21 },
  { id: 'chickpea-pasta-salad', slot: 'lunch', name: 'Chickpea pasta salad',
    ingredients: '1½ cups cooked pasta, ½ cup chickpeas, 30 g cheese, 2 tsp olive oil dressing, veggies',
    calories: 665, protein: 27, carbs: 87, fat: 23 },

  // After school
  { id: 'yoghurt-banana', slot: 'afterSchool', name: 'Yoghurt & banana',
    ingredients: '200 g high-protein Greek yoghurt (e.g. Chobani plain), 1 banana',
    calories: 255, protein: 21, carbs: 35, fat: 5 },
  { id: 'cottage-cheese-toast', slot: 'afterSchool', name: 'Cottage cheese toast',
    ingredients: '125 g cottage cheese on 1 slice wholemeal toast',
    calories: 225, protein: 18, carbs: 21, fat: 6 },

  // Dinner
  { id: 'gujarati-thali', slot: 'dinner', name: 'Gujarati thali',
    ingredients: '3 rotli with 1 tsp ghee, thick dal (~60 g dry toor or moong dal), ½ cup rice, 1 cup mixed veg shaak (~2 tsp oil)',
    calories: 850, protein: 29, carbs: 140, fat: 21 },
  { id: 'tofu-stir-fry', slot: 'dinner', name: 'Tofu stir-fry with rice',
    ingredients: '2 cups cooked rice, 150 g firm tofu, mixed veggies, 1 tbsp oil, soy sauce',
    calories: 885, protein: 32, carbs: 125, fat: 27 },
  { id: 'burrito-bowl', slot: 'dinner', name: 'Burrito bowl',
    ingredients: '1½ cups rice, 1 cup black or kidney beans, 30 g cheese, ½ avocado, corn & salsa',
    calories: 895, protein: 34, carbs: 139, fat: 23 },
];

// ----- Weekly rotation (default) -------------------------------------
// Values are meal ids from the list above.
export const rotation: Rotation = {
  mon: { breakfast: 'banana-oat-smoothie', recess: 'pb-banana-sandwich',    lunch: 'bean-cheese-burrito',  afterSchool: 'yoghurt-banana',       dinner: 'tofu-stir-fry' },
  tue: { breakfast: 'overnight-oats',      recess: 'cheese-sandwich-apple', lunch: 'chana-cheese-wrap',    afterSchool: 'cottage-cheese-toast', dinner: 'gujarati-thali' },
  wed: { breakfast: 'pb-toast-milk',       recess: 'pb-banana-sandwich',    lunch: 'chickpea-pasta-salad', afterSchool: 'yoghurt-banana',       dinner: 'burrito-bowl' },
  thu: { breakfast: 'weetbix-bowl',        recess: 'cheese-sandwich-apple', lunch: 'chana-cheese-wrap',    afterSchool: 'yoghurt-banana',       dinner: 'tofu-stir-fry' },
  fri: { breakfast: 'banana-oat-smoothie', recess: 'cheese-sandwich-apple', lunch: 'chickpea-pasta-salad', afterSchool: 'yoghurt-banana',       dinner: 'gujarati-thali' },
  sat: { breakfast: 'overnight-oats',      recess: 'pb-banana-sandwich',    lunch: 'chana-cheese-wrap',    afterSchool: 'cottage-cheese-toast', dinner: 'burrito-bowl' },
  sun: { breakfast: 'pb-toast-milk',       recess: 'cheese-sandwich-apple', lunch: 'bean-cheese-burrito',  afterSchool: 'yoghurt-banana',       dinner: 'gujarati-thali' },
};

/** Everything above bundled together. */
export const defaultPlan: Plan = { targets, goal, slots, meals, rotation };
