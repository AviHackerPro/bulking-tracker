// Date helpers. Dates are stored as local "yyyy-MM-dd" strings.
// Weeks run Monday → Sunday.

import { addDays, format, getDay, parseISO, startOfWeek } from 'date-fns';
import type { DayType, Weekday } from './types';

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

/** Today's date as "yyyy-MM-dd" in the phone's local time. */
export function todayStr(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd');
}

export function toDateStr(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Parse "yyyy-MM-dd" as a local date (not UTC). */
export function fromDateStr(s: string): Date {
  return parseISO(s);
}

/** "2026-10-05" → "mon". */
export function weekdayOf(dateStr: string): Weekday {
  // getDay: 0 = Sunday … 6 = Saturday
  return WEEKDAYS[(getDay(fromDateStr(dateStr)) + 6) % 7];
}

/** Mon–Fri are school days, Sat–Sun are home days (can be overridden per day). */
export function defaultDayType(day: Weekday): DayType {
  return day === 'sat' || day === 'sun' ? 'home' : 'school';
}

/** The Monday that starts the week containing this date. */
export function weekStartOf(dateStr: string): string {
  return toDateStr(startOfWeek(fromDateStr(dateStr), { weekStartsOn: 1 }));
}

/** The 7 dates (Mon → Sun) of the week starting on weekStart. */
export function datesOfWeek(weekStart: string): string[] {
  const start = fromDateStr(weekStart);
  return WEEKDAYS.map((_, i) => toDateStr(addDays(start, i)));
}

/** "07:30" → "7:30 am" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** "2026-10-05" → "Monday 5 October" */
export function formatLongDate(dateStr: string): string {
  return format(fromDateStr(dateStr), 'EEEE d MMMM');
}
