import { Link } from 'react-router';
import { adjustTargets, FAST_GAIN_KG, SLOW_GAIN_KG, type CalorieSuggestion } from '../lib/progress';
import type { Macros } from '../lib/types';
import { ChevronRight, SparkIcon } from './icons';
import { buttonClass, fmt } from './ui';

const kg = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)} kg`;

/** The ±200 cal suggestion. `compact` is the one-line nudge for the Today screen. */
export default function SuggestionBanner({
  suggestion,
  targets,
  onAccept,
  onDismiss,
  compact = false,
}: {
  suggestion: CalorieSuggestion;
  targets: Macros;
  onAccept?: () => void;
  onDismiss?: () => void;
  compact?: boolean;
}) {
  const up = suggestion.direction === 'increase';
  const next = adjustTargets(targets, suggestion.deltaCalories);

  if (compact) {
    return (
      <Link to="/progress" className="mx-4 mb-3 flex items-center gap-3 rounded-3xl bg-card p-4 shadow-card active:scale-[0.99]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-protein/15 text-protein">
          <SparkIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Time for a small tweak</span>
          <span className="block text-sm text-muted">Try {up ? '+' : '−'}200 cal a day. Tap to review.</span>
        </span>
        <ChevronRight className="shrink-0 text-muted" />
      </Link>
    );
  }

  return (
    <section className="mx-4 mb-3 rounded-3xl bg-card p-5 shadow-card ring-2 ring-protein/30">
      <div className="flex items-center gap-2 text-sm font-semibold text-protein">
        <SparkIcon size={18} /> Suggestion
      </div>
      <h2 className="mt-1 text-xl font-bold">{up ? 'Add 200 cal a day' : 'Ease back 200 cal a day'}</h2>
      <p className="mt-1 text-[15px] text-muted">
        {up
          ? `Your weekly average moved ${suggestion.weeks.map((w) => kg(w.change!)).join(', then ')}: a little under the ${SLOW_GAIN_KG} kg/week goal. A bit more food should get things moving.`
          : `Your weekly average moved ${suggestion.weeks.map((w) => kg(w.change!)).join(', then ')}: faster than ${FAST_GAIN_KG} kg/week. Slowing a touch keeps the gain mostly muscle.`}
      </p>
      <div className="mt-4 flex items-baseline justify-between rounded-2xl bg-track px-4 py-3">
        <span className="text-sm text-muted">New target</span>
        <span className="text-right">
          <span className="block text-lg font-bold tabular-nums">{fmt(next.calories)} cal</span>
          <span className="block text-xs text-muted tabular-nums">
            {next.protein} g protein · {next.carbs} g carbs · {next.fat} g fat
          </span>
        </span>
      </div>
      <div className="mt-4 flex gap-2">
        <button className={`${buttonClass.ghost} flex-1`} onClick={onDismiss}>Not now</button>
        <button className={`${buttonClass.primary} flex-1`} onClick={onAccept}>Accept</button>
      </div>
      <p className="mt-2.5 text-center text-xs text-muted">Nothing changes unless you accept.</p>
    </section>
  );
}
