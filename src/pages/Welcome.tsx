import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAppStore } from '../store/useAppStore';
import { todayStr } from '../lib/dates';
import { buttonClass, fmt, UnitInput } from '../components/ui';

export default function Welcome() {
  const goal = useAppStore((s) => s.goal);
  const targets = useAppStore((s) => s.targets);
  const completeSetup = useAppStore((s) => s.completeSetup);
  const navigate = useNavigate();
  const [weight, setWeight] = useState('');
  const [startDate, setStartDate] = useState(todayStr());

  const kg = Number(weight.replace(',', '.'));
  const valid = weight.trim() !== '' && kg >= 30 && kg <= 150;
  const weeks = valid && kg < goal.goalWeightKg ? Math.round((goal.goalWeightKg - kg) / goal.weeklyRateKg) : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    completeSetup(startDate, Math.round(kg * 10) / 10);
    navigate('/', { replace: true });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <section className="rounded-b-[36px] bg-gradient-to-br from-hero-from to-hero-to px-6 pt-14 pb-10 text-white">
        <p className="text-5xl">💪</p>
        <h1 className="mt-4 text-[32px] leading-tight font-extrabold tracking-tight">Let's start your bulk</h1>
        <p className="mt-2 text-[15px] text-white/90">Your plan is ready. Here's what you're aiming for:</p>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            [fmt(targets.calories), 'calories'],
            [`${targets.protein} g`, 'protein'],
            [`${goal.goalWeightKg} kg`, 'goal weight'],
          ].map(([v, l]) => (
            <div key={l} className="rounded-2xl bg-white/15 px-2 py-3">
              <div className="text-lg font-extrabold">{v}</div>
              <div className="text-xs text-white/80">{l}</div>
            </div>
          ))}
        </div>
      </section>

      <form onSubmit={submit} className="flex flex-1 flex-col px-6 pt-8 pb-10">
        <label className="block">
          <span className="font-bold">This morning's weight</span>
          <UnitInput className="mt-2" label="Weight in kg" placeholder="e.g. 55.0" unit="kg" value={weight} onChange={setWeight} autoFocus />
          <span className="mt-2 block text-sm text-muted">After waking and using the toilet, before eating or drinking.</span>
        </label>

        <label className="mt-6 block">
          <span className="font-bold">Start date</span>
          <input
            type="date"
            value={startDate}
            max={todayStr()}
            onChange={(e) => setStartDate(e.target.value || todayStr())}
            className="mt-2 w-full rounded-2xl bg-track px-4 py-3 outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        {weeks !== null && (
          <p className="mt-6 rounded-2xl bg-accent-soft px-4 py-3 text-[15px]">
            Reaching <strong>{goal.goalWeightKg} kg</strong> takes about <strong>{weeks} weeks</strong>. Slow and steady builds
            mostly muscle.
          </p>
        )}

        <button type="submit" disabled={!valid} className={`${buttonClass.primary} mt-auto w-full py-4 text-base`}>
          Start my plan
        </button>
      </form>
    </main>
  );
}
