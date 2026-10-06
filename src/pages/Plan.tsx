import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAppStore } from '../store/useAppStore';
import { todayStr, WEEKDAY_LABELS, WEEKDAYS, weekdayOf } from '../lib/dates';
import { usesOfMeal } from '../lib/planEdits';
import { mealsForSlot, orderedSlots, plannedWeekTotals } from '../lib/totals';
import type { Meal, SlotConfig, Weekday } from '../lib/types';
import MealEditor from '../components/MealEditor';
import { ChevronDown, ChevronRight, PlusIcon } from '../components/icons';
import { buttonClass, Card, fmt, MacroLine, PageHeader, Segmented, SectionTitle, Sheet, SLOT_EMOJI } from '../components/ui';

type Tab = 'week' | 'meals';

export default function Plan() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'meals' ? 'meals' : 'week';

  return (
    <main>
      <PageHeader title="Plan" subtitle={tab === 'week' ? 'Your default week. Changes apply from today.' : 'Every meal option, by slot'} />
      <Segmented
        className="mx-4 mb-4"
        value={tab}
        onChange={(t) => setParams(t === 'week' ? {} : { tab: t }, { replace: true })}
        options={[
          { value: 'week', label: 'Weekly plan' },
          { value: 'meals', label: 'Meals' },
        ]}
      />
      {tab === 'week' ? <WeekTab /> : <MealsTab />}
    </main>
  );
}

// ----- Weekly plan -----------------------------------------------------

const FULL_DAY: Record<Weekday, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

function WeekTab() {
  const { rotation, meals, slots, targets, setRotationMeal, resetRotation } = useAppStore();
  const today = weekdayOf(todayStr());
  const [day, setDay] = useState<Weekday>(today);
  const [confirmReset, setConfirmReset] = useState(false);

  const { days, average } = plannedWeekTotals(rotation, meals);
  const low = (d: Weekday) => days[d].protein < targets.protein;
  const lowDays = WEEKDAYS.filter(low);
  const t = days[day];

  return (
    <>
      {/* Weekly average */}
      <Card>
        <p className="text-sm font-semibold text-muted">Average day this week</p>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          {(
            [
              ['calories', 'cal', ''],
              ['protein', 'protein', ' g'],
              ['carbs', 'carbs', ' g'],
              ['fat', 'fat', ' g'],
            ] as const
          ).map(([k, label, unit]) => (
            <div key={k}>
              <div className={`text-lg font-extrabold tabular-nums ${k === 'protein' ? 'text-protein' : ''}`}>
                {fmt(average[k])}
                <span className="text-xs font-semibold">{unit}</span>
              </div>
              <div className="text-[11px] text-muted">{label}</div>
              <div className="text-[11px] text-muted tabular-nums">of {fmt(targets[k])}</div>
            </div>
          ))}
        </div>
        <p className={`mt-4 rounded-2xl px-3 py-2 text-sm ${lowDays.length ? 'bg-warn-soft' : 'bg-accent-soft'}`}>
          {lowDays.length === 0
            ? `✓ Every day reaches ${targets.protein} g protein`
            : `${lowDays.map((d) => WEEKDAY_LABELS[d]).join(', ')} ${lowDays.length === 1 ? 'is' : 'are'} under ${targets.protein} g protein`}
        </p>
      </Card>

      {/* Day picker */}
      <div className="mx-4 mt-5 mb-3 grid grid-cols-7 gap-1.5" role="tablist" aria-label="Day of the week">
        {WEEKDAYS.map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={day === d}
            onClick={() => setDay(d)}
            className={`relative flex flex-col items-center rounded-2xl py-2.5 transition ${
              day === d ? 'bg-accent text-accent-ink shadow-float' : 'bg-card shadow-card'
            }`}
          >
            <span className="text-xs font-bold">{WEEKDAY_LABELS[d]}</span>
            <span className={`text-[10px] tabular-nums ${day === d ? 'text-accent-ink/80' : 'text-muted'}`}>{fmt(days[d].calories)}</span>
            {low(d) && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-warn" aria-label="under protein target" />}
            {d === today && <span className={`mt-1 h-1 w-1 rounded-full ${day === d ? 'bg-accent-ink' : 'bg-accent'}`} aria-label="today" />}
          </button>
        ))}
      </div>

      {/* Selected day */}
      <Card flush>
        <div className="px-5 pt-4 pb-3">
          <h2 className="text-lg font-bold">{FULL_DAY[day]}</h2>
          <MacroLine m={t} />
          {low(day) && (
            <p className="mt-1 text-sm font-medium text-warn">
              {fmt(targets.protein - t.protein, 1)} g short of {targets.protein} g protein. Try a higher-protein swap.
            </p>
          )}
        </div>
        <ul className="divide-y divide-line border-t border-line">
          {orderedSlots(slots).map((slot) => {
            const current = meals.find((m) => m.id === rotation[day][slot.id]);
            return (
              <li key={slot.id} className="relative flex items-center gap-3 px-4 py-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-track text-xl">{SLOT_EMOJI[slot.id]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-muted">{slot.label}</span>
                  <span className="block truncate font-semibold">{current?.name ?? 'Choose a meal'}</span>
                </span>
                <ChevronDown className="shrink-0 text-muted" />
                {/* Native picker on top of the row: tap anywhere to change */}
                <select
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label={`${FULL_DAY[day]} ${slot.label}`}
                  value={rotation[day][slot.id]}
                  onChange={(e) => setRotationMeal(day, slot.id, e.target.value)}
                >
                  {mealsForSlot(meals, slot.id).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {fmt(m.calories)} cal · {fmt(m.protein)} g protein
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="mt-4 text-center">
        <button className={buttonClass.quiet} onClick={() => setConfirmReset(true)}>
          Reset to the original plan
        </button>
      </div>

      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset your weekly plan?">
        <p className="text-[15px] text-muted">Every day goes back to the original plan. Your meals and past days stay as they are.</p>
        <div className="mt-5 flex gap-2">
          <button className={`${buttonClass.ghost} flex-1`} onClick={() => setConfirmReset(false)}>Cancel</button>
          <button
            className={`${buttonClass.primary} flex-1`}
            onClick={() => {
              resetRotation();
              setConfirmReset(false);
            }}
          >
            Reset
          </button>
        </div>
      </Sheet>
    </>
  );
}

// ----- Meal library ----------------------------------------------------

type Editing = { slot: SlotConfig; meal?: Meal } | null;

function MealsTab() {
  const { meals, slots, rotation, addMeal, updateMeal, deleteMeal } = useAppStore();
  const [editing, setEditing] = useState<Editing>(null);

  return (
    <>
      {orderedSlots(slots).map((slot) => {
        const options = mealsForSlot(meals, slot.id);
        return (
          <div key={slot.id}>
            <SectionTitle
              right={
                <button className={buttonClass.quiet} onClick={() => setEditing({ slot })}>
                  <PlusIcon size={16} /> Add
                </button>
              }
            >
              {SLOT_EMOJI[slot.id]} {slot.label}
            </SectionTitle>
            <Card flush>
              <ul className="divide-y divide-line">
                {options.map((meal) => {
                  const days = usesOfMeal(rotation, meal.id).map((u) => WEEKDAY_LABELS[u.day]);
                  return (
                    <li key={meal.id}>
                      <button className="flex w-full items-center gap-3 px-5 py-3.5 text-left active:bg-track" onClick={() => setEditing({ slot, meal })}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{meal.name}</span>
                          <MacroLine m={meal} />
                          {days.length > 0 && <span className="mt-0.5 block text-xs text-muted">Planned: {days.join(', ')}</span>}
                        </span>
                        <ChevronRight className="shrink-0 text-muted" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        );
      })}

      {editing && (
        <MealEditor
          key={editing.meal?.id ?? `new-${editing.slot.id}`}
          slot={editing.slot}
          meal={editing.meal}
          meals={meals}
          rotation={rotation}
          onClose={() => setEditing(null)}
          onSave={(values) => {
            if (editing.meal) updateMeal({ ...editing.meal, ...values });
            else addMeal({ ...values, slot: editing.slot.id });
            setEditing(null);
          }}
          onDelete={(replacementId) => {
            if (editing.meal) deleteMeal(editing.meal.id, replacementId);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
