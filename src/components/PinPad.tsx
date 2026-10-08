import { useEffect, useState } from 'react';
import { PIN_LENGTH } from '../lib/lock';

/**
 * Passcode entry: dots plus a number pad. Calls onComplete when all digits
 * are in; return false from it to shake and clear (wrong passcode).
 * `tone="hero"` is white-on-gradient (lock screen); "plain" fits in a sheet.
 */
export default function PinPad({
  onComplete,
  disabled = false,
  tone = 'plain',
}: {
  onComplete: (pin: string) => boolean | void;
  disabled?: boolean;
  tone?: 'hero' | 'plain';
}) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const hero = tone === 'hero';

  function press(key: string) {
    if (disabled) return;
    if (key === 'back') return setPin((p) => p.slice(0, -1));
    setPin((p) => {
      if (p.length >= PIN_LENGTH) return p;
      const next = p + key;
      if (next.length === PIN_LENGTH) {
        // Let the last dot fill in before checking.
        window.setTimeout(() => {
          if (onComplete(next) === false) {
            navigator.vibrate?.([40, 40, 40]);
            setShake(true);
            window.setTimeout(() => setShake(false), 400);
          }
          setPin('');
        }, 120);
      }
      return next;
    });
  }

  // Physical keyboard support (desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('back');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const keyClass = hero
    ? 'bg-white/15 text-white active:bg-white/30'
    : 'bg-track text-ink active:bg-line';

  return (
    <div className={`w-full max-w-xs ${disabled ? 'opacity-50' : ''}`}>
      <div className={`flex justify-center gap-4 ${shake ? 'animate-shake' : ''}`} aria-label={`${pin.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border-2 transition-colors duration-150 ${
              hero
                ? i < pin.length ? 'border-white bg-white' : 'border-white/60'
                : i < pin.length ? 'border-accent bg-accent' : 'border-line'
            }`}
          />
        ))}
      </div>
      <div className="mx-auto mt-10 grid grid-cols-3 gap-x-6 gap-y-4 px-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(k)}
              disabled={disabled}
              aria-label={k === 'back' ? 'Delete' : k}
              className={`flex aspect-square items-center justify-center rounded-full text-[28px] font-semibold transition select-none active:scale-95 ${
                k === 'back' ? (hero ? 'text-white/90' : 'text-muted') : keyClass
              }`}
            >
              {k === 'back' ? (
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 5H9l-6 7 6 7h12a1 1 0 001-1V6a1 1 0 00-1-1z" />
                  <path d="M17 9l-5 5M12 9l5 5" />
                </svg>
              ) : (
                k
              )}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
