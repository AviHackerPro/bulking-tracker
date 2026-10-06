// ===================================================================
//  YOUR PLAN — the default data for the app.
// ===================================================================
//  Edit this file to change the starting plan: targets, meal slots,
//  meal options, the weekly rotation and the food reference list.
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

import type { Food, Meal, Plan, Rotation, SlotConfig } from '../lib/types';

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
// Times are 24-hour "HH:mm". School days = Mon–Fri by default;
// home days = weekends (and any day you switch to "home day").
export const slots: SlotConfig[] = [
  { id: 'breakfast',   label: 'Breakfast',    homeLabel: 'Breakfast',       schoolTime: '07:30', homeTime: '08:00' },
  { id: 'recess',      label: 'Recess',       homeLabel: 'Morning snack',   schoolTime: '10:50', homeTime: '11:00', note: 'Portable, no fridge needed' },
  { id: 'lunch',       label: 'Lunch',        homeLabel: 'Lunch',           schoolTime: '13:20', homeTime: '13:30', note: 'Pack with an ice pack' },
  { id: 'afterSchool', label: 'After school', homeLabel: 'Afternoon snack', schoolTime: '15:00', homeTime: '16:00' },
  { id: 'dinner',      label: 'Dinner',       homeLabel: 'Dinner',          schoolTime: '19:30', homeTime: '19:30' },
];

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

// ----- Food reference list -------------------------------------------
// For extras and custom logging. Macros are per serving.
export const foods: Food[] = [
  // Protein sources
  { id: 'greek-yoghurt',  category: 'protein', name: 'Greek yoghurt, plain high-protein', serving: '200 g',          calories: 150, protein: 19,  carbs: 8,  fat: 4 },
  { id: 'tofu-firm',      category: 'protein', name: 'Tofu, firm',                        serving: '150 g',          calories: 195, protein: 19,  carbs: 3,  fat: 11 },
  { id: 'paneer',         category: 'protein', name: 'Paneer',                            serving: '100 g',          calories: 300, protein: 18,  carbs: 3,  fat: 22 },
  { id: 'lentils',        category: 'protein', name: 'Lentils, cooked',                   serving: '1 cup (~200 g)', calories: 230, protein: 18,  carbs: 40, fat: 1 },
  { id: 'chickpeas',      category: 'protein', name: 'Chickpeas, cooked/canned',          serving: '1 cup (~165 g)', calories: 270, protein: 15,  carbs: 45, fat: 4 },
  { id: 'kidney-beans',   category: 'protein', name: 'Kidney beans / rajma, cooked/canned', serving: '1 cup (~175 g)', calories: 225, protein: 15, carbs: 40, fat: 1 },
  { id: 'cottage-cheese', category: 'protein', name: 'Cottage cheese',                    serving: '125 g',          calories: 125, protein: 14,  carbs: 4,  fat: 5 },
  { id: 'milk',           category: 'protein', name: 'Full-cream milk',                   serving: '250 ml',         calories: 168, protein: 8.5, carbs: 12, fat: 8.5 },
  { id: 'whey',           category: 'protein', name: 'Whey protein',                      serving: '30 g scoop',     calories: 120, protein: 24,  carbs: 3,  fat: 2, isWhey: true },

  // Carb sources
  { id: 'rice',           category: 'carb', name: 'White rice, cooked',     serving: '1 cup (~190 g)',     calories: 245, protein: 5,   carbs: 54, fat: 0.5 },
  { id: 'oats',           category: 'carb', name: 'Rolled oats, dry',       serving: '50 g',               calories: 190, protein: 6.5, carbs: 30, fat: 3.5 },
  { id: 'pasta',          category: 'carb', name: 'Pasta, cooked',          serving: '1 cup (~140 g)',     calories: 220, protein: 8,   carbs: 43, fat: 1.5 },
  { id: 'wholemeal-bread', category: 'carb', name: 'Wholemeal bread',       serving: '2 slices (~80 g)',   calories: 200, protein: 8,   carbs: 34, fat: 2.5 },
  { id: 'wrap-roti',      category: 'carb', name: 'Wrap or roti',           serving: '1 (~60 g)',          calories: 180, protein: 5,   carbs: 30, fat: 4 },
  { id: 'potato',         category: 'carb', name: 'Potato',                 serving: '1 medium (~170 g)',  calories: 160, protein: 4,   carbs: 37, fat: 0 },
  { id: 'banana',         category: 'carb', name: 'Banana',                 serving: '1 medium (~120 g)',  calories: 105, protein: 1.5, carbs: 27, fat: 0.5 },
  { id: 'weetbix',        category: 'carb', name: 'Weet-Bix',               serving: '2 biscuits (30 g)',  calories: 106, protein: 4,   carbs: 20, fat: 0.5 },
  { id: 'dates',          category: 'carb', name: 'Dates, dried',           serving: '50 g',               calories: 140, protein: 1,   carbs: 37, fat: 0 },

  // Fat sources
  { id: 'peanut-butter',  category: 'fat', name: 'Peanut butter',              serving: '2 tbsp (32 g)',     calories: 190, protein: 8,   carbs: 6, fat: 16 },
  { id: 'nuts',           category: 'fat', name: 'Almonds or peanuts',         serving: '30 g',              calories: 170, protein: 6.5, carbs: 5, fat: 14.5 },
  { id: 'olive-oil',      category: 'fat', name: 'Olive oil',                  serving: '1 tbsp',            calories: 120, protein: 0,   carbs: 0, fat: 14 },
  { id: 'cheddar',        category: 'fat', name: 'Cheddar cheese',             serving: '30 g',              calories: 120, protein: 7.5, carbs: 0, fat: 10 },
  { id: 'avocado',        category: 'fat', name: 'Avocado',                    serving: '½ medium (~75 g)',  calories: 120, protein: 1.5, carbs: 6, fat: 11 },
  { id: 'butter-ghee',    category: 'fat', name: 'Butter or ghee',             serving: '1 tbsp',            calories: 108, protein: 0,   carbs: 0, fat: 12 },
  { id: 'seeds',          category: 'fat', name: 'Pumpkin or sunflower seeds', serving: '30 g',              calories: 165, protein: 8,   carbs: 3, fat: 14 },
  { id: 'dark-chocolate', category: 'fat', name: 'Dark chocolate (70%)',       serving: '20 g',              calories: 120, protein: 1.5, carbs: 9, fat: 9 },

  // Extras (for days you need more calories or protein)
  { id: 'milk-before-bed', category: 'extra', name: 'Glass of milk before bed', serving: '250 ml', calories: 168, protein: 8.5, carbs: 12, fat: 8.5 },
  { id: 'peanut-chikki',   category: 'extra', name: 'Peanut chikki',            serving: '30 g',   calories: 150, protein: 4.5, carbs: 15, fat: 8 },
];

/** Everything above bundled together. */
export const defaultPlan: Plan = { targets, goal, slots, meals, rotation, foods };
