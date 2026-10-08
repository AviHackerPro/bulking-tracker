import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useLock } from '../store/useLock';
import { DEFAULT_PIN_HASH, verifyPin } from '../lib/lock';
import PinPad from './PinPad';

export default function LockScreen() {
  const pinHash = useAppStore((s) => s.settings.pinHash ?? DEFAULT_PIN_HASH);
  const { unlock, recordFailure, cooldownUntil, failedAttempts } = useLock();
  const [now, setNow] = useState(Date.now());
  const waiting = cooldownUntil > now;

  // Count down the pause after too many wrong tries.
  useEffect(() => {
    if (!waiting) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [waiting]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-hero-from to-hero-to px-6 text-white" role="dialog" aria-modal="true" aria-label="Enter passcode">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[20px] bg-white/15 shadow-float">
        <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M6.5 8v8M3.5 10v4M17.5 8v8M20.5 10v4M6.5 12h11" />
        </svg>
      </div>
      <h1 className="text-2xl font-extrabold tracking-tight">Enter passcode</h1>
      <p className="mt-1 mb-8 h-5 text-sm text-white/85">
        {waiting
          ? `Too many tries. Wait ${Math.ceil((cooldownUntil - now) / 1000)} s`
          : failedAttempts > 0
            ? 'Wrong passcode. Try again.'
            : ' '}
      </p>
      <PinPad
        tone="hero"
        disabled={waiting}
        onComplete={(pin) => {
          if (verifyPin(pin, pinHash)) {
            navigator.vibrate?.(15);
            unlock();
            return true;
          }
          recordFailure();
          setNow(Date.now());
          return false;
        }}
      />
    </div>
  );
}
