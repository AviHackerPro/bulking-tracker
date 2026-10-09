import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { displayName, isValidBarcode, lookupBarcode, macrosForGrams, type ScannedProduct } from '../lib/openFoodFacts';
import { scaleMacros } from '../lib/totals';
import type { ExtraLog, Food, Macros } from '../lib/types';
import { buttonClass, fmt, inputClass, MacroGrid, Toggle } from './ui';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf'];

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

/** Use the phone's built-in barcode reader if it has one; otherwise load a WebAssembly one. */
async function createDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
  if (Native) {
    try {
      const supported = await Native.getSupportedFormats();
      const formats = FORMATS.filter((f) => supported.includes(f));
      if (formats.length) return new Native({ formats });
    } catch {
      /* fall through to the WebAssembly reader */
    }
  }
  const { BarcodeDetector } = await import('barcode-detector/ponyfill');
  return new BarcodeDetector({ formats: FORMATS as never });
}

type Status =
  | { kind: 'camera' }
  | { kind: 'no-camera'; message: string }
  | { kind: 'looking'; barcode: string }
  | { kind: 'found'; product: ScannedProduct; fromSaved: boolean }
  | { kind: 'not-found'; barcode: string; message: string };

export default function BarcodeScanner({
  foods,
  onAdd,
  onSave,
}: {
  foods: Food[];
  onAdd: (extra: Omit<ExtraLog, 'id'>) => void;
  onSave: (food: Omit<Food, 'id'>) => void;
}) {
  const [status, setStatus] = useState<Status>({ kind: 'camera' });
  const [manual, setManual] = useState('');

  const handleCode = useCallback(
    async (code: string) => {
      const barcode = code.trim();
      // Already saved? Use it straight away, no internet needed.
      const saved = foods.find((f) => f.barcode === barcode);
      if (saved) {
        const m: Macros = { calories: saved.calories, protein: saved.protein, carbs: saved.carbs, fat: saved.fat };
        setStatus({
          kind: 'found',
          fromSaved: true,
          product: { barcode, name: saved.name, brand: '', per100: null, perServing: m, servingGrams: null, servingLabel: saved.serving },
        });
        return;
      }
      setStatus({ kind: 'looking', barcode });
      const result = await lookupBarcode(barcode);
      if (result.ok) setStatus({ kind: 'found', product: result.product, fromSaved: false });
      else
        setStatus({
          kind: 'not-found',
          barcode,
          message:
            result.reason === 'not-found'
              ? 'This product isn’t in the Open Food Facts database yet. Add it with the Custom tab instead.'
              : result.reason === 'offline'
                ? 'You’re offline. Barcode lookups need the internet.'
                : 'Couldn’t reach the food database. Please try again.',
        });
    },
    [foods],
  );

  return (
    <div>
      {status.kind === 'camera' && (
        <CameraView onCode={handleCode} onUnavailable={(message) => setStatus({ kind: 'no-camera', message })} />
      )}
      {status.kind === 'no-camera' && <p className="mb-3 rounded-2xl bg-track px-4 py-3 text-sm text-muted">{status.message}</p>}
      {status.kind === 'looking' && (
        <div className="flex items-center gap-3 rounded-2xl bg-track px-4 py-6">
          <Spinner />
          <span className="text-[0.9375rem]">Looking up {status.barcode}…</span>
        </div>
      )}
      {status.kind === 'found' && (
        <ProductResult
          key={status.product.barcode}
          product={status.product}
          fromSaved={status.fromSaved}
          onAdd={onAdd}
          onSave={onSave}
          onScanAgain={() => setStatus({ kind: 'camera' })}
        />
      )}
      {status.kind === 'not-found' && (
        <div className="rounded-2xl bg-warn-soft px-4 py-3">
          <p className="text-sm">{status.message}</p>
          <p className="mt-1 text-xs text-muted">Barcode: {status.barcode}</p>
          <button className={`${buttonClass.ghost} mt-3 w-full`} onClick={() => setStatus({ kind: 'camera' })}>
            Scan again
          </button>
        </div>
      )}

      {(status.kind === 'camera' || status.kind === 'no-camera') && (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (isValidBarcode(manual)) handleCode(manual);
          }}
        >
          <input
            inputMode="numeric"
            value={manual}
            onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))}
            placeholder="Or type the barcode number"
            className={inputClass}
            aria-label="Barcode number"
          />
          <button type="submit" disabled={!isValidBarcode(manual)} className={buttonClass.ghost}>
            Look up
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-xs text-muted">Product data from Open Food Facts (free and open).</p>
    </div>
  );
}

function CameraView({ onCode, onUnavailable }: { onCode: (code: string) => void; onUnavailable: (message: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  // Keep the latest callbacks without restarting the camera when they change.
  const onCodeRef = useRef(onCode);
  const onUnavailableRef = useRef(onUnavailable);
  onCodeRef.current = onCode;
  onUnavailableRef.current = onUnavailable;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        onUnavailableRef.current('This browser can’t use the camera here. Type the barcode number instead.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch {
        onUnavailableRef.current('Camera access was blocked. Allow the camera for this site, or type the barcode number.');
        return;
      }
      if (stopped || !videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
      setReady(true);

      let detector: Detector;
      try {
        detector = await createDetector();
      } catch {
        stream?.getTracks().forEach((t) => t.stop());
        onUnavailableRef.current('The barcode reader couldn’t load (it needs the internet the first time). Type the number instead.');
        return;
      }
      const scan = async () => {
        if (stopped || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const hit = codes.find((c) => isValidBarcode(c.rawValue));
          if (hit) {
            stopped = true;
            navigator.vibrate?.(60);
            onCodeRef.current(hit.rawValue);
            return;
          }
        } catch {
          /* frame not ready yet */
        }
        timer = window.setTimeout(scan, 250);
      };
      scan();
    })();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-black">
      <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted />
      {/* Aiming guide */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-24 w-4/5 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]" />
      </div>
      <p className="absolute inset-x-0 bottom-3 text-center text-sm font-semibold text-white drop-shadow">
        {ready ? 'Point at the barcode' : 'Starting camera…'}
      </p>
    </div>
  );
}

function ProductResult({
  product,
  fromSaved,
  onAdd,
  onSave,
  onScanAgain,
}: {
  product: ScannedProduct;
  fromSaved: boolean;
  onAdd: (extra: Omit<ExtraLog, 'id'>) => void;
  onSave: (food: Omit<Food, 'id'>) => void;
  onScanAgain: () => void;
}) {
  const byGrams = product.per100 !== null;
  const [grams, setGrams] = useState(String(product.servingGrams ?? 100));
  const [servings, setServings] = useState(1);
  const [save, setSave] = useState(!fromSaved);
  const g = Number(grams.replace(',', '.'));

  const macros: Macros | null = byGrams
    ? g > 0 ? macrosForGrams(product.per100!, g) : null
    : product.perServing ? scaleMacros(product.perServing, servings) : null;
  const amountLabel = byGrams ? `${fmt(g)} g` : servings === 1 ? product.servingLabel || '1 serving' : `${servings} × ${product.servingLabel || 'serving'}`;
  const name = displayName(product);

  if (!product.per100 && !product.perServing) {
    return (
      <div className="rounded-2xl bg-warn-soft px-4 py-3">
        <p className="font-semibold">{name}</p>
        <p className="mt-1 text-sm">This product has no nutrition info in the database. Add it with the Custom tab using the label.</p>
        <button className={`${buttonClass.ghost} mt-3 w-full`} onClick={onScanAgain}>Scan another</button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-lg font-bold leading-snug">{name}</p>
      <p className="text-sm text-muted">
        {fromSaved ? 'From your saved foods' : product.servingLabel ? `Serving size: ${product.servingLabel}` : 'Nutrition per 100 g'}
      </p>

      <div className="mt-4 flex items-center gap-1.5">
        {byGrams ? (
          <>
            {product.servingGrams && (
              <Chip active={g === product.servingGrams} onClick={() => setGrams(String(product.servingGrams))}>1 serving</Chip>
            )}
            <Chip active={g === 100} onClick={() => setGrams('100')}>100 g</Chip>
            <div className="ml-auto flex w-28 items-center rounded-xl bg-track focus-within:ring-2 focus-within:ring-accent">
              <input
                inputMode="decimal"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                className="w-full min-w-0 bg-transparent px-3 py-2 text-right font-semibold outline-none"
                aria-label="Amount in grams"
              />
              <span className="pr-3 text-sm text-muted">g</span>
            </div>
          </>
        ) : (
          [0.5, 1, 1.5, 2].map((m) => (
            <Chip key={m} active={servings === m} onClick={() => setServings(m)}>{m}×</Chip>
          ))
        )}
      </div>

      {macros && <div className="mt-3"><MacroGrid m={macros} /></div>}

      {!fromSaved && (
        <label className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-track px-4 py-3">
          <span className="text-sm">
            <span className="block font-semibold">Save to my foods</span>
            <span className="text-muted">One tap next time, even offline</span>
          </span>
          <Toggle checked={save} onChange={setSave} label="Save to my foods" />
        </label>
      )}

      <div className="mt-4 flex gap-2">
        <button className={`${buttonClass.ghost}`} onClick={onScanAgain}>Scan another</button>
        <button
          className={`${buttonClass.primary} flex-1`}
          disabled={!macros}
          onClick={() => {
            if (!macros) return;
            if (save && !fromSaved) onSave({ name, serving: amountLabel, barcode: product.barcode, ...macros });
            onAdd({ name, serving: amountLabel, base: macros, multiplier: 1 });
          }}
        >
          Add · {macros ? `${fmt(macros.calories)} cal` : ''}
        </button>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-sm font-bold transition ${active ? 'bg-accent text-accent-ink' : 'bg-track'}`}
    >
      {children}
    </button>
  );
}

export function Spinner() {
  return <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden />;
}
