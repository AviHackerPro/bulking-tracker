import { useState } from 'react';
import { addDays, format } from 'date-fns';
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { useProgress } from '../store/useProgress';
import { datesOfWeek, fromDateStr, toDateStr, todayStr, weekStartOf } from '../lib/dates';
import { WEEKS_TO_CALIBRATE, type CoachCheckIn, type CoachWeek } from '../lib/coach';
import { adjustTargets } from '../lib/progress';
import { haptic, useCountUp } from '../lib/feel';
import { useNow } from '../lib/useNow';
import { ChevronDown, TargetIcon } from './icons';
import { Bar, buttonClass, Card, fmt, SectionTitle } from './ui';

const signedKg = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)} kg/wk`;
/** "gaining +0.21 kg/week" or "losing 0.19 kg/week". */
const rateText = (n: number) => (n >= 0 ? `gaining +${n.toFixed(2)} kg a week` : `losing ${Math.abs(n).toFixed(2)} kg a week`);

export default function CoachPanel() {
  const today = todayStr(useNow());
  const { coach } = useProgress(today);
  const { targets, goal, profile, dayLogs, acceptCalorieChange, dismissSuggestion } = useAppStore();
  const [accepted, setAccepted] = useState<number | null>(null);
  const estimate = coach?.estimate ?? goal.maintenanceCalories;
  const shown = useCountUp(estimate);

  const firstCheckIn = toDateStr(addDays(fromDateStr(weekStartOf(profile.startDate ?? today)), 7));
  const weekDates = datesOfWeek(weekStartOf(today));
  const completeThisWeek = weekDates.filter((d) => dayLogs[d]?.complete).length;

  return (
    <>
      {/* Maintenance estimate */}
      <section className="hero-surface mx-4 mb-3 rounded-[30px] p-5 shadow-float">
        <div className="flex items-center justify-between text-xs font-semibold tracking-[0.14em] text-muted uppercase">
          <span>Your maintenance</span>
          <ConfidencePill coach={coach} />
        </div>
        <p className="mt-2">
          <span className="num text-5xl font-extrabold">{fmt(Math.round(shown))}</span>
          <span className="ml-1.5 text-sm text-muted">cal / day</span>
        </p>
        {!coach || coach.confidence === 'calibrating' ? (
          <>
            <p className="mt-2 text-sm text-muted">
              {coach ? 'Calibrating from your data. ' : 'Starting from your plan’s estimate. '}
              {coach
                ? `${coach.validWeeks} of ${WEEKS_TO_CALIBRATE} weeks with enough data.`
                : `First check-in: ${format(fromDateStr(firstCheckIn), 'EEEE d MMM')}.`}
            </p>
            <div className="mt-3">
              <Bar value={coach?.validWeeks ?? 0} target={WEEKS_TO_CALIBRATE} color="bg-accent" height="h-1.5" />
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">
            From {coach.stats.completeDays} complete days and {coach.stats.weighIns} weigh-ins over the last 3 weeks.
          </p>
        )}
      </section>

      <CheckInCard
        coach={coach}
        currentTarget={targets.calories}
        goalRate={goal.weeklyRateKg}
        accepted={accepted}
        onAccept={(direction, delta) => {
          haptic(18);
          acceptCalorieChange(direction, delta, 'coach');
          setAccepted(targets.calories + delta);
        }}
        onKeep={() => coach?.suggestion && dismissSuggestion(coach.weekStart, coach.suggestion.direction)}
      />

      {coach?.losingWeight && (
        <Card tone="warn">
          <p className="font-semibold">Your weight trend is going down</p>
          <p className="mt-1 text-sm">
            On a bulk this usually just means eating a bit more. If it keeps dropping even when you eat more, have a chat with a
            parent or your GP.
          </p>
        </Card>
      )}

      {/* This week's logging */}
      <SectionTitle right={`${completeThisWeek}/7 complete`}>This week</SectionTitle>
      <Card>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {weekDates.map((d) => {
            const done = !!dayLogs[d]?.complete;
            const future = d > today;
            return (
              <div key={d}>
                <div
                  className={`mx-auto h-9 w-9 rounded-full transition-colors ${
                    done ? 'bg-gold-gradient' : future ? 'border border-dashed border-line' : 'bg-track'
                  }`}
                  aria-label={`${format(fromDateStr(d), 'EEEE')}: ${done ? 'complete' : 'not complete'}`}
                />
                <span className="mt-1 block text-[0.6875rem] text-muted">{format(fromDateStr(d), 'EEEEE')}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-muted">
          Tap <span className="font-semibold text-ink">“I logged everything”</span> on Today at the end of each day. The coach only uses
          complete days, so a forgotten meal can’t throw it off.
        </p>
      </Card>

      {coach && (
        <>
          <SectionTitle>Last 3 weeks</SectionTitle>
          <div className="mx-4 mb-3 grid grid-cols-3 gap-2">
            <Tile label="Avg eaten" value={coach.stats.avgIntake !== null ? fmt(Math.round(coach.stats.avgIntake)) : '–'} sub="cal / day" />
            <Tile label="Weight trend" value={coach.stats.ratePerWeek !== null ? signedKg(coach.stats.ratePerWeek).replace(' kg/wk', '') : '–'} sub="kg / week" />
            <Tile label="Goal" value={`+${goal.weeklyRateKg}`} sub="kg / week" />
          </div>
          {coach.history.length >= 2 && <MaintenanceChart history={coach.history} />}
        </>
      )}

      <HowItWorks />
    </>
  );
}

function ConfidencePill({ coach }: { coach: CoachCheckIn | null }) {
  const level = coach?.confidence ?? 'calibrating';
  const label = { calibrating: 'Calibrating', good: 'Good confidence', high: 'High confidence' }[level];
  return (
    <span className={`rounded-full px-2.5 py-1 text-[0.625rem] tracking-[0.08em] ${level === 'calibrating' ? 'bg-white/10 text-muted' : 'bg-accent text-accent-ink'}`}>
      {label}
    </span>
  );
}

function CheckInCard({
  coach,
  currentTarget,
  goalRate,
  accepted,
  onAccept,
  onKeep,
}: {
  coach: CoachCheckIn | null;
  currentTarget: number;
  goalRate: number;
  accepted: number | null;
  onAccept: (direction: 'increase' | 'decrease', delta: number) => void;
  onKeep: () => void;
}) {
  const targets = useAppStore((s) => s.targets);
  const rate = coach?.stats.ratePerWeek;
  const weekLabel = coach ? format(fromDateStr(coach.weekStart), 'd MMM') : '';

  if (accepted !== null) {
    return (
      <Card tone="accent">
        <p className="flex items-center gap-2 font-semibold"><TargetIcon size={18} className="text-accent" /> Target updated</p>
        <p className="mt-1 text-sm">Your new daily target is {fmt(accepted)} cal. Protein stays at {targets.protein} g.</p>
      </Card>
    );
  }
  if (!coach || coach.status === 'calibrating') {
    return (
      <Card>
        <p className="font-semibold">Weekly check-in</p>
        <p className="mt-1 text-sm text-muted">
          No suggestions yet. The coach needs about {WEEKS_TO_CALIBRATE} weeks of data: most days marked “I logged everything” and
          3+ weigh-ins a week. Until then, your plan’s targets and the simple ±200 check apply.
        </p>
      </Card>
    );
  }
  if (coach.status === 'on-track' || !coach.suggestion) {
    return (
      <Card>
        <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">Check-in · week of {weekLabel}</p>
        <p className="mt-1 text-lg font-bold">
          {coach.status === 'on-track' ? 'You’re on track' : coach.status === 'updated' ? 'Target updated this week' : 'Keeping your target this week'}
        </p>
        <p className="mt-1 text-sm text-muted">
          {rate != null && `You’re ${rateText(rate)} (goal +${goalRate}). `}
          Keep your {fmt(currentTarget)} cal target.
        </p>
      </Card>
    );
  }

  const s = coach.suggestion;
  const next = adjustTargets(targets, s.deltaCalories);
  return (
    <section className="mx-4 mb-3 rounded-3xl bg-card p-5 shadow-glow">
      <p className="text-xs font-semibold tracking-[0.12em] text-accent uppercase">Check-in · week of {weekLabel}</p>
      <h2 className="mt-1 text-xl font-bold">{s.direction === 'increase' ? 'Eat a little more' : 'Ease back a little'}</h2>
      <p className="mt-1 text-[0.9375rem] text-muted">
        {rate != null && `You’re ${rateText(rate)}, ${s.direction === 'increase' ? 'below' : 'above'} your +${goalRate} kg goal. `}
        Your maintenance looks like {fmt(coach.estimate)} cal.
      </p>
      <div className="mt-4 rounded-2xl bg-track px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-muted">New daily target</span>
          <span className="num text-lg font-bold">
            {fmt(s.newCalories)} cal <span className="text-sm text-accent">({s.deltaCalories > 0 ? '+' : '−'}{fmt(Math.abs(s.deltaCalories))})</span>
          </span>
        </div>
        <p className="mt-1 text-xs text-muted tabular-nums">
          {next.protein} g protein · {next.carbs} g carbs · {next.fat} g fat
        </p>
      </div>
      <div className="mt-4 flex gap-2">
        <button className={`${buttonClass.ghost} flex-1`} onClick={onKeep}>Keep current</button>
        <button className={`${buttonClass.primary} flex-1`} onClick={() => onAccept(s.direction, s.deltaCalories)}>Accept</button>
      </div>
      <p className="mt-2.5 text-center text-xs text-muted">Nothing changes unless you accept.</p>
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-card px-3 py-2.5 shadow-card">
      <p className="text-[0.6875rem] text-muted">{label}</p>
      <p className="num text-lg font-extrabold">{value}</p>
      <p className="text-[0.6875rem] text-muted">{sub}</p>
    </div>
  );
}

function MaintenanceChart({ history }: { history: CoachWeek[] }) {
  const data = history.map((w) => ({
    week: format(fromDateStr(w.weekStart), 'd MMM'),
    estimate: w.estimate,
    intake: w.stats.avgIntake !== null ? Math.round(w.stats.avgIntake) : undefined,
  }));
  const ys = data.flatMap((d) => [d.estimate, d.intake].filter((n): n is number => n !== undefined));
  const lo = Math.floor((Math.min(...ys) - 100) / 100) * 100;
  const hi = Math.ceil((Math.max(...ys) + 100) / 100) * 100;
  return (
    <Card>
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Chart legend">
        <li className="flex items-center gap-1.5">
          <svg width="18" height="10" aria-hidden><line x1="1" y1="5" x2="17" y2="5" stroke="var(--color-chart-avg)" strokeWidth="2" strokeLinecap="round" /></svg>
          Maintenance estimate
        </li>
        <li className="flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden><circle cx="5" cy="5" r="4" fill="var(--color-chart-target)" /></svg>
          Avg eaten (3 weeks)
        </li>
      </ul>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="week" tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--color-line)' }} tickLine={false} />
            <YAxis domain={[lo, hi]} tickFormatter={(v: number) => fmt(v)} tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip
              cursor={{ stroke: 'var(--color-muted)', strokeWidth: 1 }}
              contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-line)', borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: 'var(--color-ink)', fontWeight: 600 }}
              formatter={(v, name) => [`${fmt(Number(v))} cal`, name === 'estimate' ? 'Maintenance' : 'Avg eaten']}
            />
            <Line dataKey="estimate" stroke="var(--color-chart-avg)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line
              dataKey="intake"
              stroke="none"
              dot={{ r: 4, fill: 'var(--color-chart-target)', stroke: 'var(--color-card)', strokeWidth: 2 }}
              isAnimationActive={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function HowItWorks() {
  const [open, setOpen] = useState(false);
  const goalRate = useAppStore((s) => s.goal.weeklyRateKg);
  return (
    <div className="mt-2">
      <button className="mx-5 flex items-center gap-1 text-sm font-semibold text-accent" onClick={() => setOpen(!open)} aria-expanded={open}>
        How the coach works <ChevronDown size={16} className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <Card className="mt-2.5 space-y-2 text-sm text-muted">
          <p>
            <span className="font-semibold text-ink">1. What you eat.</span> Your average calories over the last 3 weeks, using only
            days you marked as fully logged.
          </p>
          <p>
            <span className="font-semibold text-ink">2. How your weight moves.</span> A trend line through your weigh-ins, so daily water
            swings don’t matter.
          </p>
          <p>
            <span className="font-semibold text-ink">3. Your maintenance.</span> What you eat, minus the energy stored in the weight you
            gained. It moves gradually (at most 150 cal a week) so one odd week can’t throw it off.
          </p>
          <p>
            <span className="font-semibold text-ink">4. Your target.</span> Maintenance plus the surplus for +{goalRate} kg
            a week. It only suggests changes of 100–250 cal, never takes you below maintenance, and keeps protein the same.
          </p>
          <p>Consistent small logging gaps (like a splash of oil) are fine: the coach measures everything in “what you log”.</p>
        </Card>
      )}
    </div>
  );
}
