// Shared building blocks. Every screen is made from these, so the look stays consistent.

import { useEffect, useState, type ReactNode } from 'react';
import { reducedMotion } from '../lib/feel';
import type { Macros, SlotId } from '../lib/types';
import { BreakfastIcon, DinnerIcon, LunchIcon, RecessIcon, SnackIcon, XIcon } from './icons';

// ----- Formatting ----------------------------------------------------

/** 2745 → "2,745"; 8.5 → "8.5" */
export function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-AU', { maximumFractionDigits: decimals });
}

export type MacroKey = keyof Macros;
export const MACRO_KEYS: MacroKey[] = ['calories', 'protein', 'carbs', 'fat'];

export const MACRO_META: Record<MacroKey, { label: string; unit: string; bar: string; text: string }> = {
  calories: { label: 'Calories', unit: 'cal', bar: 'bg-cal', text: 'text-cal' },
  protein: { label: 'Protein', unit: 'g', bar: 'bg-protein', text: 'text-protein' },
  carbs: { label: 'Carbs', unit: 'g', bar: 'bg-carbs', text: 'text-carbs' },
  fat: { label: 'Fat', unit: 'g', bar: 'bg-fat', text: 'text-fat' },
};

const SLOT_ICONS: Record<SlotId, (p: { size?: number; className?: string }) => ReactNode> = {
  breakfast: BreakfastIcon,
  recess: RecessIcon,
  lunch: LunchIcon,
  afterSchool: SnackIcon,
  dinner: DinnerIcon,
};

/** Line icon for a meal slot. */
export function SlotIcon({ slot, size = 22, className = '' }: { slot: SlotId; size?: number; className?: string }) {
  const Icon = SLOT_ICONS[slot];
  return <Icon size={size} className={className} />;
}

// ----- Layout --------------------------------------------------------

export function PageHeader({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 px-5 pt-7 pb-4">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mx-5 mt-6 mb-2.5 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-bold">{children}</h2>
      {right && <div className="text-sm text-muted">{right}</div>}
    </div>
  );
}

const CARD_TONES = {
  default: 'bg-card shadow-card',
  accent: 'bg-accent-soft',
  warn: 'bg-warn-soft',
  muted: 'bg-track',
};

export function Card({
  children,
  className = '',
  tone = 'default',
  flush = false,
}: {
  children: ReactNode;
  className?: string;
  tone?: keyof typeof CARD_TONES;
  /** No inner padding (e.g. lists that run edge to edge). */
  flush?: boolean;
}) {
  return <section className={`mx-4 mb-3 rounded-3xl ${CARD_TONES[tone]} ${flush ? '' : 'p-5'} ${className}`}>{children}</section>;
}

/** Pill-style switch between a few options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex rounded-2xl bg-track p-1 text-sm font-semibold ${className}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-xl px-3 py-2 transition-colors ${value === o.value ? 'bg-raised text-ink shadow-card' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ----- Buttons & inputs -----------------------------------------------

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100';
export const buttonClass = {
  primary: `${BUTTON_BASE} bg-gold-gradient text-[#17120a] shadow-glow`,
  soft: `${BUTTON_BASE} bg-accent-soft text-accent`,
  ghost: `${BUTTON_BASE} bg-track text-ink`,
  danger: `${BUTTON_BASE} bg-warn text-card`,
  quiet: 'inline-flex items-center gap-1 text-sm font-semibold text-accent active:opacity-70',
};

export const inputClass =
  'w-full rounded-2xl border border-transparent bg-track px-4 py-3 text-[15px] outline-none transition placeholder:text-muted/70 focus:border-accent focus:bg-card';

/** A text input with a unit on the right, e.g. "kg". */
export function UnitInput({
  value,
  onChange,
  unit,
  placeholder,
  label,
  autoFocus,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  unit: string;
  placeholder?: string;
  label: string;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center rounded-2xl border border-transparent bg-track transition focus-within:border-accent focus-within:bg-card ${className}`}>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoFocus={autoFocus}
        className="w-full min-w-0 bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-muted/70"
      />
      <span className="pr-4 text-sm text-muted">{unit}</span>
    </div>
  );
}

// ----- Data display -----------------------------------------------------

/** "590 cal · 22 g protein": the two numbers that matter most. */
export function MacroLine({ m, className = '' }: { m: Macros; className?: string }) {
  return (
    <span className={`text-sm tabular-nums text-muted ${className}`}>
      {fmt(m.calories)} cal · <span className="font-semibold text-protein">{fmt(m.protein, 1)} g</span> protein
    </span>
  );
}

/** All four macros as small tiles (for detail views). */
export function MacroGrid({ m }: { m: Macros }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {MACRO_KEYS.map((k) => (
        <div key={k} className="rounded-2xl bg-track px-2 py-2.5 text-center">
          <div className="text-[15px] font-bold tabular-nums">{fmt(m[k], 1)}</div>
          <div className="text-[11px] text-muted">
            {k === 'calories' ? 'cal' : `g ${MACRO_META[k].label.toLowerCase()}`}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Thin progress bar. `upcoming` adds a lighter segment after the solid one. */
export function Bar({
  value,
  target,
  upcoming = 0,
  color,
  track = 'bg-track',
  height = 'h-2',
}: {
  value: number;
  target: number;
  upcoming?: number;
  color: string;
  track?: string;
  height?: string;
}) {
  const shown = useMounted();
  const pct = (n: number) => (shown && target > 0 ? Math.max(0, Math.min(100, (n / target) * 100)) : 0);
  const solid = pct(value);
  const light = Math.max(0, pct(value + upcoming) - solid);
  return (
    <div className={`flex ${height} overflow-hidden rounded-full ${track}`}>
      <div className={`h-full rounded-full ${color} transition-[width] duration-700 ease-out`} style={{ width: `${solid}%` }} />
      <div className={`h-full ${color} opacity-30 transition-[width] duration-700 ease-out`} style={{ width: `${light}%` }} />
    </div>
  );
}

/** Circular progress ring. */
export function Ring({
  value,
  target,
  upcoming = 0,
  size = 132,
  stroke = 12,
  color = 'currentColor',
  trackColor = 'rgb(255 255 255 / 0.22)',
  children,
}: {
  value: number;
  target: number;
  upcoming?: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
}) {
  const shown = useMounted();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = (n: number) => (shown && target > 0 ? Math.max(0, Math.min(1, n / target)) : 0);
  const solid = frac(value);
  const withUpcoming = frac(value + upcoming);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${withUpcoming * c} ${c}`}
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${solid * c} ${c}`}
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

// ----- Overlays --------------------------------------------------------

/** Bottom sheet: slides up from the bottom on phones. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button className="animate-fade absolute inset-0 bg-black/45" aria-label="Close" onClick={onClose} />
      <div
        className="animate-sheet relative flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-[28px] bg-card shadow-float sm:rounded-[28px]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line sm:hidden" />
        <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-2">
          <h2 className="text-lg leading-snug font-bold">{title}</h2>
          <button onClick={onClose} className="-mr-2 rounded-full p-2 text-muted active:bg-track" aria-label="Close">
            <XIcon />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pt-1 pb-6">{children}</div>
      </div>
    </div>
  );
}

/** Placeholder for screens that arrive in a later phase. */
export function ComingSoon({ phase, children }: { phase: number; children: ReactNode }) {
  return (
    <Card className="text-center">
      <p className="text-sm font-semibold text-accent">Coming in Phase {phase}</p>
      <p className="mt-1 text-sm text-muted">{children}</p>
    </Card>
  );
}

/** On/off switch. */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-line'}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

/** False for one frame after mounting, so bars and rings can animate in from empty. */
function useMounted(): boolean {
  const [mounted, setMounted] = useState(reducedMotion);
  useEffect(() => {
    if (mounted) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
    return () => cancelAnimationFrame(id);
  }, [mounted]);
  return mounted;
}
