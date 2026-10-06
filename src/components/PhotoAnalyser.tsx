import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { analyseMealPhoto, friendlyError, type AnalysedItem, type PhotoAnalysis } from '../lib/gemini';
import { prepareImage, type PreparedImage } from '../lib/image';
import { scaleMacros, sumMacros } from '../lib/totals';
import type { Meal } from '../lib/types';
import { Spinner } from './BarcodeScanner';
import { CheckIcon } from './icons';
import { buttonClass, fmt, inputClass, MacroLine } from './ui';

const MULTIPLIERS = [0.5, 1, 1.5, 2];

export default function PhotoAnalyser({
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
        <p className="text-3xl">📸</p>
        <p className="mt-2 font-bold">Set up AI photo analysis</p>
        <p className="mt-1 text-sm text-muted">Add your Gemini API key in Settings, then snap a photo of a home meal to estimate its macros.</p>
        <Link to="/settings" className={`${buttonClass.primary} mt-4 w-full`}>Open Settings</Link>
      </div>
    );
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      setImage(await prepareImage(file));
    } catch {
      setError('Couldn’t open that photo. Try another one.');
    }
  }

  async function analyse() {
    if (!image) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    try {
      const analysis = await analyseMealPhoto({
        apiKey,
        model,
        imageBase64: image.base64,
        mimeType: image.mimeType,
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

      {image ? (
        <div className="relative overflow-hidden rounded-3xl">
          <img src={image.previewUrl} alt="Your meal" className="max-h-64 w-full object-cover" />
          {!busy && !result && (
            <button
              onClick={() => {
                setImage(null);
                setResult(null);
              }}
              className="absolute top-2 right-2 rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold text-white"
            >
              Change
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button className="flex flex-col items-center gap-1 rounded-3xl bg-accent-soft px-3 py-6 font-semibold text-accent active:scale-[0.98]" onClick={() => cameraRef.current?.click()}>
            <span className="text-3xl">📷</span> Take photo
          </button>
          <button className="flex flex-col items-center gap-1 rounded-3xl bg-track px-3 py-6 font-semibold active:scale-[0.98]" onClick={() => galleryRef.current?.click()}>
            <span className="text-3xl">🖼️</span> From gallery
          </button>
        </div>
      )}

      {image && !result && (
        <>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={`${inputClass} mt-3`}
            placeholder="Anything the photo can’t show? e.g. 3 rotli, cooked in 2 tsp ghee"
            aria-label="Extra details"
          />
          {busy ? (
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-track px-4 py-3">
              <Spinner />
              <span className="flex-1 text-[15px]">Looking at your meal…</span>
              <button className="text-sm font-semibold text-muted" onClick={() => abortRef.current?.abort()}>Cancel</button>
            </div>
          ) : (
            <button className={`${buttonClass.primary} mt-3 w-full`} onClick={analyse}>
              ✨ Analyse photo
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
            <p className="rounded-2xl bg-track px-4 py-3 text-sm">{result.notes || 'No food found in this photo.'}</p>
          ) : (
            <>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-bold">{matched ? 'Or add what Gemini saw' : 'What Gemini saw'}</h3>
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
              {result.notes && <p className="mt-3 text-sm text-muted">💬 {result.notes}</p>}
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
            Try another photo
          </button>
        </div>
      )}

      <p className="mt-4 text-center text-xs leading-relaxed text-muted">
        AI estimates can be off by 20–30%. Adjust portions if needed.
        <br />
        Photos are sent to Google Gemini for analysis.
      </p>
    </div>
  );
}
