import { describe, expect, it } from 'vitest';
import { DEFAULT_PIN_HASH, hashPin, isValidPin, shouldRelock, verifyPin } from '../src/lib/lock';

describe('passcode lock', () => {
  it('hashes consistently and never stores the digits', () => {
    expect(hashPin('4821')).toBe(hashPin('4821'));
    expect(hashPin('4821')).not.toBe(hashPin('4822'));
    expect(hashPin('4821')).not.toContain('4821');
    expect(hashPin('4821')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('verifies the right passcode only', () => {
    const stored = hashPin('7391');
    expect(verifyPin('7391', stored)).toBe(true);
    expect(verifyPin('7392', stored)).toBe(false);
    expect(verifyPin('739', stored)).toBe(false);
  });

  it('the default hash belongs to exactly one 4-digit passcode', () => {
    let matches = 0;
    for (let n = 0; n < 10000; n++) if (verifyPin(String(n).padStart(4, '0'), DEFAULT_PIN_HASH)) matches++;
    expect(matches).toBe(1);
  });

  it('accepts only 4 digits', () => {
    expect(isValidPin('0420')).toBe(true);
    expect(isValidPin('42')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
  });

  it('locks again after a minute in the background', () => {
    expect(shouldRelock(null, 100_000)).toBe(false);
    expect(shouldRelock(0, 59_999)).toBe(false);
    expect(shouldRelock(0, 60_000)).toBe(true);
  });
});
