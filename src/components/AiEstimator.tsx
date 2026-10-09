import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { analyseMeal, friendlyError, type AnalysedItem, type PhotoAnalysis } from '../lib/gemini';
import { prepareImage, type PreparedImage } from '../lib/image';
import { scaleMacros, sumMacros } from '../lib/totals';
import type { Meal } from '../lib/types';
import { CameraIcon, CheckIcon, ImageIcon, NoteIcon, SparkleIcon, XIcon } from './icons';
import { buttonClass, fmt, inputClass, MacroLine } from './ui';

const MULTIPLIERS = [0.5, 1, 1.5, 2];
const EXAMPLES = ['Pav bhaji with 2 buttered pav', 'Subway 6-inch veggie with cheese', 'Mango lassi, 300 ml'];

/** AI estimate from a description, a photo, or both. */
export default function AiEstimator({
  apiKey,
  model,
  meals,
  onAddItems,
  onLogMeal,
}: {
  apiKey: string;
  model: string;
  meals: Meal[];
  onAddItems: (items: { item: AnalysedItem; multiplier: number }[]) => void;
  onLogMeal: (mealId: string) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PhotoAnalysis | null>(null);
  const [picks, setPicks] = useState<{ include: boolean; multiplier: number }[]>([]);

  if (!apiKey) {
    return (
      <div className="rounded-2xl bg-track px-4 py-5 text-center">
        <SparkleIcon size={32} className="mx-auto text-accent" />
        <p className="mt-2 font-bold">Set up AI estimates</p>
        <p className="mt-1 text-sm text-muted">
          Add your Gemini API key in Settings, then describe or photograph any meal to estimate its macros.
        </p>
        <Link to="/settings" className={`${buttonClass.primary} mt-4 w-full`}>Open Settings</Link>
      </div>
    );
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      setImage(await prepareImage(file));
    } catch {
      setError('Couldn’t open that photo. Try another one.');
    }
  }

  async function analyse() {
    if (!image && !note.trim()) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    try {
      const analysis = await analyseMeal({
        apiKey,
        model,
        image: image && { base64: image.base64, mimeType: image.mimeType },
        note,
        meals,
        signal: controller.signal,
      });
      setResult(analysis);
      setPicks(analysis.items.map(() => ({ include: true, multiplier: 1 })));
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(friendlyError(e));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  const matched = result?.matchedMealId ? meals.find((m) => m.id === result.matchedMealId) : undefined;
  const chosen = result ? result.items.map((item, i) => ({ item, ...picks[i] })).filter((p) => p.include) : [];
  const total = sumMacros(chosen.map((p) => scaleMacros(p.item, p.multiplier)));

  return (
    <div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />

      {!result && (
        <>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className={inputClass}
            placeholder={image ? 'Anything the photo can’t show? e.g. 3 rotli, cooked in 2 tsp ghee' : 'Describe what you ate, with amounts if you know them'}
            aria-label="Describe your food"
            disabled={busy}
          />
          {!image && !note && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button key={ex} onClick={() => setNote(ex)} className="rounded-full bg-track px-3 py-1.5 text-xs font-medium text-muted">
                  {ex}
                </button>
              ))}
            </div>
          )}

          {image ? (
            <div className="relative mt-3 overflow-hidden rounded-3xl">
              <img src={image.previewUrl} alt="Your meal" className="max-h-56 w-full object-cover" />
              {!busy && (
                <button
                  onClick={() => setImage(null)}
                  className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold text-white"
                >
                  <XIcon size={14} /> Remove
                </button>
              )}
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className={buttonClass.ghost} onClick={() => cameraRef.current?.click()} disabled={busy}>
                <CameraIcon size={18} /> Add photo
              </button>
              <button className={buttonClass.ghost} onClick={() => galleryRef.current?.click()} disabled={busy}>
                <ImageIcon size={18} /> From gallery
              </button>
            </div>
          )}

          {busy ? (
            <div className="mt-3" aria-live="polite">
              <div className="flex items-center gap-2.5 text-[0.9375rem]">
                <SparkleIcon size={18} className="animate-pulse text-accent" />
                <span className="flex-1">{image ? 'Looking at your meal…' : 'Working out the macros…'}</span>
                <button className="text-sm font-semibold text-muted" onClick={() => abortRef.current?.abort()}>Cancel</button>
              </div>
              <div className="mt-3 space-y-2" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="shimmer h-14 rounded-2xl" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </div>
            </div>
          ) : (
            <button className={`${buttonClass.primary} mt-3 w-full`} onClick={analyse} disabled={!image && !note.trim()}>
              <SparkleIcon size={18} /> Estimate macros
            </button>
          )}
        </>
      )}

      {error && <p className="mt-3 rounded-2xl bg-warn-soft px-4 py-3 text-sm">{error}</p>}

      {result && (
        <div className="mt-4">
          {matched && (
            <div className="mb-4 rounded-2xl bg-accent-soft px-4 py-3">
              <p className="text-sm text-muted">Looks like your</p>
              <p className="font-bold">{matched.name}</p>
              <MacroLine m={matched} />
              <button className={`${buttonClass.primary} mt-3 w-full`} onClick={() => onLogMeal(matched.id)}>
                <CheckIcon size={18} /> Log as {matched.name}
              </button>
            </div>
          )}

          {result.items.length === 0 ? (
            <p className="rounded-2xl bg-track px-4 py-3 text-sm">{result.notes || 'No food found to estimate.'}</p>
          ) : (
            <>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-bold">{matched ? 'Or add these items' : 'Gemini\u2019s estimate'}</h3>
                <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${result.confidence === 'high' ? 'bg-accent-soft text-accent' : 'bg-track text-muted'}`}>
                  {result.confidence} confidence
                </span>
              </div>
              <ul className="space-y-2">
                {result.items.map((item, i) => {
                  const p = picks[i];
                  return (
                    <li key={i} className={`rounded-2xl px-4 py-3 transition ${p.include ? 'bg-track' : 'bg-track/40 opacity-60'}`}>
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => setPicks(picks.map((x, j) => (j === i ? { ...x, include: !x.include } : x)))}
                          aria-pressed={p.include}
                          aria-label={`${p.include ? 'Remove' : 'Include'} ${item.name}`}
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 ${p.include ? 'border-accent bg-accent text-accent-ink' : 'border-line text-transparent'}`}
                        >
                          <CheckIcon size={14} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-xs text-muted">{item.portion}</p>
                          <MacroLine m={scaleMacros(item, p.multiplier)} />
                        </div>
                      </div>
                      {p.include && (
                        <div className="mt-2 flex gap-1.5 pl-9">
                          {MULTIPLIERS.map((m) => (
                            <button
                              key={m}
                              onClick={() => setPicks(picks.map((x, j) => (j === i ? { ...x, multiplier: m } : x)))}
                              className={`rounded-lg px-2.5 py-1 text-xs font-bold ${p.multiplier === m ? 'bg-accent text-accent-ink' : 'bg-card'}`}
                            >
                              {m}×
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {result.notes && <p className="mt-3 flex gap-2 text-sm text-muted"><NoteIcon size={16} className="mt-0.5 shrink-0" />{result.notes}</p>}
              <button
                className={`${buttonClass.primary} mt-4 w-full`}
                disabled={chosen.length === 0}
                onClick={() => onAddItems(chosen.map(({ item, multiplier }) => ({ item, multiplier })))}
              >
                Add {chosen.length} {chosen.length === 1 ? 'item' : 'items'} · {fmt(total.calories)} cal · {fmt(total.protein)} g protein
              </button>
            </>
          )}
          <button
            className={`${buttonClass.quiet} mt-3`}
            onClick={() => {
              setResult(null);
              setImage(null);
              setNote('');
            }}
          >
            Start over
          </button>
        </div>
      )}

      <p className="mt-4 text-center text-xs leading-relaxed text-muted">
        AI estimates can be off by 20–30%. Adjust portions if needed.
        <br />
        Descriptions and photos are sent to Google Gemini.
      </p>
    </div>
  );
}
