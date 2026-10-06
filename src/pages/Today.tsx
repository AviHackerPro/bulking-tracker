import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { addDays, differenceInCalendarDays, format } from 'date-fns';
import { getDayLog, useAppStore } from '../store/useAppStore';
import { useProgress } from '../store/useProgress';
import { fromDateStr, toDateStr, todayStr, weekStartOf } from '../lib/dates';
import { eatenTotals, extraMacros, slotCounts, stillPlannedTotals } from '../lib/daylog';
import { sessionsInWeek, sessionsOn } from '../lib/habits';
import { MIN_WEIGH_INS_PER_WEEK, weighInsThisWeek } from '../lib/progress';
import { dayHeadline, proteinGapToSuggest, proteinSuggestions } from '../lib/suggestions';
import { orderedSlots } from '../lib/totals';
import { useNow } from '../lib/useNow';
import type { Macros, SlotConfig } from '../lib/types';
import MealRow from '../components/MealRow';
import MealSheet from '../components/MealSheet';
import AddExtraSheet from '../components/AddExtraSheet';
import SuggestionBanner from '../components/SuggestionBanner';
import { CheckIcon, ChevronLeft, ChevronRight, PlusIcon, ScaleIcon, XIcon } from '../components/icons';
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
  const { slots, meals, foods, settings, profile, training, goal } = state;
  const log = useMemo(() => getDayLog(state, date), [state, date]);
  const [addOpen, setAddOpen] = useState(false);
  const [openSlot, setOpenSlot] = useState<SlotConfig | null>(null);

  const eaten = eatenTotals(log);
  const upcoming = stillPlannedTotals(log);
  const counts = slotCounts(log);
  const gap = proteinGapToSuggest(log, slots, now, isToday);
  const ideas = gap > 0 ? proteinSuggestions(foods, gap, settings.wheyEnabled) : [];
  const minDate = profile.startDate ?? today;

  const { suggestion } = useProgress(today);
  const showWeighIn =
    isToday &&
    now.getHours() < 12 &&
    !state.weighIns.some((w) => w.date === today) &&
    weighInsThisWeek(state.weighIns, today) < MIN_WEIGH_INS_PER_WEEK;

  const trainedSessions = sessionsOn(training, date);
  const weekSessions = sessionsInWeek(training, weekStartOf(date));

  const go = (days: number) => setPicked(toDateStr(addDays(fromDateStr(date), days)));
  const toggleTraining = () =>
    trainedSessions.length ? trainedSessions.forEach((t) => state.deleteTraining(t.id)) : state.logTraining(date, '');

  return (
    <main>
      {/* Header */}
      <header className="px-5 pt-7 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted">
              {isToday ? `${greeting(now)} 👋` : format(fromDateStr(date), 'EEEE d MMMM')}
            </p>
            <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">{dayTitle(date, today)}</h1>
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
            className="rounded-full bg-card px-3 py-1.5 text-sm font-semibold shadow-card active:scale-95"
            aria-label={`${log.dayType === 'school' ? 'School' : 'Home'} day. Tap to switch.`}
          >
            {log.dayType === 'school' ? '🏫 School day' : '🏠 Home day'}
          </button>
          {!isToday && (
            <button onClick={() => setPicked(null)} className="rounded-full bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent">
              Back to today
            </button>
          )}
        </div>
      </header>

      <Hero eaten={eaten} upcoming={upcoming} targets={log.targets} message={dayHeadline(log, isToday)} />

      {/* Nudges: only shown when they matter */}
      {isToday && suggestion && <SuggestionBanner suggestion={suggestion} targets={state.targets} compact />}

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

      {ideas.length > 0 && (
        <Card tone="accent">
          <p className="font-semibold">Protein top-up 💪</p>
          <p className="mt-0.5 text-sm text-muted">
            About {fmt(Math.ceil(gap))} g more would hit {fmt(log.targets.protein)} g today. Tap one to add it:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ideas.map(({ food, multiplier, protein }) => (
              <button
                key={food.id}
                className="flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-sm font-semibold shadow-card active:scale-95"
                onClick={() =>
                  state.addExtra(date, {
                    name: food.name,
                    serving: food.serving,
                    base: { calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat },
                    multiplier,
                    foodId: food.id,
                  })
                }
              >
                <PlusIcon size={16} className="text-accent" />
                {food.name.split(',')[0]}
                <span className="font-normal text-muted">
                  {multiplier !== 1 && `${multiplier}× · `}+{fmt(protein, 1)} g
                </span>
              </button>
            ))}
          </div>
        </Card>
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
              onToggleEaten={() => state.setSlotStatus(date, slot.id, log.slots[slot.id].status === 'eaten' ? 'planned' : 'eaten')}
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
        <button
          onClick={() => setAddOpen(true)}
          className={`flex w-full items-center justify-center gap-2 px-4 py-4 font-semibold text-accent active:bg-track ${log.extras.length ? 'border-t border-line' : ''} rounded-b-3xl ${log.extras.length ? '' : 'rounded-t-3xl'}`}
        >
          <PlusIcon size={18} /> Add food or snack
        </button>
      </Card>

      {/* Training */}
      <SectionTitle right={`${weekSessions} this week · aim ${goal.trainingSessionsPerWeek.min}–${goal.trainingSessionsPerWeek.max}`}>
        Training
      </SectionTitle>
      <Card flush>
        <button onClick={toggleTraining} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-pressed={trainedSessions.length > 0}>
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${trainedSessions.length ? 'bg-accent-soft' : 'bg-track'}`}>
            🏋️
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

      <AddExtraSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        foods={foods}
        wheyEnabled={settings.wheyEnabled}
        onAdd={(extra) => state.addExtra(date, extra)}
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

/** The colourful summary card: calorie ring plus protein / carbs / fat. */
function Hero({ eaten, upcoming, targets, message }: { eaten: Macros; upcoming: Macros; targets: Macros; message: string }) {
  const calToGo = Math.round(targets.calories - eaten.calories);
  const rows: { key: 'protein' | 'carbs' | 'fat'; label: string }[] = [
    { key: 'protein', label: 'Protein' },
    { key: 'carbs', label: 'Carbs' },
    { key: 'fat', label: 'Fat' },
  ];
  return (
    <section className="mx-4 mb-3 overflow-hidden rounded-[28px] bg-gradient-to-br from-hero-from to-hero-to p-5 text-white shadow-float">
      <div className="flex items-center gap-5">
        <Ring value={eaten.calories} upcoming={upcoming.calories} target={targets.calories} size={128} stroke={12} color="#ffffff">
          <span className="text-[26px] leading-none font-extrabold tabular-nums">{fmt(eaten.calories)}</span>
          <span className="mt-1 text-xs text-white/80">of {fmt(targets.calories)} cal</span>
        </Ring>
        <div className="min-w-0 flex-1 space-y-3">
          {rows.map(({ key, label }) => {
            const toGo = Math.round(targets[key] - eaten[key]);
            return (
              <div key={key}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold">{label}</span>
                  <span className="text-xs text-white/85 tabular-nums">{toGo > 0 ? `${toGo} g to go` : 'Done ✓'}</span>
                </div>
                <Bar value={eaten[key]} upcoming={upcoming[key]} target={targets[key]} color="bg-white" track="bg-white/20" />
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-4 text-[15px] font-medium text-white/95">
        {calToGo > 0 && <span className="font-bold">{fmt(calToGo)} cal to go. </span>}
        {message}
      </p>
    </section>
  );
}
