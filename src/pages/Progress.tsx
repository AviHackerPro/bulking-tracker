import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { format } from 'date-fns';
import { useAppStore } from '../store/useAppStore';
import { useProgress } from '../store/useProgress';
import { datesOfWeek, fromDateStr, todayStr, weekStartOf } from '../lib/dates';
import { sessionsInWeek, trainingMessage } from '../lib/habits';
import { summariseDay, summariseWeek, type WeekSummary } from '../lib/history';
import { hasActivity } from '../lib/daylog';
import {
  actualWeeklyRate,
  currentWeight,
  MIN_WEIGH_INS_FOR_RULE,
  MIN_WEIGH_INS_PER_WEEK,
  plannedFinishDate,
  progressFraction,
  projectedFinishDate,
  weighInsThisWeek,
} from '../lib/progress';
import { useNow } from '../lib/useNow';
import type { WeighIn } from '../lib/types';
import WeightChart from '../components/WeightChart';
import SuggestionBanner from '../components/SuggestionBanner';
import { ChevronDown, ChevronRight, XIcon } from '../components/icons';
import { Bar, buttonClass, Card, fmt, inputClass, PageHeader, SectionTitle, Segmented, UnitInput } from '../components/ui';

type Tab = 'weight' | 'training' | 'history';

const longDate = (d: string) => format(fromDateStr(d), 'd MMM yyyy');
const shortDate = (d: string) => format(fromDateStr(d), 'EEE d MMM');
const signed = (n: number, dp = 2) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(dp)}`;

export default function Progress() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = raw === 'training' || raw === 'history' ? raw : 'weight';

  return (
    <main>
      <PageHeader title="Progress" />
      <Segmented
        className="mx-4 mb-4"
        value={tab}
        onChange={(t) => setParams(t === 'weight' ? {} : { tab: t }, { replace: true })}
        options={[
          { value: 'weight', label: 'Weight' },
          { value: 'training', label: 'Training' },
          { value: 'history', label: 'History' },
        ]}
      />
      {tab === 'weight' && <WeightTab />}
      {tab === 'training' && <TrainingTab />}
      {tab === 'history' && <HistoryTab />}
    </main>
  );
}

// ----- Weight ------------------------------------------------------------

function WeightTab() {
  const today = todayStr(useNow());
  const { weighIns, profile, goal, targets, targetChanges, logWeight, deleteWeighIn, acceptCalorieChange, dismissSuggestion } = useAppStore();
  const { stats, suggestion } = useProgress(today);
  const [justAccepted, setJustAccepted] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const startDate = profile.startDate ?? today;
  const startWeight = profile.startWeightKg ?? weighIns[0]?.weightKg ?? 0;
  const plan = { startDate, startWeightKg: startWeight, weeklyRateKg: goal.weeklyRateKg, goalWeightKg: goal.goalWeightKg };

  const current = currentWeight(stats);
  const gained = current !== null ? current - startWeight : 0;
  const toGo = Math.max(0, goal.goalWeightKg - (current ?? startWeight));
  const pct = current !== null ? progressFraction(startWeight, current, goal.goalWeightKg) : 0;
  const rate = actualWeeklyRate(weighIns.filter((w) => w.date >= startDate));
  const projected = current !== null && rate !== null ? projectedFinishDate(current, goal.goalWeightKg, rate, today) : null;
  const recentWeeks = [...stats].reverse();

  return (
    <>
      {justAccepted !== null && (
        <Card tone="accent">
          <p className="font-semibold">Targets updated 🎯</p>
          <p className="mt-0.5 text-sm">
            New daily target: {fmt(targets.calories)} cal. Protein stays at {targets.protein} g. Give it a couple of weeks.
          </p>
        </Card>
      )}
      {suggestion && (
        <SuggestionBanner
          suggestion={suggestion}
          targets={targets}
          onAccept={() => {
            acceptCalorieChange(suggestion.direction, suggestion.deltaCalories);
            setJustAccepted(suggestion.deltaCalories);
          }}
          onDismiss={() => dismissSuggestion(suggestion.weekStart, suggestion.direction)}
        />
      )}

      {/* Where you are */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-muted">Weekly average</p>
            <p className="text-5xl font-extrabold tracking-tight">
              {current !== null ? current.toFixed(1) : '–'}
              <span className="ml-1 text-xl font-bold text-muted">kg</span>
            </p>
          </div>
          <span className="mt-1 rounded-full bg-accent-soft px-3 py-1 text-sm font-bold text-accent tabular-nums">
            {signed(gained, 1)} kg
          </span>
        </div>
        <div className="mt-4">
          <Bar value={pct} target={1} color="bg-accent" height="h-3" />
          <div className="mt-1.5 flex justify-between text-xs text-muted tabular-nums">
            <span>Start {startWeight.toFixed(1)}</span>
            <span className="font-semibold text-ink">{toGo.toFixed(1)} kg to go</span>
            <span>Goal {goal.goalWeightKg}</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl bg-track px-3 py-2.5">
            <p className="text-xs text-muted">Plan finish</p>
            <p className="font-bold">{longDate(plannedFinishDate(plan))}</p>
          </div>
          <div className="rounded-2xl bg-track px-3 py-2.5">
            <p className="text-xs text-muted">{rate !== null ? `Your pace ${signed(rate)}/wk` : 'Your pace'}</p>
            <p className="font-bold">
              {current !== null && current >= goal.goalWeightKg
                ? 'Goal reached! 🎉'
                : rate === null
                  ? <span className="font-medium text-muted">After 2 weeks</span>
                  : projected
                    ? longDate(projected)
                    : <span className="font-medium text-muted">Not gaining yet</span>}
            </p>
          </div>
        </div>
      </Card>

      <LogWeight today={today} startDate={startDate} weighIns={weighIns} onSave={logWeight} />

      <Card>
        <WeightChart weighIns={weighIns} weeks={stats} plan={plan} today={today} />
      </Card>

      <SectionTitle>Weekly averages</SectionTitle>
      <Card flush>
        <ul className="divide-y divide-line">
          {recentWeeks.map((w, i) => (
            <li key={w.weekStart} className="flex items-center justify-between gap-3 px-5 py-3">
              <span>
                <span className="block font-semibold">{i === 0 ? 'This week' : `Week of ${format(fromDateStr(w.weekStart), 'd MMM')}`}</span>
                <span className={`text-xs ${w.count < MIN_WEIGH_INS_FOR_RULE ? 'text-warn' : 'text-muted'}`}>
                  {w.count} {w.count === 1 ? 'weigh-in' : 'weigh-ins'}
                </span>
              </span>
              <span className="flex items-center gap-2 tabular-nums">
                {w.change !== null && (
                  <span className="rounded-lg bg-track px-2 py-0.5 text-xs font-semibold">{signed(w.change)}</span>
                )}
                <span className="w-20 text-right font-bold">{w.average !== null ? `${w.average.toFixed(2)} kg` : '–'}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <p className="mx-5 -mt-1 text-xs text-muted">
        Calorie suggestions use finished weeks with {MIN_WEIGH_INS_FOR_RULE}+ weigh-ins, and skip the jump from week 1 to week 2 (early water weight).
      </p>

      <div className="mt-5">
        <button className="mx-5 flex items-center gap-1 text-sm font-semibold text-accent" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
          All weigh-ins ({weighIns.length}) <ChevronDown size={16} className={showAll ? 'rotate-180' : ''} />
        </button>
        {showAll && (
          <Card flush className="mt-2.5">
            <ul className="divide-y divide-line">
              {[...weighIns].reverse().map((w) => (
                <li key={w.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span>{shortDate(w.date)}</span>
                  <span className="flex items-center gap-1">
                    <span className="font-bold tabular-nums">{w.weightKg.toFixed(1)} kg</span>
                    <button className="rounded-full p-1.5 text-muted active:bg-track" onClick={() => deleteWeighIn(w.id)} aria-label={`Delete weigh-in on ${w.date}`}>
                      <XIcon size={16} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {targetChanges.length > 0 && (
        <>
          <SectionTitle>Calorie changes</SectionTitle>
          <Card flush>
            <ul className="divide-y divide-line">
              {[...targetChanges].reverse().map((c) => (
                <li key={c.id} className="flex justify-between gap-2 px-5 py-2.5 text-sm">
                  <span className="text-muted">{longDate(c.date)}</span>
                  <span className="tabular-nums">
                    {fmt(c.from.calories)} → <span className="font-bold">{fmt(c.to.calories)} cal</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}

function LogWeight({
  today,
  startDate,
  weighIns,
  onSave,
}: {
  today: string;
  startDate: string;
  weighIns: WeighIn[];
  onSave: (date: string, kg: number) => void;
}) {
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(today);
  const [saved, setSaved] = useState<string | null>(null);
  const kg = Number(weight.replace(',', '.'));
  const valid = weight.trim() !== '' && kg >= 30 && kg <= 150;
  const previous = weighIns.find((w) => w.date === date)?.weightKg;
  const thisWeek = weighInsThisWeek(weighIns, today);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const rounded = Math.round(kg * 10) / 10;
    onSave(date, rounded);
    setSaved(`Saved ${rounded.toFixed(1)} kg. Nice work!`);
    setWeight('');
  }

  return (
    <Card>
      <form onSubmit={submit}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">Log weigh-in</h2>
          <span className={`text-xs font-semibold ${thisWeek >= MIN_WEIGH_INS_PER_WEEK ? 'text-accent' : 'text-muted'}`}>
            {thisWeek}/{MIN_WEIGH_INS_PER_WEEK} this week{thisWeek >= MIN_WEIGH_INS_PER_WEEK ? ' ✓' : ''}
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <UnitInput
            className="flex-1"
            label="Weight in kg"
            placeholder="Weight"
            unit="kg"
            value={weight}
            onChange={(v) => {
              setWeight(v);
              setSaved(null);
            }}
          />
          <button type="submit" disabled={!valid} className={buttonClass.primary}>Save</button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted">
          <input
            type="date"
            value={date}
            min={startDate}
            max={today}
            onChange={(e) => setDate(e.target.value || today)}
            className="rounded-xl bg-track px-2.5 py-1.5 text-ink outline-none focus:ring-2 focus:ring-accent"
            aria-label="Weigh-in date"
          />
          <span>Best in the morning</span>
        </div>
        {previous !== undefined && weight !== '' && !saved && <p className="mt-2 text-xs text-muted">Replaces {previous.toFixed(1)} kg logged for this day.</p>}
        {saved && <p className="mt-2 text-sm font-semibold text-accent">{saved}</p>}
      </form>
    </Card>
  );
}

// ----- Training ----------------------------------------------------------

function TrainingTab() {
  const today = todayStr(useNow());
  const { training, goal, logTraining, deleteTraining } = useAppStore();
  const target = goal.trainingSessionsPerWeek;
  const count = sessionsInWeek(training, weekStartOf(today));
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const recent = [...training].reverse().slice(0, 20);

  return (
    <>
      <Card>
        <p className="text-sm font-semibold text-muted">This week</p>
        <p className="text-5xl font-extrabold tracking-tight">
          {count}
          <span className="ml-1.5 text-lg font-bold text-muted">of {target.min}–{target.max} sessions</span>
        </p>
        <div className="mt-4 flex gap-1.5" aria-hidden>
          {Array.from({ length: Math.max(target.max, count) }, (_, i) => (
            <div key={i} className={`h-3 flex-1 rounded-full ${i < count ? 'bg-accent' : 'bg-track'}`} />
          ))}
        </div>
        <p className="mt-3 text-[15px]">{trainingMessage(count, target)}</p>
      </Card>

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            logTraining(date, notes);
            setNotes('');
            setSaved(true);
          }}
          className="space-y-2.5"
        >
          <h2 className="font-bold">Log a session</h2>
          <input
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setSaved(false);
            }}
            className={inputClass}
            placeholder="What did you do? (optional)"
            aria-label="Session notes"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value || today)}
              className="rounded-2xl bg-track px-3 text-sm outline-none focus:ring-2 focus:ring-accent"
              aria-label="Session date"
            />
            <button type="submit" className={`${buttonClass.primary} flex-1`}>Log session</button>
          </div>
          {saved && <p className="text-sm font-semibold text-accent">Logged. Nice work! 💪</p>}
        </form>
      </Card>

      {recent.length > 0 && (
        <>
          <SectionTitle>Recent sessions</SectionTitle>
          <Card flush>
            <ul className="divide-y divide-line">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{shortDate(t.date)}</span>
                    {t.notes && <span className="block truncate text-sm text-muted">{t.notes}</span>}
                  </span>
                  <button className="rounded-full p-1.5 text-muted active:bg-track" onClick={() => deleteTraining(t.id)} aria-label={`Delete session on ${t.date}`}>
                    <XIcon size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}

// ----- History -----------------------------------------------------------

function HistoryTab() {
  const today = todayStr(useNow());
  const { dayLogs, training, goal } = useAppStore();
  const { stats } = useProgress(today);
  const weeks = useMemo(
    () => [...stats].reverse().map((w) => summariseWeek({ weekStart: w.weekStart, today, dayLogs, weightWeek: w, training })),
    [stats, today, dayLogs, training],
  );

  return (
    <>
      {weeks.map((w) => (
        <WeekCard key={w.weekStart} w={w} trainingTarget={goal.trainingSessionsPerWeek} />
      ))}
      <p className="mx-5 mt-1 text-xs text-muted">Food numbers only count days you logged something.</p>
    </>
  );
}

function WeekCard({ w, trainingTarget }: { w: WeekSummary; trainingTarget: { min: number; max: number } }) {
  const { dayLogs } = useAppStore();
  const [open, setOpen] = useState(false);
  const days = datesOfWeek(w.weekStart)
    .map((d) => dayLogs[d])
    .filter((l) => l && hasActivity(l))
    .reverse();

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{w.current ? 'This week' : `Week of ${format(fromDateStr(w.weekStart), 'd MMM')}`}</h2>
        <span className="text-xs text-muted">{w.loggedDays}/7 days logged</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {w.averageEaten && w.averageTargets && (
          <>
            <Tile label="Avg calories" value={fmt(w.averageEaten.calories)} sub={`of ${fmt(w.averageTargets.calories)}`} />
            <Tile label="Avg protein" value={`${fmt(w.averageEaten.protein)} g`} sub={`of ${fmt(w.averageTargets.protein)} g`} />
            <Tile label="Meals ticked" value={`${w.adherencePct ?? 0}%`} sub={`protein hit ${w.proteinDays}/${w.loggedDays} ${w.loggedDays === 1 ? 'day' : 'days'}`} />
          </>
        )}
        <Tile label="Training" value={String(w.trainingSessions)} sub={`aim ${trainingTarget.min}–${trainingTarget.max}`} />
        <Tile
          wide={!!w.averageEaten}
          label="Weight"
          value={w.weightAverage !== null ? `${w.weightAverage.toFixed(2)} kg` : '–'}
          sub={w.weightChange !== null ? `${signed(w.weightChange)} kg vs last week` : undefined}
        />
      </div>
      {!w.averageEaten && <p className="mt-2.5 text-sm text-muted">No meals logged this week.</p>}
      {days.length > 0 && (
        <>
          <button className="mt-3 flex items-center gap-1 text-sm font-semibold text-accent" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? 'Hide days' : `Show ${days.length} logged ${days.length === 1 ? 'day' : 'days'}`}
            <ChevronDown size={16} className={open ? 'rotate-180' : ''} />
          </button>
          {open && (
            <ul className="mt-2 space-y-1.5">
              {days.map((log) => {
                const s = summariseDay(log!);
                return (
                  <li key={log!.date}>
                    <Link to={`/?date=${log!.date}`} className="flex items-center gap-3 rounded-2xl bg-track px-4 py-2.5 active:scale-[0.99]">
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{shortDate(log!.date)}</span>
                        <span className="text-xs text-muted">
                          {s.mealsEaten}/{s.mealsPlanned} meals{s.extras ? ` · ${s.extras} extra${s.extras > 1 ? 's' : ''}` : ''}
                        </span>
                      </span>
                      <span className="text-right text-sm tabular-nums">
                        <span className="block font-bold">{fmt(s.eaten.calories)} cal</span>
                        <span className={`block text-xs ${s.proteinHit ? 'font-semibold text-protein' : 'text-muted'}`}>
                          {fmt(s.eaten.protein)} g protein{s.proteinHit ? ' ✓' : ''}
                        </span>
                      </span>
                      <ChevronRight size={18} className="shrink-0 text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

function Tile({ label, value, sub, wide = false }: { label: string; value: ReactNode; sub?: string; wide?: boolean }) {
  return (
    <div className={`rounded-2xl bg-track px-3.5 py-2.5 ${wide ? 'col-span-2' : ''}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-extrabold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}
