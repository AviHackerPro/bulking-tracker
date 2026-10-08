// Passcode lock. This is a privacy screen, not encryption: it stops someone
// casually opening the app on your phone. The passcode is stored as a hash
// (not the digits) so it isn't readable in the code or saved data.

export const PIN_LENGTH = 4;
export const MAX_ATTEMPTS = 5;
export const COOLDOWN_MS = 30_000;
/** Lock again if the app was in the background at least this long. */
export const RELOCK_AFTER_MS = 60_000;

const SALT = 'bulking-tracker-pin:';

/** FNV-1a hash (64-bit, as two 32-bit halves) of the salted passcode, as hex. */
export function hashPin(pin: string): string {
  const text = SALT + pin;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
    h2 = (h2 ^ (h2 >>> 13)) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

/** Hash of the default passcode. */
export const DEFAULT_PIN_HASH = '935475b959c57c50';

export function verifyPin(pin: string, storedHash: string): boolean {
  return pin.length === PIN_LENGTH && hashPin(pin) === storedHash;
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

/** Should the app lock again after coming back from the background? */
export function shouldRelock(hiddenAt: number | null, now: number, after = RELOCK_AFTER_MS): boolean {
  return hiddenAt !== null && now - hiddenAt >= after;
}
