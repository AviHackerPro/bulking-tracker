// Whether the app is currently locked. Kept in memory only (never saved),
// so the app always starts locked when the passcode lock is on.

import { create } from 'zustand';
import { COOLDOWN_MS, MAX_ATTEMPTS } from '../lib/lock';

interface LockState {
  locked: boolean;
  failedAttempts: number;
  /** Time (ms) until which entry is paused after too many wrong tries. */
  cooldownUntil: number;
  lock: () => void;
  unlock: () => void;
  recordFailure: (now?: number) => void;
}

// The pause after too many wrong tries survives a page reload.
const COOLDOWN_KEY = 'bulking-tracker-lock-cooldown';
function savedCooldown(): number {
  try {
    return Number(localStorage.getItem(COOLDOWN_KEY)) || 0;
  } catch {
    return 0;
  }
}
function saveCooldown(until: number) {
  try {
    if (until) localStorage.setItem(COOLDOWN_KEY, String(until));
    else localStorage.removeItem(COOLDOWN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export const useLock = create<LockState>()((set) => ({
  locked: true,
  failedAttempts: 0,
  cooldownUntil: savedCooldown(),
  lock: () => set({ locked: true }),
  unlock: () => {
    saveCooldown(0);
    set({ locked: false, failedAttempts: 0, cooldownUntil: 0 });
  },
  recordFailure: (now = Date.now()) =>
    set((s) => {
      const failedAttempts = s.failedAttempts + 1;
      if (failedAttempts < MAX_ATTEMPTS) return { failedAttempts };
      saveCooldown(now + COOLDOWN_MS);
      return { failedAttempts: 0, cooldownUntil: now + COOLDOWN_MS };
    }),
}));
