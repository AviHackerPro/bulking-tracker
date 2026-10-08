// Small touches that make the app feel native: vibration, page transitions
// and animated numbers. All of them switch off for "reduce motion".

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** A short vibration on Android (ignored where unsupported). */
export function haptic(pattern: number | number[] = 12): void {
  try {
    if (!reducedMotion()) navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}

/** Run a UI change inside a smooth cross-fade, where the browser supports it. */
export function withTransition(update: () => void): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (!doc.startViewTransition || reducedMotion()) {
    update();
    return;
  }
  doc.startViewTransition(() => flushSync(update));
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** A number that counts smoothly to its new value (from 0 on first show). */
export function useCountUp(value: number, duration = 650): number {
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0));
  const fromRef = useRef(shown);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    if (reducedMotion()) {
      setShown(value);
      return;
    }
    fromRef.current = shownRef.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(fromRef.current + (value - fromRef.current) * easeOut(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return shown;
}
