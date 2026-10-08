import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { DEFAULT_GEMINI_MODEL, type AnalysedItem } from '../lib/gemini';
import { scaleMacros } from '../lib/totals';
import type { ExtraLog, Food, FoodCategory, Macros } from '../lib/types';
import BarcodeScanner from './BarcodeScanner';
import AiEstimator from './AiEstimator';
import { XIcon } from './icons';
import { buttonClass, fmt, inputClass, Segmented, Sheet, UnitInput } from './ui';

const CATEGORY_LABELS: Record<FoodCategory, string> = {
  saved: 'My saved foods',
  extra: 'Quick extras',
  protein: 'Protein',
  carb: 'Carbs',
  fat: 'Fats',
};
const CATEGORY_ORDER: FoodCategory[] = ['saved', 'extra', 'protein', 'carb', 'fat'];
const QUICK_MULTIPLIERS = [0.5, 1, 1.5, 2];

export type AddTab = 'list' | 'barcode' | 'ai' | 'custom';

interface Props {
  /** Which tab to open on, or null when closed. */
  openTab: AddTab | null;
  onClose: () => void;
  onAdd: (extra: Omit<ExtraLog, 'id'>) => void;
  /** Log one of your library meals (from a matching photo). */
  onLogMeal: (mealId: string) => void;
}

export default function AddExtraSheet({ openTab, onClose, onAdd, onLogMeal }: Props) {
  const { foods, meals, settings, saveFood, deleteFood } = useAppStore();
  const [tab, setTab] = useState<AddTab>(openTab ?? 'list');
  const [lastOpen, setLastOpen] = useState(openTab);
  // Switch to the requested tab each time the sheet opens.
  if (openTab !== lastOpen) {
    setLastOpen(openTab);
    if (openTab) setTab(openTab);
  }

  function add(extra: Omit<ExtraLog, 'id'>) {
    onAdd(extra);
    onClose();
  }

  function addAnalysed(items: { item: AnalysedItem; multiplier: number }[]) {
    for (const { item, multiplier } of items) {
      const base: Macros = { calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat };
      onAdd({ name: item.name, serving: item.portion, base, multiplier });
    }
    onClose();
  }

  return (
    <Sheet open={openTab !== null} onClose={onClose} title="Add food">
      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'list', label: 'Foods' },
          { value: 'barcode', label: 'Barcode' },
          { value: 'ai', label: 'AI' },
          { value: 'custom', label: 'Custom' },
        ]}
      />
      {tab === 'list' && <FoodList foods={foods} wheyEnabled={settings.wheyEnabled} onAdd={add} onDelete={deleteFood} />}
      {tab === 'barcode' && <BarcodeScanner foods={foods} onAdd={add} onSave={saveFood} />}
      {tab === 'ai' && (
        <AiEstimator
          apiKey={settings.geminiApiKey ?? ''}
          model={settings.geminiModel ?? DEFAULT_GEMINI_MODEL}
          meals={meals}
          onAddItems={addAnalysed}
          onLogMeal={(id) => {
            onLogMeal(id);
            onClose();
          }}
        />
      )}
      {tab === 'custom' && <CustomFood onAdd={add} />}
    </Sheet>
  );
}

function FoodList({
  foods,
  wheyEnabled,
  onAdd,
  onDelete,
}: {
  foods: Food[];
  wheyEnabled: boolean;
  onAdd: (e: Omit<ExtraLog, 'id'>) => void;
  onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return foods.filter((f) => (wheyEnabled || !f.isWhey) && (!q || f.name.toLowerCase().includes(q)));
  }, [foods, wheyEnabled, query]);

  return (
    <div>
      <input type="search" placeholder="Search foods" value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputClass} mb-4`} />
      {visible.length === 0 && <p className="py-6 text-center text-sm text-muted">No foods match. Try Barcode or Custom.</p>}
      {CATEGORY_ORDER.map((cat) => {
        const items = visible.filter((f) => f.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat} className="mb-5">
            <h3 className="mb-1.5 text-xs font-bold tracking-wide text-muted uppercase">{CATEGORY_LABELS[cat]}</h3>
            <ul className="space-y-1.5">
              {items.map((f) => {
                const isOpen = selected === f.id;
                return (
                  <li key={f.id} className={`overflow-hidden rounded-2xl ${isOpen ? 'bg-accent-soft' : 'bg-track'}`}>
                    <button
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                      onClick={() => setSelected(isOpen ? null : f.id)}
                      aria-expanded={isOpen}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{f.name}</span>
                        <span className="text-xs text-muted">{f.serving}</span>
                      </span>
                      <span className="shrink-0 text-right text-xs tabular-nums text-muted">
                        <span className="block">{fmt(f.calories)} cal</span>
                        <span className="font-semibold text-protein">{fmt(f.protein, 1)} g protein</span>
                      </span>
                    </button>
                    {isOpen && <ServingPicker food={f} onAdd={onAdd} />}
                    {isOpen && f.category === 'saved' && (
                      <button
                        className="mx-auto mb-3 flex items-center gap-1 text-xs font-semibold text-muted"
                        onClick={() => {
                          onDelete(f.id);
                          setSelected(null);
                        }}
                      >
                        <XIcon size={14} /> Remove from my saved foods
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function ServingPicker({ food, onAdd }: { food: Food; onAdd: (e: Omit<ExtraLog, 'id'>) => void }) {
  const [multiplier, setMultiplier] = useState(1);
  const [customText, setCustomText] = useState('');
  const custom = Number(customText.replace(',', '.'));
  const effective = customText.trim() !== '' && custom > 0 ? custom : multiplier;
  const base: Macros = { calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat };

  return (
    <div className="px-4 pb-4">
      <div className="mb-3 flex gap-1.5">
        {QUICK_MULTIPLIERS.map((m) => (
          <button
            key={m}
            className={`flex-1 rounded-xl py-2 text-sm font-bold transition ${
              customText === '' && multiplier === m ? 'bg-accent text-accent-ink' : 'bg-card'
            }`}
            onClick={() => {
              setMultiplier(m);
              setCustomText('');
            }}
          >
            {m}×
          </button>
        ))}
        <input
          inputMode="decimal"
          placeholder="Other"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          className="w-16 min-w-0 rounded-xl bg-card px-2 py-2 text-center text-sm outline-none focus:ring-2 focus:ring-accent"
          aria-label="Custom number of servings"
        />
      </div>
      <button
        className={`${buttonClass.primary} w-full`}
        onClick={() => onAdd({ name: food.name, serving: food.serving, base, multiplier: effective, foodId: food.id })}
      >
        Add {effective}× · {fmt(scaleMacros(base, effective).calories)} cal · {fmt(scaleMacros(base, effective).protein, 1)} g protein
      </button>
    </div>
  );
}

function CustomFood({ onAdd }: { onAdd: (e: Omit<ExtraLog, 'id'>) => void }) {
  const [name, setName] = useState('');
  const [values, setValues] = useState({ calories: '', protein: '', carbs: '', fat: '' });
  const num = (s: string) => (s.trim() === '' ? 0 : Number(s.replace(',', '.')));
  const macros: Macros = {
    calories: num(values.calories),
    protein: num(values.protein),
    carbs: num(values.carbs),
    fat: num(values.fat),
  };
  const valid =
    name.trim() !== '' && values.calories.trim() !== '' && Object.values(macros).every((n) => Number.isFinite(n) && n >= 0);
  const set = (key: keyof Macros) => (v: string) => setValues({ ...values, [key]: v });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onAdd({ name: name.trim(), serving: '', base: macros, multiplier: 1 });
      }}
      className="space-y-3"
    >
      <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="What did you eat?" aria-label="Food name" />
      <div className="grid grid-cols-2 gap-2">
        <UnitInput label="Calories" placeholder="Calories" unit="cal" value={values.calories} onChange={set('calories')} />
        <UnitInput label="Protein" placeholder="Protein" unit="g" value={values.protein} onChange={set('protein')} />
        <UnitInput label="Carbs" placeholder="Carbs" unit="g" value={values.carbs} onChange={set('carbs')} />
        <UnitInput label="Fat" placeholder="Fat" unit="g" value={values.fat} onChange={set('fat')} />
      </div>
      <p className="text-xs text-muted">A rough guess is fine.</p>
      <button type="submit" disabled={!valid} className={`${buttonClass.primary} w-full`}>Add food</button>
    </form>
  );
}
