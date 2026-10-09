# Stacked

A personal, mobile-first bulking tracker for a lacto-vegetarian bulking plan: meals, macros, weight and training.
Everything is saved on your phone. There's no account and no server. It installs to your home screen and works offline.

## What it does

- **Today:** a calorie ring and macro bars, your 5 meals with one-tap ticking, swap/skip, extras and custom foods, and a one-tap training log.
- **Food search:** about 1,000 everyday vegetarian foods from the [Australian Food Composition Database](https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd) (Food Standards Australia New Zealand). It's built in, so it's instant and works offline. Pick an amount in grams (mL for drinks).
- **Barcode scanner:** scan a packet to get its label macros from [Open Food Facts](https://world.openfoodfacts.org) (free, no key). Scanned products can be saved for one-tap adding.
- **AI estimates (optional):** describe what you ate, snap a photo, or both, and Google Gemini estimates each food's portion and macros. You review everything before it's logged.
- **Passcode lock:** a 4-digit passcode screen when the app opens (change it or turn it off in Settings).
- **Plan:** edit the weekly rotation day by day (with live totals and low-protein warnings), and add, edit or delete meals.
- **Progress:**
  - weigh-ins, with a chart of the weekly average against the target line, and a projected finish date
  - **maintenance coach**: estimates the calories you really burn from your logged intake and weight trend, and suggests a weekly target for your goal rate (only from days you mark "I logged everything"; suggestions are capped and never change anything until you accept)
  - a simple ±200 cal check while the coach is still calibrating
  - training sessions
  - weekly history
- **Settings:** appearance (dark, light or match phone), targets, goal, meal times (the same on school and home days), the Gemini API key, passcode, backup export/import, and reset.
- **Design:** black-and-gold theme (dark by default), custom icons, a timeline-style meal list, smooth tab transitions, animated rings and numbers, a small vibration when you tick things off (Android), and a celebration when you hit your protein target.
- **Feel (inspired by Apple's fluid-interface guidelines):**
  - **Sheets** slide up on a spring. Drag the handle (or pull down from the top of the content) and the sheet follows your finger.
    A flick closes it, and the release speed carries straight into the animation. You can grab it again mid-slide, and the page behind dims and recedes as the sheet rises.
  - **Frosted bars:** the bottom nav and a compact page title that appears once the big title scrolls away. Tap the compact title to jump back to the top.
  - **Instant press feedback** on buttons, a sliding segmented control, and the tick "pop" lands on the same frame as the vibration.
  - **Respects phone settings:** reduce motion (no sliding, just quick fades), reduce transparency (solid bars), higher contrast, and larger text sizes.

## What you need

- [Node.js](https://nodejs.org) 20.19 or newer (check with `node --version`)
- [Git](https://git-scm.com) and a free [GitHub](https://github.com) account (for putting it online)

## Run it on your computer

```bash
npm install        # first time only
npm run dev        # starts the app at http://localhost:5173
```

Press `Ctrl + C` in the terminal to stop.

To try the built version with offline support (served at http://localhost:4173/bulking-tracker/):

```bash
npm run build
npm run preview
```

## Run the tests

```bash
npm test
```

The tests cover all the maths, including:
- daily totals against the expected table (Mon 2,710 cal / 118 g protein … weekly average 2,746 / 120 / 368 / 89)
- the ±200 calorie suggestion rule
- swaps, skips and extras
- weekly summaries
- backups

## Put it online with GitHub Pages (one-time setup)

1. **Create the repository.** Sign in to GitHub. Click **+ → New repository** and name it `bulking-tracker`. Choose **Public**, because free GitHub Pages needs a public repo. Don't add a README, .gitignore or licence, then click **Create repository**.
   The repo only contains code and the meal plan. Your logs and weight never leave your phone.
2. **Upload the code.** In this folder, run (replace `YOUR-USERNAME`):

   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/bulking-tracker.git
   git push -u origin main
   ```

   The first push opens a browser window to sign in to GitHub.
3. **Turn on Pages.** In the repo, go to **Settings → Pages**. Under *Build and deployment → Source*, choose **GitHub Actions**.
4. **Deploy.** Open the **Actions** tab, pick **Deploy to GitHub Pages**, and click **Run workflow**. After a minute or two it goes green.
5. **Open it:** `https://YOUR-USERNAME.github.io/bulking-tracker/`

After that, every `git push` to `main` re-tests and re-publishes the app automatically. Your phone picks up the new version the next time you open it.

> If you name the repo something else, the address changes to match. The deploy script handles that for you.

## Install it on your Android phone

1. Open the GitHub Pages address in **Chrome**.
2. Tap **⋮ → Add to Home screen → Install** (or tap **Install** if Chrome offers it).
3. Open it from the home-screen icon. It runs full-screen and works without internet.

**Back up regularly:** Settings → **Export backup** saves a `.json` file to your Downloads. Data lives in the browser storage for that address, so clearing Chrome's site data or uninstalling the app would delete it. **Import** restores a backup, on the same phone or a new one.

## Set up AI estimates (optional)

1. Get a free API key from [Google AI Studio](https://aistudio.google.com/apikey).
2. In the app: **Settings → AI photo analysis**, paste the key, then tap **Save key**. It checks the key straight away.
3. On Today, tap **AI estimate**. Describe the food (e.g. "pav bhaji with 2 buttered pav"), add a photo, or both, and tap **Estimate macros**.

Notes:
- The key is stored only on your phone. It's never in the code on GitHub or in backup files.
- On Gemini's free tier, Google may use photos to improve its products, so only photograph food. If you hit the free daily limit, switch the model to **Flash-Lite** in Settings.
- Optional extra safety: in Google Cloud Console, restrict the key to your website (*Application restrictions → Websites → `https://YOUR-USERNAME.github.io/*`*).

The barcode scanner needs camera permission and an internet connection. Products you save work offline.

## Try it on your phone during development (same Wi-Fi)

```bash
npm run dev:phone
```

Open the **Network** address it prints (like `http://192.168.1.23:5173`) on your phone. If Windows asks, allow Node.js on **private networks**.
The camera only works on secure addresses, so test barcode scanning on the GitHub Pages site (or type the barcode number).
Data entered this way is separate from the installed app.

## Editing your plan

All the default plan data lives in **[`src/data/plan.ts`](src/data/plan.ts)**: targets, meal times, meals and the weekly rotation.

- The app copies this onto the phone the first time it opens. After that, edits made in the app are saved on the phone.
  To pick up changes to this file on an existing phone, use Settings → **Restore default meals**.
- Meal calories are stored exactly as written. They're never recalculated from the macros.
- After editing, run `npm test`. If you change the default rotation or meals, update the expected values in `tests/totals.test.ts` too.

## Food database

The food search uses **AFCD Release 3** (December 2025) from Food Standards Australia New Zealand, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Changes made for this app:
- Kept energy, protein, fat and available carbohydrate only, and converted kJ to calories.
- Left out meat, fish, egg and alcohol, plus foods whose names say they contain them.
- Drinks are per 100 mL; everything else is per 100 g.

The result is [`src/data/afcd.json`](src/data/afcd.json). To rebuild it from a new release:
1. Download the "Nutrient profiles" Excel file from the [FSANZ download page](https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/australian-food-composition-database-download-excel-files).
2. Run:
   ```
   python -I scripts/afcd/build_afcd.py "path/to/Nutrient profiles.xlsx" src/data/afcd.json
   ```
   It uses the Python standard library only, so there's nothing to install.

## App icons

The Stacked icons are generated from `public/icon.svg`. After changing the SVG, run `npm run icons`.

## Project layout

```
src/
  data/plan.ts          your editable plan (defaults)
  data/afcd.json        food database (built by scripts/afcd)
  lib/                  all the logic, as plain tested functions
    totals.ts           calorie/macro maths
    daylog.ts           ticking, swapping, skipping, extras
    progress.ts         weekly averages, ±200 cal rule, projections
    coach.ts            maintenance coach (adaptive expenditure + weekly check-ins)
    planEdits.ts        rotation & meal-library edits
    history.ts          weekly summaries
    habits.ts           training counts
    suggestions.ts      status messages
    foodDatabase.ts     food search (AFCD)
    backup.ts           export / import (never includes the API key)
    openFoodFacts.ts    barcode → product macros
    gemini.ts           AI estimates from text and/or photos (Gemini API)
    lock.ts             passcode lock (stored as a hash)
    feel.ts             haptics, page transitions, count-up numbers
    spring.ts           spring physics, momentum projection, rubber-banding
    image.ts            shrinks photos before upload
    storage.ts          what's saved on the phone
  store/                app state + automatic saving (localStorage)
  components/           shared UI (ui.tsx kit, icons, meal rows/sheets, chart, nav)
  pages/                Today, Plan, Progress, Settings (+ Welcome)
tests/                  Vitest tests
scripts/afcd/           rebuilds the food database from the FSANZ download
.github/workflows/      GitHub Pages deploy
```

## Tech

Vite · React · TypeScript · Tailwind CSS · Zustand (state + localStorage) · date-fns · Recharts · vite-plugin-pwa · barcode-detector · Open Food Facts · AFCD (FSANZ) · Gemini API · Vitest
