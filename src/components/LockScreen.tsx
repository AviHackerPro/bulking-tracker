import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useLock } from '../store/useLock';
import { DEFAULT_PIN_HASH, verifyPin } from '../lib/lock';
import PinPad from './PinPad';
import { LogoTile, Wordmark } from './Logo';

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
    <div className="hero-surface fixed inset-0 z-50 flex flex-col items-center justify-center border-0 px-6" role="dialog" aria-modal="true" aria-label="Enter passcode">
      <LogoTile size={68} />
      <Wordmark className="text-gold-gradient mt-4 text-[1.625rem]" />
      <h1 className="mt-6 text-lg font-semibold">Enter passcode</h1>
      <p className="mt-1 mb-8 h-5 text-sm text-muted">
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
