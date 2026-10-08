import { useState } from 'react';
import { WEEKDAY_LABELS } from '../lib/dates';
import { usesOfMeal } from '../lib/planEdits';
import { caloriesFromMacros, mealsForSlot } from '../lib/totals';
import type { Macros, Meal, Rotation, SlotConfig } from '../lib/types';
import { TrashIcon } from './icons';
import { buttonClass, fmt, inputClass, Sheet, SlotIcon, UnitInput } from './ui';

type MealValues = Omit<Meal, 'id' | 'slot'>;

/** Add or edit a meal. When editing, a delete option sits at the bottom. */
export default function MealEditor({
  slot,
  meal,
  meals,
  rotation,
  onSave,
  onDelete,
  onClose,
}: {
  slot: SlotConfig;
  meal?: Meal;
  meals: Meal[];
  rotation: Rotation;
  onSave: (values: MealValues) => void;
  onDelete: (replacementId: string) => void;
  onClose: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <Sheet open onClose={onClose} title={meal ? 'Edit meal' : `New ${slot.label.toLowerCase()} meal`}>
      {confirmDelete && meal ? (
        <DeleteMeal meal={meal} meals={meals} slot={slot} rotation={rotation} onConfirm={onDelete} onCancel={() => setConfirmDelete(false)} />
      ) : (
        <MealForm slot={slot} initial={meal} onSave={onSave} onDelete={meal ? () => setConfirmDelete(true) : undefined} />
      )}
    </Sheet>
  );
}

function MealForm({
  slot,
  initial,
  onSave,
  onDelete,
}: {
  slot: SlotConfig;
  initial?: Meal;
  onSave: (v: MealValues) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [ingredients, setIngredients] = useState(initial?.ingredients ?? '');
  const [nums, setNums] = useState({
    calories: initial ? String(initial.calories) : '',
    protein: initial ? String(initial.protein) : '',
    carbs: initial ? String(initial.carbs) : '',
    fat: initial ? String(initial.fat) : '',
  });

  const parse = (s: string) => (s.trim() === '' ? 0 : Number(s.replace(',', '.')));
  const macros: Macros = { calories: parse(nums.calories), protein: parse(nums.protein), carbs: parse(nums.carbs), fat: parse(nums.fat) };
  const valid = name.trim() !== '' && nums.calories.trim() !== '' && Object.values(macros).every((n) => Number.isFinite(n) && n >= 0);
  const fromMacros = caloriesFromMacros(macros);
  const set = (key: keyof Macros) => (v: string) => setNums({ ...nums, [key]: v });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave({ name: name.trim(), ingredients: ingredients.trim(), ...macros });
      }}
    >
      <p className="-mt-1 flex items-center gap-1.5 text-sm text-muted"><SlotIcon slot={slot.id} size={16} /> {slot.label}</p>
      <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Meal name" aria-label="Meal name" />
      <textarea
        value={ingredients}
        onChange={(e) => setIngredients(e.target.value)}
        rows={3}
        className={inputClass}
        placeholder="Ingredients, e.g. 1 wrap, 80 g paneer, salad"
        aria-label="Ingredients"
      />
      <div className="grid grid-cols-2 gap-2">
        <UnitInput label="Calories" placeholder="Calories" unit="cal" value={nums.calories} onChange={set('calories')} />
        <UnitInput label="Protein" placeholder="Protein" unit="g" value={nums.protein} onChange={set('protein')} />
        <UnitInput label="Carbs" placeholder="Carbs" unit="g" value={nums.carbs} onChange={set('carbs')} />
        <UnitInput label="Fat" placeholder="Fat" unit="g" value={nums.fat} onChange={set('fat')} />
      </div>
      {valid && Math.abs(fromMacros - macros.calories) > 25 && (
        <p className="text-xs text-muted">
          Heads up: these macros add up to about {fmt(fromMacros)} cal. The app will use the {fmt(macros.calories)} you entered.
        </p>
      )}
      <button type="submit" disabled={!valid} className={`${buttonClass.primary} w-full`}>
        {initial ? 'Save changes' : 'Add meal'}
      </button>
      {initial && <p className="text-center text-xs text-muted">Changes apply from today. Past days keep what you logged.</p>}
      {onDelete && (
        <button type="button" onClick={onDelete} className="mx-auto mt-2 flex items-center gap-1.5 text-sm font-semibold text-warn">
          <TrashIcon size={16} /> Delete this meal
        </button>
      )}
    </form>
  );
}

function DeleteMeal({
  meal,
  meals,
  slot,
  rotation,
  onConfirm,
  onCancel,
}: {
  meal: Meal;
  meals: Meal[];
  slot: SlotConfig;
  rotation: Rotation;
  onConfirm: (replacementId: string) => void;
  onCancel: () => void;
}) {
  const others = mealsForSlot(meals, meal.slot).filter((m) => m.id !== meal.id);
  const [replacementId, setReplacementId] = useState(others[0]?.id ?? '');
  const uses = usesOfMeal(rotation, meal.id).map((u) => WEEKDAY_LABELS[u.day]);

  if (others.length === 0) {
    return (
      <div>
        <p className="text-[15px]">
          <strong>{meal.name}</strong> is your only {slot.label.toLowerCase()} option. Add another one first, then you can delete this.
        </p>
        <button className={`${buttonClass.ghost} mt-5 w-full`} onClick={onCancel}>Got it</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[15px]">
        Delete <strong>{meal.name}</strong>? Days you already ate it stay in your history.
      </p>
      <label className="block">
        <span className="text-sm text-muted">
          {uses.length ? `It's planned on ${uses.join(', ')}. Use this instead:` : 'If it’s planned for today, use this instead:'}
        </span>
        <select value={replacementId} onChange={(e) => setReplacementId(e.target.value)} className={`${inputClass} mt-1.5`}>
          {others.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </label>
      <div className="flex gap-2 pt-2">
        <button className={`${buttonClass.ghost} flex-1`} onClick={onCancel}>Cancel</button>
        <button className={`${buttonClass.danger} flex-1`} onClick={() => onConfirm(replacementId)}>Delete</button>
      </div>
    </div>
  );
}
