import { useRef, useState, type ReactNode } from 'react';
import { differenceInCalendarDays, format } from 'date-fns';
import { useAppStore } from '../store/useAppStore';
import { defaultPlan } from '../data/plan';
import { backupFileName, makeBackup, parseBackup } from '../lib/backup';
import { fromDateStr, todayStr } from '../lib/dates';
import { caloriesFromMacros, orderedSlots } from '../lib/totals';
import type { AppData } from '../lib/storage';
import type { Macros } from '../lib/types';
import { buttonClass, Card, fmt, inputClass, PageHeader, SectionTitle, Sheet, SLOT_EMOJI, Toggle, UnitInput } from '../components/ui';

export default function Settings() {
  // Bumped after a backup is restored, so the forms reload their values.
  const [version, setVersion] = useState(0);
  return (
    <main>
      <PageHeader title="Settings" />
      <TargetsCard key={`t${version}`} />
      <GoalCard key={`g${version}`} />
      <MealTimesCard />
      <FoodListCard />
      <BackupCard onRestored={() => setVersion((v) => v + 1)} />
      <ResetCard />
      <p className="mx-5 mt-6 text-center text-xs text-muted">
        Everything is saved on this phone only. No account, no server.
      </p>
    </main>
  );
}

// ----- Daily targets -----------------------------------------------------

function TargetsCard() {
  const { targets, updateTargets } = useAppStore();
  const toText = (t: Macros) => ({ calories: String(t.calories), protein: String(t.protein), carbs: String(t.carbs), fat: String(t.fat) });
  const [vals, setVals] = useState(toText(targets));
  const [saved, setSaved] = useState(false);

  const num = (s: string) => Number(s.replace(',', '.'));
  const next: Macros = { calories: num(vals.calories), protein: num(vals.protein), carbs: num(vals.carbs), fat: num(vals.fat) };
  const valid = Object.values(next).every((n) => Number.isFinite(n) && n > 0) && next.calories >= 1000 && next.calories <= 6000;
  const changed = (Object.keys(next) as (keyof Macros)[]).some((k) => next[k] !== targets[k]);
  const fromMacros = valid ? caloriesFromMacros(next) : 0;
  const set = (k: keyof Macros) => (v: string) => {
    setVals({ ...vals, [k]: v });
    setSaved(false);
  };
  const isPlanDefault = (Object.keys(targets) as (keyof Macros)[]).every((k) => targets[k] === defaultPlan.targets[k]);

  return (
    <>
      <SectionTitle>Daily targets</SectionTitle>
      <Card>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Calories"><UnitInput label="Calories" unit="cal" value={vals.calories} onChange={set('calories')} /></Field>
          <Field label="Protein"><UnitInput label="Protein" unit="g" value={vals.protein} onChange={set('protein')} /></Field>
          <Field label="Carbs"><UnitInput label="Carbs" unit="g" value={vals.carbs} onChange={set('carbs')} /></Field>
          <Field label="Fat"><UnitInput label="Fat" unit="g" value={vals.fat} onChange={set('fat')} /></Field>
        </div>
        {valid && (
          <p className="mt-3 text-xs text-muted">
            These macros add up to {fmt(fromMacros)} cal{Math.abs(fromMacros - next.calories) > 50 ? `, which is ${fmt(Math.abs(fromMacros - next.calories))} cal off your calorie target` : ''}.
          </p>
        )}
        {changed && (
          <button
            disabled={!valid}
            className={`${buttonClass.primary} mt-4 w-full`}
            onClick={() => {
              updateTargets(next);
              setSaved(true);
            }}
          >
            Save targets
          </button>
        )}
        {saved && !changed && <p className="mt-3 text-sm font-semibold text-accent">Saved. New targets apply from today.</p>}
        {!isPlanDefault && !changed && (
          <button className={`${buttonClass.quiet} mt-3`} onClick={() => setVals(toText(defaultPlan.targets))}>
            Use the original plan ({fmt(defaultPlan.targets.calories)} cal)
          </button>
        )}
      </Card>
    </>
  );
}

// ----- Goal --------------------------------------------------------------

function GoalCard() {
  const { profile, goal, updateProfile, updateGoal } = useAppStore();
  const [startDate, setStartDate] = useState(profile.startDate ?? todayStr());
  const [startWeight, setStartWeight] = useState(String(profile.startWeightKg ?? ''));
  const [goalWeight, setGoalWeight] = useState(String(goal.goalWeightKg));
  const [rate, setRate] = useState(String(goal.weeklyRateKg));
  const [saved, setSaved] = useState(false);

  const num = (s: string) => Number(s.replace(',', '.'));
  const sw = num(startWeight);
  const gw = num(goalWeight);
  const r = num(rate);
  const valid = sw >= 30 && sw <= 150 && gw > sw && gw <= 150 && r > 0 && r <= 1;
  const changed =
    startDate !== profile.startDate || sw !== profile.startWeightKg || gw !== goal.goalWeightKg || r !== goal.weeklyRateKg;
  const weeks = valid ? Math.round((gw - sw) / r) : null;
  const touch = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setSaved(false);
  };

  return (
    <>
      <SectionTitle>Your goal</SectionTitle>
      <Card>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Start weight"><UnitInput label="Start weight" unit="kg" value={startWeight} onChange={touch(setStartWeight)} /></Field>
          <Field label="Goal weight"><UnitInput label="Goal weight" unit="kg" value={goalWeight} onChange={touch(setGoalWeight)} /></Field>
          <Field label="Weekly gain"><UnitInput label="Weekly gain" unit="kg/wk" value={rate} onChange={touch(setRate)} /></Field>
          <Field label="Start date">
            <input
              type="date"
              value={startDate}
              max={todayStr()}
              onChange={(e) => touch(setStartDate)(e.target.value || startDate)}
              className={`${inputClass} px-3`}
              aria-label="Start date"
            />
          </Field>
        </div>
        {weeks !== null && <p className="mt-3 text-xs text-muted">That's about {weeks} weeks from start to goal.</p>}
        {changed && (
          <button
            disabled={!valid}
            className={`${buttonClass.primary} mt-4 w-full`}
            onClick={() => {
              updateProfile({ startDate, startWeightKg: Math.round(sw * 10) / 10 });
              updateGoal({ goalWeightKg: gw, weeklyRateKg: r });
              setSaved(true);
            }}
          >
            Save goal
          </button>
        )}
        {saved && !changed && <p className="mt-3 text-sm font-semibold text-accent">Saved.</p>}
      </Card>
    </>
  );
}

// ----- Meal times --------------------------------------------------------

function MealTimesCard() {
  const { slots, setSlotTime } = useAppStore();
  return (
    <>
      <SectionTitle>Meal times</SectionTitle>
      <Card flush>
        <ul className="divide-y divide-line">
          {orderedSlots(slots).map((s) => (
            <li key={s.id} className="px-5 py-3">
              <p className="mb-2 font-semibold">{SLOT_EMOJI[s.id]} {s.label}</p>
              <div className="grid grid-cols-2 gap-2">
                {(['schoolTime', 'homeTime'] as const).map((kind) => (
                  <label key={kind} className="flex items-center gap-1.5 rounded-2xl bg-track px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-accent">
                    <span aria-hidden>{kind === 'schoolTime' ? '🏫' : '🏠'}</span>
                    <input
                      type="time"
                      value={s[kind]}
                      onChange={(e) => e.target.value && setSlotTime(s.id, kind, e.target.value)}
                      className="min-w-0 flex-1 bg-transparent py-1 text-sm font-semibold tabular-nums outline-none"
                      aria-label={`${s.label} time on ${kind === 'schoolTime' ? 'school' : 'home'} days`}
                    />
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-5 py-3 text-xs text-muted">🏫 School days · 🏠 Weekends and holidays. Changes save straight away.</p>
      </Card>
    </>
  );
}

// ----- Food list ---------------------------------------------------------

function FoodListCard() {
  const { settings, setWhey } = useAppStore();
  return (
    <>
      <SectionTitle>Food list</SectionTitle>
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Whey protein</p>
            <p className="text-sm text-muted">Show whey (30 g scoop · 24 g protein) in the food list and protein top-ups.</p>
          </div>
          <Toggle checked={settings.wheyEnabled} onChange={setWhey} label="Whey protein" />
        </div>
      </Card>
    </>
  );
}

// ----- Backup ------------------------------------------------------------

function BackupCard({ onRestored }: { onRestored: () => void }) {
  const state = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ data: AppData; exportedAt: string | null } | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const today = todayStr();
  const last = state.settings.lastBackupDate;
  const daysSince = last ? differenceInCalendarDays(fromDateStr(today), fromDateStr(last)) : null;

  function exportNow() {
    const blob = new Blob([JSON.stringify(makeBackup(state), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName(today);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    state.markBackedUp(today);
    setMessage({ text: `Saved ${backupFileName(today)} to your Downloads.`, ok: true });
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    const result = parseBackup(await file.text());
    if (fileRef.current) fileRef.current.value = '';
    if (result.ok) setPending({ data: result.data, exportedAt: result.exportedAt });
    else setMessage({ text: result.error, ok: false });
  }

  return (
    <>
      <SectionTitle>Backup</SectionTitle>
      <Card>
        <p className="text-sm text-muted">
          {last === null || last === undefined
            ? 'You haven’t made a backup yet. Save one now and then every week or two.'
            : daysSince === 0
              ? 'Last backup: today ✓'
              : `Last backup: ${daysSince} ${daysSince === 1 ? 'day' : 'days'} ago${daysSince! >= 14 ? '. Time for a new one!' : ''}`}
        </p>
        <div className="mt-4 flex gap-2">
          <button className={`${buttonClass.primary} flex-1`} onClick={exportNow}>Export backup</button>
          <button className={`${buttonClass.ghost} flex-1`} onClick={() => fileRef.current?.click()}>Import</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
        {message && <p className={`mt-3 text-sm font-semibold ${message.ok ? 'text-accent' : 'text-warn'}`}>{message.text}</p>}
      </Card>

      <Sheet open={pending !== null} onClose={() => setPending(null)} title="Restore this backup?">
        {pending && (
          <>
            <p className="text-[15px]">
              This replaces everything on this phone with the backup
              {pending.exportedAt ? ` from ${format(new Date(pending.exportedAt), 'd MMM yyyy, h:mm a')}` : ''}:
            </p>
            <ul className="mt-3 space-y-1 rounded-2xl bg-track px-4 py-3 text-sm">
              <li>{Object.keys(pending.data.dayLogs).length} days of meal logs</li>
              <li>{pending.data.weighIns.length} weigh-ins · {pending.data.training.length} training sessions</li>
              <li>{pending.data.meals.length} meals · {fmt(pending.data.targets.calories)} cal target</li>
            </ul>
            <div className="mt-5 flex gap-2">
              <button className={`${buttonClass.ghost} flex-1`} onClick={() => setPending(null)}>Cancel</button>
              <button
                className={`${buttonClass.primary} flex-1`}
                onClick={() => {
                  state.importData(pending.data);
                  setPending(null);
                  onRestored();
                  setMessage({ text: 'Backup restored.', ok: true });
                }}
              >
                Restore
              </button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}

// ----- Reset -------------------------------------------------------------

function ResetCard() {
  const { restoreDefaultPlan, resetAll } = useAppStore();
  const [confirm, setConfirm] = useState<'plan' | 'all' | null>(null);
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState(false);

  return (
    <>
      <SectionTitle>Start over</SectionTitle>
      <Card flush>
        <button className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left active:bg-track rounded-t-3xl" onClick={() => setConfirm('plan')}>
          <span>
            <span className="block font-semibold">Restore default meals</span>
            <span className="block text-sm text-muted">Brings back the original meals, food list and weekly plan</span>
          </span>
        </button>
        <button
          className="flex w-full items-center justify-between gap-3 rounded-b-3xl border-t border-line px-5 py-4 text-left active:bg-track"
          onClick={() => {
            setTyped('');
            setConfirm('all');
          }}
        >
          <span>
            <span className="block font-semibold text-warn">Delete all data</span>
            <span className="block text-sm text-muted">Erase everything on this phone and start fresh</span>
          </span>
        </button>
      </Card>
      {done && <p className="mx-5 text-sm font-semibold text-accent">Default meals restored.</p>}

      <Sheet open={confirm === 'plan'} onClose={() => setConfirm(null)} title="Restore default meals?">
        <p className="text-[15px] text-muted">
          The original meals, food list and weekly plan come back. Meals you added yourself stay. Your logs, weight and targets aren't changed.
        </p>
        <div className="mt-5 flex gap-2">
          <button className={`${buttonClass.ghost} flex-1`} onClick={() => setConfirm(null)}>Cancel</button>
          <button
            className={`${buttonClass.primary} flex-1`}
            onClick={() => {
              restoreDefaultPlan();
              setConfirm(null);
              setDone(true);
            }}
          >
            Restore
          </button>
        </div>
      </Sheet>

      <Sheet open={confirm === 'all'} onClose={() => setConfirm(null)} title="Delete all data?">
        <p className="text-[15px]">
          This erases every meal log, weigh-in, training session and setting on this phone. It can't be undone. Export a backup first if you might want it later.
        </p>
        <label className="mt-4 block text-sm text-muted">
          Type <strong className="text-ink">DELETE</strong> to confirm
          <input value={typed} onChange={(e) => setTyped(e.target.value)} className={`${inputClass} mt-1.5`} autoCapitalize="characters" />
        </label>
        <div className="mt-5 flex gap-2">
          <button className={`${buttonClass.ghost} flex-1`} onClick={() => setConfirm(null)}>Cancel</button>
          <button className={`${buttonClass.danger} flex-1`} disabled={typed.trim().toUpperCase() !== 'DELETE'} onClick={resetAll}>
            Delete everything
          </button>
        </div>
      </Sheet>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}
