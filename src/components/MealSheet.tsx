import { formatTime } from '../lib/dates';
import { findMeal, mealsForSlot } from '../lib/totals';
import type { DayLog, Meal, SlotConfig, SlotStatus } from '../lib/types';
import { CheckIcon, SkipIcon, UndoIcon } from './icons';
import { buttonClass, MacroGrid, MacroLine, Sheet } from './ui';

/** Details for one meal slot: macros, ingredients, tick / skip, and swap options. */
export default function MealSheet({
  slot,
  log,
  meals,
  onClose,
  onStatus,
  onSwap,
}: {
  slot: SlotConfig | null;
  log: DayLog;
  meals: Meal[];
  onClose: () => void;
  onStatus: (status: SlotStatus) => void;
  onSwap: (mealId: string) => void;
}) {
  if (!slot) return null;
  const entry = log.slots[slot.id];
  const school = log.dayType === 'school';
  const meal = entry.meal;
  const ingredients = meal && findMeal(meals, meal.mealId)?.ingredients;
  const options = mealsForSlot(meals, slot.id).filter((m) => m.id !== meal?.mealId);
  const eaten = entry.status === 'eaten';
  const skipped = entry.status === 'skipped';

  return (
    <Sheet open onClose={onClose} title={meal?.name ?? 'Choose a meal'}>
      <p className="-mt-1 mb-4 text-sm text-muted">
        {school ? slot.label : slot.homeLabel} · {formatTime(school ? slot.schoolTime : slot.homeTime)}
        {slot.note && school && <span className="ml-2 rounded-md bg-track px-1.5 py-0.5 text-xs">{slot.note}</span>}
      </p>

      {meal && (
        <>
          <MacroGrid m={meal} />
          {ingredients && <p className="mt-4 text-[15px] leading-relaxed">{ingredients}</p>}

          <div className="mt-5 flex gap-2">
            {!skipped && (
              <button
                className={`${eaten ? buttonClass.ghost : buttonClass.primary} flex-1`}
                onClick={() => {
                  onStatus(eaten ? 'planned' : 'eaten');
                  onClose();
                }}
              >
                {eaten ? <><UndoIcon size={18} /> Not eaten</> : <><CheckIcon size={18} /> Mark as eaten</>}
              </button>
            )}
            {!eaten && (
              <button
                className={`${buttonClass.ghost} ${skipped ? 'flex-1' : ''}`}
                onClick={() => {
                  onStatus(skipped ? 'planned' : 'skipped');
                  onClose();
                }}
              >
                {skipped ? <><UndoIcon size={18} /> Undo skip</> : <><SkipIcon size={18} /> Skip</>}
              </button>
            )}
          </div>
        </>
      )}

      {options.length > 0 && (
        <>
          <h3 className="mt-6 mb-2 text-sm font-bold">{meal ? 'Swap for today' : 'Pick a meal'}</h3>
          <ul className="space-y-2">
            {options.map((m) => (
              <li key={m.id}>
                <button
                  className="flex w-full items-center justify-between gap-3 rounded-2xl bg-track px-4 py-3 text-left transition active:scale-[0.99]"
                  onClick={() => {
                    onSwap(m.id);
                    onClose();
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{m.name}</span>
                    <MacroLine m={m} />
                  </span>
                  {m.id === entry.plannedMealId && (
                    <span className="shrink-0 rounded-lg bg-card px-2 py-1 text-xs font-semibold text-muted">Planned</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}
