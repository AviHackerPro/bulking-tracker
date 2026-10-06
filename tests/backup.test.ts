import { describe, expect, it } from 'vitest';
import { backupFileName, makeBackup, parseBackup, pickData } from '../src/lib/backup';
import { createInitialData } from '../src/lib/storage';

function sampleState() {
  const s = createInitialData();
  s.profile = { startDate: '2026-10-05', startWeightKg: 55 };
  s.weighIns = [{ id: 'w1', date: '2026-10-05', weightKg: 55 }];
  s.training = [{ id: 't1', date: '2026-10-05', notes: 'Squat' }];
  return s;
}

describe('backups', () => {
  it('round-trips all data through a JSON file', () => {
    const state = sampleState();
    const text = JSON.stringify(makeBackup(state, new Date('2026-10-06T08:00:00Z')));
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data).toEqual(state);
      expect(parsed.exportedAt).toBe('2026-10-06T08:00:00.000Z');
    }
  });

  it('leaves store functions out of the file', () => {
    const withFns = { ...sampleState(), logWeight: () => {} };
    expect(Object.keys(pickData(withFns))).not.toContain('logWeight');
  });

  it('never puts the Gemini API key in a backup', () => {
    const state = sampleState();
    state.settings = { ...state.settings, geminiApiKey: 'secret-key-123', geminiModel: 'gemini-3.8-flash' };
    const text = JSON.stringify(makeBackup(state));
    expect(text).not.toContain('secret-key-123');
    expect(text).toContain('gemini-3.8-flash');
  });

  it('names the file by date', () => {
    expect(backupFileName('2026-10-06')).toBe('bulking-tracker-backup-2026-10-06.json');
  });

  it('fills in fields that older backups did not have, and drops removed ones', () => {
    const old = makeBackup(sampleState());
    const data = { ...old.data } as Record<string, unknown>;
    delete data.targetChanges;
    data.sleep = [{ id: 's', date: '2026-10-05', hours: 8 }];
    const parsed = parseBackup(JSON.stringify({ ...old, data }));
    expect(parsed.ok && parsed.data.targetChanges).toEqual([]);
    expect(parsed.ok && 'sleep' in parsed.data).toBe(false);
  });

  it('rejects files that are not backups', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: "That file isn't valid JSON." });
    expect(parseBackup('{"hello": 1}').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'bulking-tracker', version: 99, data: {} }))).toMatchObject({ ok: false, error: expect.stringMatching(/newer version/) });
  });

  it('rejects damaged backups', () => {
    const good = makeBackup(sampleState());
    const broken = (patch: Record<string, unknown>) => JSON.stringify({ ...good, data: { ...good.data, ...patch } });
    expect(parseBackup(broken({ meals: [] })).ok).toBe(false);
    expect(parseBackup(broken({ targets: { calories: 'lots' } })).ok).toBe(false);
    expect(parseBackup(broken({ rotation: { mon: {} } })).ok).toBe(false);
    expect(parseBackup(broken({ weighIns: 'oops' })).ok).toBe(false);
  });
});
