import { useRef, useState, type ReactNode } from 'react';
import { differenceInCalendarDays, format } from 'date-fns';
import { useAppStore } from '../store/useAppStore';
import { defaultPlan } from '../data/plan';
import { backupFileName, makeBackup, parseBackup } from '../lib/backup';
import { DEFAULT_GEMINI_MODEL, friendlyError, GEMINI_MODELS, testGeminiKey } from '../lib/gemini';
import { DEFAULT_PIN_HASH, hashPin, verifyPin } from '../lib/lock';
import PinPad from '../components/PinPad';
import { HomeIcon, SchoolIcon } from '../components/icons';
import { fromDateStr, todayStr } from '../lib/dates';
import { caloriesFromMacros, orderedSlots } from '../lib/totals';
import type { AppData } from '../lib/storage';
import type { Macros } from '../lib/types';
import { buttonClass, Card, fmt, inputClass, PageHeader, SectionTitle, Segmented, Sheet, Toggle, UnitInput } from '../components/ui';

export default function Settings() {
  // Bumped after a backup is restored, so the forms reload their values.
  const [version, setVersion] = useState(0);
  return (
    <main>
      <PageHeader title="Settings" />
      <AppearanceCard />
      <TargetsCard key={`t${version}`} />
      <GoalCard key={`g${version}`} />
      <MealTimesCard />
      <FoodListCard />
      <AiCard />
      <SecurityCard />
      <BackupCard onRestored={() => setVersion((v) => v + 1)} />
      <ResetCard />
      <p className="mx-5 mt-6 text-center text-xs text-muted">
        Everything is saved on this phone only. No account, no server.
      </p>
    </main>
  );
}

// ----- Appearance ----------------------------------------------------------

function AppearanceCard() {
  const theme = useAppStore((s) => s.settings.theme ?? 'dark');
  const setTheme = useAppStore((s) => s.setTheme);
  return (
    <>
      <SectionTitle>Appearance</SectionTitle>
      <Card>
        <Segmented
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'system', label: 'Match phone' },
          ]}
        />
      </Card>
    </>
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
              <p className="mb-2 font-semibold">{s.label}</p>
              <div className="grid grid-cols-2 gap-2">
                {(['schoolTime', 'homeTime'] as const).map((kind) => (
                  <label key={kind} className="flex items-center gap-1.5 rounded-2xl bg-track px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-accent">
                    <span className="text-muted" aria-hidden>{kind === 'schoolTime' ? <SchoolIcon size={16} /> : <HomeIcon size={16} />}</span>
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
        <p className="border-t border-line px-5 py-3 text-xs text-muted">School days and home days (weekends, holidays). Changes save straight away.</p>
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

// ----- AI photo analysis -------------------------------------------------

function AiCard() {
  const { settings, setGeminiKey, setGeminiModel } = useAppStore();
  const saved = settings.geminiApiKey ?? '';
  const model = settings.geminiModel ?? DEFAULT_GEMINI_MODEL;
  const [key, setKey] = useState(saved);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [testing, setTesting] = useState(false);

  async function saveAndTest() {
    setGeminiKey(key);
    if (!key.trim()) {
      setStatus({ text: 'Key removed. Photo analysis is off.', ok: true });
      return;
    }
    setTesting(true);
    setStatus(null);
    try {
      await testGeminiKey(key.trim(), model);
      setStatus({ text: 'Key works. AI estimates are ready.', ok: true });
    } catch (e) {
      setStatus({ text: friendlyError(e), ok: false });
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <SectionTitle>AI photo analysis</SectionTitle>
      <Card>
        <p className="text-sm text-muted">
          Snap a home meal and Gemini estimates its macros. Uses your own free Gemini API key from Google AI Studio.
        </p>
        <div className="mt-3 flex items-center rounded-2xl border border-transparent bg-track transition focus-within:border-accent focus-within:bg-card">
          <input
            type={show ? 'text' : 'password'}
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setStatus(null);
            }}
            placeholder="Paste your Gemini API key"
            autoComplete="off"
            spellCheck={false}
            className="w-full min-w-0 bg-transparent px-4 py-3 text-[0.9375rem] outline-none placeholder:text-muted/70"
            aria-label="Gemini API key"
          />
          <button type="button" className="pr-4 text-sm font-semibold text-accent" onClick={() => setShow(!show)}>
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
        <label className="mt-2 block">
          <span className="mb-1 block text-xs font-semibold text-muted">Model</span>
          <select value={model} onChange={(e) => setGeminiModel(e.target.value)} className={inputClass}>
            {GEMINI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}: {m.hint}</option>
            ))}
          </select>
        </label>
        <button className={`${buttonClass.primary} mt-3 w-full`} disabled={testing || (!key.trim() && !saved) || (key.trim() === saved && !!saved && status?.ok)} onClick={saveAndTest}>
          {testing ? 'Checking…' : key.trim() !== saved ? 'Save key' : 'Test key'}
        </button>
        {status && <p className={`mt-2 text-sm font-semibold ${status.ok ? 'text-accent' : 'text-warn'}`}>{status.text}</p>}
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Your key is stored only on this phone and is never included in backups. Photos go straight to Google. On Gemini's free tier,
          Google may use them to improve its products, so only photograph food.
        </p>
      </Card>
    </>
  );
}

// ----- Passcode lock -----------------------------------------------------

type PinStep = 'current' | 'new' | 'confirm' | 'done';

function SecurityCard() {
  const { settings, setLockEnabled, setPinHash } = useAppStore();
  const lockOn = settings.lockEnabled ?? true;
  const pinHash = settings.pinHash ?? DEFAULT_PIN_HASH;
  const [step, setStep] = useState<PinStep | null>(null);
  const [newPin, setNewPin] = useState('');
  const [mismatch, setMismatch] = useState(false);

  const titles: Record<PinStep, string> = {
    current: 'Enter your current passcode',
    new: 'Choose a new 4-digit passcode',
    confirm: 'Enter it again to confirm',
    done: 'Passcode changed',
  };

  return (
    <>
      <SectionTitle>Passcode lock</SectionTitle>
      <Card flush>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="font-semibold">Require passcode</p>
            <p className="text-sm text-muted">Asks for your passcode when the app opens, and after a minute away.</p>
          </div>
          <Toggle checked={lockOn} onChange={setLockEnabled} label="Require passcode" />
        </div>
        <button
          className="w-full rounded-b-3xl border-t border-line px-5 py-4 text-left font-semibold text-accent active:bg-track"
          onClick={() => {
            setMismatch(false);
            setStep('current');
          }}
        >
          Change passcode
        </button>
      </Card>
      <p className="mx-5 -mt-1 text-xs text-muted">
        A privacy screen for your phone. It isn't encryption, so still keep backups somewhere safe.
      </p>

      <Sheet open={step !== null} onClose={() => setStep(null)} title={step ? titles[step] : ''}>
        {step === 'done' ? (
          <button className={`${buttonClass.primary} w-full`} onClick={() => setStep(null)}>Done</button>
        ) : step ? (
          <div className="pt-4 pb-2">
            <p className="mb-6 h-5 text-center text-sm text-warn">{mismatch ? 'That didn’t match. Try again.' : ''}</p>
            <PinPad
              key={step}
              onComplete={(pin) => {
                if (step === 'current') {
                  if (!verifyPin(pin, pinHash)) return false;
                  setMismatch(false);
                  setStep('new');
                } else if (step === 'new') {
                  setNewPin(pin);
                  setStep('confirm');
                } else if (step === 'confirm') {
                  if (pin !== newPin) {
                    setMismatch(true);
                    setStep('new');
                    return false;
                  }
                  setPinHash(hashPin(pin));
                  setMismatch(false);
                  setStep('done');
                }
              }}
            />
          </div>
        ) : null}
      </Sheet>
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
              ? 'Last backup: today'
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
            <p className="text-[0.9375rem]">
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
        <p className="text-[0.9375rem] text-muted">
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
        <p className="text-[0.9375rem]">
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
