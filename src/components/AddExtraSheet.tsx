import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAppStore } from '../store/useAppStore';
import { DEFAULT_GEMINI_MODEL, type AnalysedItem } from '../lib/gemini';
import { FOOD_DATABASE_CREDIT, loadFoodDatabase, searchFoods, type DbFood } from '../lib/foodDatabase';
import { macrosForGrams } from '../lib/openFoodFacts';
import { scaleMacros } from '../lib/totals';
import type { ExtraLog, Food, Macros } from '../lib/types';
import BarcodeScanner from './BarcodeScanner';
import AiEstimator from './AiEstimator';
import { XIcon } from './icons';
import { buttonClass, fmt, inputClass, Segmented, Sheet, UnitInput } from './ui';

const QUICK_MULTIPLIERS = [0.5, 1, 1.5, 2];
const QUICK_AMOUNTS = { g: [50, 100, 150, 200], ml: [100, 200, 250, 300] };

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
      {tab === 'list' && <FoodList saved={foods} onAdd={add} onDelete={deleteFood} />}
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
  saved,
  onAdd,
  onDelete,
}: {
  saved: Food[];
  onAdd: (e: Omit<ExtraLog, 'id'>) => void;
  onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [database, setDatabase] = useState<DbFood[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let live = true;
    loadFoodDatabase()
      .then((foods) => live && setDatabase(foods))
      .catch(() => live && setLoadError(true));
    return () => {
      live = false;
    };
  }, []);

  const q = query.trim();
  const savedMatches = useMemo(() => (q ? searchFoods(saved, q, 10) : saved), [saved, q]);
  const results = useMemo(() => (q && database ? searchFoods(database, q) : []), [database, q]);
  const toggle = (id: string) => setSelected(selected === id ? null : id);

  return (
    <div>
      <input
        type="search"
        placeholder={database ? `Search ${fmt(database.length)} foods` : 'Search foods'}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
        }}
        className={`${inputClass} mb-4`}
        aria-label="Search foods"
      />

      {savedMatches.length > 0 && (
        <FoodGroup title="My saved foods">
          {savedMatches.map((f) => (
            <FoodItem key={f.id} name={f.name} detail={f.serving} macros={f} open={selected === f.id} onToggle={() => toggle(f.id)}>
              <ServingPicker food={f} onAdd={onAdd} />
              <button
                className="mx-auto mb-3 flex items-center gap-1 text-xs font-semibold text-muted"
                onClick={() => {
                  onDelete(f.id);
                  setSelected(null);
                }}
              >
                <XIcon size={14} /> Remove from my saved foods
              </button>
            </FoodItem>
          ))}
        </FoodGroup>
      )}

      {results.length > 0 && (
        <FoodGroup title="Food database">
          {results.map((f) => (
            <FoodItem
              key={f.id}
              name={f.name}
              detail={`per 100 ${f.unit === 'ml' ? 'mL' : 'g'}`}
              macros={f}
              open={selected === f.id}
              onToggle={() => toggle(f.id)}
            >
              <AmountPicker food={f} onAdd={onAdd} />
            </FoodItem>
          ))}
        </FoodGroup>
      )}

      {q && database && results.length === 0 && savedMatches.length === 0 && (
        <p className="py-6 text-center text-sm text-muted">No foods match. Try fewer words, or use Barcode, AI or Custom.</p>
      )}
      {q && !database && !loadError && <p className="py-6 text-center text-sm text-muted">Loading foods…</p>}
      {loadError && <p className="py-6 text-center text-sm text-muted">Couldn’t load the food list. Check your connection and try again.</p>}
      {!q && (
        <p className="py-4 text-center text-sm text-muted">
          Search everyday foods like “chickpea”, “milk” or “rice”.
          <br />
          For Indian dishes or branded packets, try AI or Barcode.
        </p>
      )}

      <p className="mt-2 text-center text-[0.6875rem] leading-snug text-muted">
        Food data: {FOOD_DATABASE_CREDIT}. Vegetarian foods only; energy shown in calories.
      </p>
    </div>
  );
}

function FoodGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="mb-1.5 text-xs font-bold tracking-wide text-muted uppercase">{title}</h3>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function FoodItem({
  name,
  detail,
  macros,
  open,
  onToggle,
  children,
}: {
  name: string;
  detail: string;
  macros: Macros;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <li className={`overflow-hidden rounded-2xl ${open ? 'bg-accent-soft' : 'bg-track'}`}>
      <button className="pressable flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={onToggle} aria-expanded={open}>
        <span className="min-w-0">
          <span className="line-clamp-2 leading-snug font-semibold">{name}</span>
          <span className="text-xs text-muted">{detail}</span>
        </span>
        <span className="shrink-0 text-right text-xs tabular-nums text-muted">
          <span className="block">{fmt(macros.calories)} cal</span>
          <span className="font-semibold text-protein">{fmt(macros.protein, 1)} g protein</span>
        </span>
      </button>
      {open && children}
    </li>
  );
}

/** Pick an amount in grams (or mL for drinks) for a database food. */
function AmountPicker({ food, onAdd }: { food: DbFood; onAdd: (e: Omit<ExtraLog, 'id'>) => void }) {
  const unit = food.unit === 'ml' ? 'mL' : 'g';
  const [text, setText] = useState('100');
  const amount = Number(text.replace(',', '.'));
  const macros = Number.isFinite(amount) && amount > 0 && amount <= 5000 ? macrosForGrams(food, amount) : null;
  const label = `${fmt(amount, 1)} ${unit}`;

  return (
    <div className="px-4 pb-4">
      <div className="mb-3 flex gap-1.5">
        {QUICK_AMOUNTS[food.unit].map((a) => (
          <button
            key={a}
            className={`pressable flex-1 rounded-xl py-2 text-sm font-bold transition ${amount === a ? 'bg-accent text-accent-ink' : 'bg-card'}`}
            onClick={() => setText(String(a))}
          >
            {a}
          </button>
        ))}
        <label className="flex w-24 min-w-0 items-center rounded-xl bg-card focus-within:ring-2 focus-within:ring-accent">
          <input
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full min-w-0 bg-transparent py-2 pl-2 text-right text-sm font-semibold outline-none"
            aria-label={`Amount in ${unit}`}
          />
          <span className="pr-2 pl-1 text-sm text-muted">{unit}</span>
        </label>
      </div>
      <button
        className={`${buttonClass.primary} w-full`}
        disabled={!macros}
        onClick={() => macros && onAdd({ name: food.name, serving: label, base: macros, multiplier: 1, foodId: food.id })}
      >
        {macros ? `Add ${label} · ${fmt(macros.calories)} cal · ${fmt(macros.protein, 1)} g protein` : 'Enter an amount'}
      </button>
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
