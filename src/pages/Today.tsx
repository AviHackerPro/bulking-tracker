import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { addDays, differenceInCalendarDays, format } from 'date-fns';
import { getDayLog, useAppStore } from '../store/useAppStore';
import { useProgress } from '../store/useProgress';
import { fromDateStr, toDateStr, todayStr, weekStartOf } from '../lib/dates';
import { eatenTotals, extraMacros, slotCounts, stillPlannedTotals } from '../lib/daylog';
import { sessionsInWeek, sessionsOn } from '../lib/habits';
import { MIN_WEIGH_INS_PER_WEEK, weighInsThisWeek } from '../lib/progress';
import { dayHeadline } from '../lib/suggestions';
import { orderedSlots } from '../lib/totals';
import { useNow } from '../lib/useNow';
import type { Macros, SlotConfig } from '../lib/types';
import MealRow from '../components/MealRow';
import MealSheet from '../components/MealSheet';
import AddExtraSheet, { type AddTab } from '../components/AddExtraSheet';
import SuggestionBanner from '../components/SuggestionBanner';
import {
  BarcodeIcon,
  CheckIcon,
  ChevronLeft,
  ChevronRight,
  DumbbellIcon,
  HomeIcon,
  PlusIcon,
  ScaleIcon,
  SchoolIcon,
  SparkleIcon,
  TargetIcon,
  XIcon,
} from '../components/icons';
import Celebration from '../components/Celebration';
import CompactTitle from '../components/CompactTitle';
import { haptic, pop, useCountUp } from '../lib/feel';
import { Bar, Card, fmt, MacroLine, Ring, SectionTitle } from '../components/ui';

function dayTitle(date: string, today: string): string {
  const diff = differenceInCalendarDays(fromDateStr(today), fromDateStr(date));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return format(fromDateStr(date), 'EEE d MMM');
}

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Today() {
  const now = useNow();
  const today = todayStr(now);
  // The day being viewed lives in the URL (#/?date=2026-10-03), so History can link to it.
  const [params, setParams] = useSearchParams();
  const picked = params.get('date');
  const setPicked = (d: string | null) => setParams(d && d !== today ? { date: d } : {}, { replace: true });
  const date = picked && /^\d{4}-\d{2}-\d{2}$/.test(picked) && picked <= today ? picked : today;
  const isToday = date === today;

  const state = useAppStore();
  const { slots, meals, profile, training, goal } = state;
  const log = useMemo(() => getDayLog(state, date), [state, date]);
  const [addTab, setAddTab] = useState<AddTab | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [openSlot, setOpenSlot] = useState<SlotConfig | null>(null);

  const eaten = eatenTotals(log);
  const upcoming = stillPlannedTotals(log);
  const counts = slotCounts(log);
  const minDate = profile.startDate ?? today;

  const { suggestion, coach } = useProgress(today);
  const showWeighIn =
    isToday &&
    now.getHours() < 12 &&
    !state.weighIns.some((w) => w.date === today) &&
    weighInsThisWeek(state.weighIns, today) < MIN_WEIGH_INS_PER_WEEK;

  const trainedSessions = sessionsOn(training, date);
  const weekSessions = sessionsInWeek(training, weekStartOf(date));

  const go = (days: number) => setPicked(toDateStr(addDays(fromDateStr(date), days)));
  /** A photo matched one of your meals: tick it off if it's planned today, otherwise add it as an extra. */
  const logLibraryMeal = (mealId: string) => {
    const slot = orderedSlots(slots).find((s) => log.slots[s.id].meal?.mealId === mealId && log.slots[s.id].status !== 'eaten');
    if (slot) return state.setSlotStatus(date, slot.id, 'eaten');
    const meal = meals.find((m) => m.id === mealId);
    if (meal) {
      const base = { calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat };
      state.addExtra(date, { name: meal.name, serving: '1 meal', base, multiplier: 1 });
    }
  };
  const toggleTraining = () => {
    haptic(trainedSessions.length ? 8 : 18);
    if (trainedSessions.length) trainedSessions.forEach((t) => state.deleteTraining(t.id));
    else state.logTraining(date, '');
  };

  // Celebrate the moment protein (or calories) reaches the target today.
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const prev = useRef({ date, protein: eaten.protein, calories: eaten.calories });
  useEffect(() => {
    const p = prev.current;
    if (isToday && p.date === date) {
      if (p.protein < log.targets.protein && eaten.protein >= log.targets.protein) setCelebrate('Protein target hit');
      else if (p.calories < log.targets.calories && eaten.calories >= log.targets.calories) setCelebrate('Calorie target reached');
    }
    prev.current = { date, protein: eaten.protein, calories: eaten.calories };
  }, [date, isToday, eaten.protein, eaten.calories, log.targets.protein, log.targets.calories]);

  return (
    <main>
      {/* Header */}
      <header className="px-5 pt-7 pb-4">
        <CompactTitle watch={titleRef}>{dayTitle(date, today)}</CompactTitle>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted">
              {isToday ? greeting(now) : format(fromDateStr(date), 'EEEE d MMMM')}
            </p>
            <h1 ref={titleRef} className="text-[1.75rem] leading-[1.1] font-extrabold tracking-[-0.025em]">{dayTitle(date, today)}</h1>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-card disabled:opacity-30"
              onClick={() => go(-1)}
              disabled={date <= minDate}
              aria-label="Previous day"
            >
              <ChevronLeft />
            </button>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-card disabled:opacity-30"
              onClick={() => go(1)}
              disabled={isToday}
              aria-label="Next day"
            >
              <ChevronRight />
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => state.setDayType(date, log.dayType === 'school' ? 'home' : 'school')}
            className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-semibold shadow-card active:scale-95"
            aria-label={`${log.dayType === 'school' ? 'School' : 'Home'} day. Tap to switch.`}
          >
            {log.dayType === 'school' ? <SchoolIcon size={16} className="text-accent" /> : <HomeIcon size={16} className="text-accent" />}
            {log.dayType === 'school' ? 'School day' : 'Home day'}
          </button>
          {!isToday && (
            <button onClick={() => setPicked(null)} className="rounded-full bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent">
              Back to today
            </button>
          )}
        </div>
      </header>

      <Hero eaten={eaten} upcoming={upcoming} targets={log.targets} message={dayHeadline(log, isToday)} meals={counts} />
      {celebrate && <Celebration key={celebrate} text={celebrate} onDone={() => setCelebrate(null)} />}

      {/* Nudges: only shown when they matter */}
      {isToday && suggestion && <SuggestionBanner suggestion={suggestion} targets={state.targets} compact />}
      {isToday && coach?.suggestion && (
        <Link to="/progress?tab=coach" className="mx-4 mb-3 flex items-center gap-3 rounded-3xl bg-card p-4 shadow-glow active:scale-[0.99]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <TargetIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Weekly check-in ready</span>
            <span className="block text-sm text-muted">
              Your coach suggests {coach.suggestion.deltaCalories > 0 ? '+' : '−'}
              {fmt(Math.abs(coach.suggestion.deltaCalories))} cal a day
            </span>
          </span>
          <ChevronRight className="shrink-0 text-muted" />
        </Link>
      )}

      {showWeighIn && (
        <Link to="/progress" className="mx-4 mb-3 flex items-center gap-3 rounded-3xl bg-card p-4 shadow-card active:scale-[0.99]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <ScaleIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Morning weigh-in</span>
            <span className="block text-sm text-muted">Before breakfast is best</span>
          </span>
          <ChevronRight className="shrink-0 text-muted" />
        </Link>
      )}

      {/* Meals */}
      <SectionTitle right={`${counts.eaten} of ${counts.planned + counts.eaten + counts.skipped} eaten`}>Meals</SectionTitle>
      <Card flush>
        <ul className="divide-y divide-line">
          {orderedSlots(slots).map((slot) => (
            <MealRow
              key={slot.id}
              slot={slot}
              log={log}
              onOpen={() => setOpenSlot(slot)}
              onToggleEaten={() => {
                haptic(log.slots[slot.id].status === 'eaten' ? 8 : 18);
                state.setSlotStatus(date, slot.id, log.slots[slot.id].status === 'eaten' ? 'planned' : 'eaten');
              }}
            />
          ))}
        </ul>
      </Card>

      {/* Extras */}
      <SectionTitle right={log.extras.length ? `${fmt(log.extras.reduce((n, x) => n + extraMacros(x).calories, 0))} cal` : undefined}>
        Extras
      </SectionTitle>
      <Card flush>
        {log.extras.length > 0 && (
          <ul className="divide-y divide-line">
            {log.extras.map((x) => (
              <li key={x.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{x.name}</p>
                  <p className="text-sm text-muted">
                    {x.serving && <>{x.multiplier === 1 ? x.serving : `${x.multiplier} × ${x.serving}`} · </>}
                    <MacroLine m={extraMacros(x)} />
                  </p>
                </div>
                <button
                  className="rounded-full p-2 text-muted active:bg-track"
                  onClick={() => state.removeExtra(date, x.id)}
                  aria-label={`Remove ${x.name}`}
                >
                  <XIcon size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={`grid grid-cols-3 gap-2 p-3 ${log.extras.length ? 'border-t border-line' : ''}`}>
          {(
            [
              ['list', <PlusIcon key="i" size={20} />, 'Add food'],
              ['barcode', <BarcodeIcon key="i" size={20} />, 'Barcode'],
              ['ai', <SparkleIcon key="i" size={20} />, 'AI estimate'],
            ] as const
          ).map(([tab, icon, label]) => (
            <button
              key={tab}
              onClick={() => setAddTab(tab)}
              className="flex flex-col items-center gap-1 rounded-2xl bg-track px-2 py-3 text-sm font-semibold text-accent active:scale-[0.97]"
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </Card>

      {/* Training */}
      <SectionTitle right={`${weekSessions} this week · aim ${goal.trainingSessionsPerWeek.min}–${goal.trainingSessionsPerWeek.max}`}>
        Training
      </SectionTitle>
      <Card flush>
        <button
          onClick={(e) => {
            if (!trainedSessions.length) pop(e.currentTarget.lastElementChild);
            toggleTraining();
          }}
          className="pressable flex w-full items-center gap-3 px-4 py-3 text-left"
          aria-pressed={trainedSessions.length > 0}
        >
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${trainedSessions.length ? 'bg-accent-soft text-accent' : 'bg-track text-muted'}`}>
            <DumbbellIcon size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{trainedSessions.length ? 'Workout done!' : isToday ? 'Trained today?' : 'Trained this day?'}</span>
            <span className="block truncate text-sm text-muted">
              {trainedSessions.find((t) => t.notes)?.notes ?? (trainedSessions.length ? 'Nice work, keep it up' : 'Tap to log a session')}
            </span>
          </span>
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition ${
              trainedSessions.length ? 'border-accent bg-accent text-accent-ink' : 'border-line text-transparent'
            }`}
          >
            <CheckIcon size={20} />
          </span>
        </button>
      </Card>

      {/* Mark the day as fully logged (feeds the maintenance coach) */}
      <Card flush className={`mt-6 ${!log.complete && counts.planned === 0 ? 'ring-1 ring-accent/50' : ''}`}>
        <button
          onClick={(e) => {
            if (!log.complete) pop(e.currentTarget.lastElementChild);
            haptic(log.complete ? 8 : 18);
            state.setDayComplete(date, !log.complete);
          }}
          className="pressable flex w-full items-center gap-3 px-4 py-4 text-left"
          aria-pressed={!!log.complete}
        >
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{log.complete ? 'Day fully logged' : 'I logged everything'}</span>
            <span className="block text-sm text-muted">
              {log.complete
                ? 'Your coach will use this day.'
                : counts.planned === 0
                  ? 'All meals done. Anything else to add? Then tick this.'
                  : 'Tick at the end of the day so your coach can use it.'}
            </span>
          </span>
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition ${
              log.complete ? 'border-accent bg-accent text-accent-ink' : 'border-line text-transparent'
            }`}
          >
            <CheckIcon size={20} />
          </span>
        </button>
      </Card>

      <AddExtraSheet
        openTab={addTab}
        onClose={() => setAddTab(null)}
        onAdd={(extra) => state.addExtra(date, extra)}
        onLogMeal={logLibraryMeal}
      />
      <MealSheet
        slot={openSlot}
        log={log}
        meals={meals}
        onClose={() => setOpenSlot(null)}
        onStatus={(status) => openSlot && state.setSlotStatus(date, openSlot.id, status)}
        onSwap={(mealId) => openSlot && state.swapMeal(date, openSlot.id, mealId)}
      />
    </main>
  );
}

/** The "membership card" summary: calorie ring plus protein / carbs / fat. */
function Hero({
  eaten,
  upcoming,
  targets,
  message,
  meals,
}: {
  eaten: Macros;
  upcoming: Macros;
  targets: Macros;
  message: string;
  meals: { planned: number; eaten: number; skipped: number };
}) {
  const calories = useCountUp(eaten.calories);
  const calToGo = Math.round(targets.calories - eaten.calories);
  const total = meals.planned + meals.eaten + meals.skipped;
  const rows: { key: 'protein' | 'carbs' | 'fat'; label: string; bar: string }[] = [
    { key: 'protein', label: 'Protein', bar: 'bg-protein' },
    { key: 'carbs', label: 'Carbs', bar: 'bg-carbs' },
    { key: 'fat', label: 'Fat', bar: 'bg-fat' },
  ];
  return (
    <section className="hero-surface mx-4 mb-3 overflow-hidden rounded-[30px] p-5 shadow-float">
      <div className="mb-4 flex items-center justify-between text-xs font-semibold tracking-[0.14em] text-muted uppercase">
        <span>Daily fuel</span>
        <span className="tracking-normal normal-case">
          <span className="text-accent">{meals.eaten}</span> / {total} meals
        </span>
      </div>
      <div className="flex items-center gap-5">
        <Ring value={eaten.calories} upcoming={upcoming.calories} target={targets.calories} size={132} stroke={11} color="var(--color-accent)" trackColor="rgb(255 255 255 / 0.08)">
          <span className="num text-[1.75rem] leading-none font-extrabold">{fmt(Math.round(calories))}</span>
          <span className="mt-1 text-[0.6875rem] text-muted">of {fmt(targets.calories)} cal</span>
        </Ring>
        <div className="min-w-0 flex-1 space-y-3.5">
          {rows.map(({ key, label, bar }) => {
            const toGo = Math.round(targets[key] - eaten[key]);
            return (
              <div key={key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold">{label}</span>
                  <span className="num text-xs text-muted">
                    {toGo > 0 ? `${toGo} g left` : <span className="inline-flex items-center gap-0.5 text-accent"><CheckIcon size={12} /> Done</span>}
                  </span>
                </div>
                <Bar value={eaten[key]} upcoming={upcoming[key]} target={targets[key]} color={bar} height="h-1.5" />
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-5 border-t border-line pt-4 text-[0.9375rem] text-ink/90">
        {calToGo > 0 && <span className="font-bold text-accent">{fmt(calToGo)} cal to go. </span>}
        {message}
      </p>
    </section>
  );
}
