// Export / import of all saved data as a JSON backup file.

import { createInitialData, upgradeSavedData, type AppData } from './storage';
import { SLOT_ORDER } from './totals';
import { WEEKDAYS } from './dates';

export const BACKUP_APP = 'bulking-tracker';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string; // ISO timestamp
  data: AppData;
}

/** Only the data fields (no store functions), in a stable order. */
export function pickData(state: AppData): AppData {
  const keys = Object.keys(createInitialData()) as (keyof AppData)[];
  return Object.fromEntries(keys.map((k) => [k, state[k]])) as unknown as AppData;
}

export function makeBackup(state: AppData, now: Date = new Date()): BackupFile {
  const data = pickData(state);
  // The API key and passcode stay on this phone: keep them out of backup files.
  const { geminiApiKey: _secret, pinHash: _pin, ...settings } = data.settings;
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data: { ...data, settings } };
}

export function backupFileName(today: string): string {
  return `bulking-tracker-backup-${today}.json`;
}

export type ParseResult = { ok: true; data: AppData; exportedAt: string | null } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

/**
 * Read a backup file's text. Checks it's really a Bulking Tracker backup and
 * that the important parts look right. Missing newer fields get defaults.
 */
export function parseBackup(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  if (!isObj(json) || json.app !== BACKUP_APP || !isObj(json.data)) {
    return { ok: false, error: "That doesn't look like a Bulking Tracker backup." };
  }
  if (!isNum(json.version) || (json.version as number) > BACKUP_VERSION) {
    return { ok: false, error: 'This backup is from a newer version of the app.' };
  }

  const d = json.data;
  const t = d.targets;
  if (!isObj(t) || !['calories', 'protein', 'carbs', 'fat'].every((k) => isNum(t[k]))) {
    return { ok: false, error: 'The backup is missing daily targets.' };
  }
  if (!Array.isArray(d.meals) || d.meals.length === 0) {
    return { ok: false, error: 'The backup has no meals.' };
  }
  const r = d.rotation;
  if (!isObj(r) || !WEEKDAYS.every((day) => isObj(r[day]) && SLOT_ORDER.every((s) => typeof (r[day] as Record<string, unknown>)[s] === 'string'))) {
    return { ok: false, error: 'The backup’s weekly plan is incomplete.' };
  }
  for (const key of ['weighIns', 'training', 'targetChanges'] as const) {
    if (d[key] !== undefined && !Array.isArray(d[key])) return { ok: false, error: `The backup's ${key} list is damaged.` };
  }
  if (d.dayLogs !== undefined && !isObj(d.dayLogs)) return { ok: false, error: "The backup's daily logs are damaged." };

  const defaults = createInitialData();
  const data = { ...defaults, ...upgradeSavedData(d as Partial<AppData>) } as AppData;
  // Keep only known fields (drops anything from old versions).
  return { ok: true, data: pickData(data), exportedAt: typeof json.exportedAt === 'string' ? json.exportedAt : null };
}
