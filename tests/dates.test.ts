import { describe, expect, it } from 'vitest';
import { datesOfWeek, defaultDayType, formatTime, weekStartOf, weekdayOf } from '../src/lib/dates';

describe('dates', () => {
  it('finds the weekday of a date string (local time)', () => {
    expect(weekdayOf('2026-10-05')).toBe('mon');
    expect(weekdayOf('2026-10-11')).toBe('sun');
  });

  it('weeks start on Monday', () => {
    expect(weekStartOf('2026-10-05')).toBe('2026-10-05');
    expect(weekStartOf('2026-10-11')).toBe('2026-10-05');
    expect(weekStartOf('2026-10-12')).toBe('2026-10-12');
    expect(datesOfWeek('2026-10-05')).toEqual([
      '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11',
    ]);
  });

  it('weekends default to home days', () => {
    expect(defaultDayType('fri')).toBe('school');
    expect(defaultDayType('sat')).toBe('home');
  });

  it('formats 24h times for display', () => {
    expect(formatTime('07:30')).toBe('7:30 am');
    expect(formatTime('13:20')).toBe('1:20 pm');
    expect(formatTime('12:00')).toBe('12:00 pm');
    expect(formatTime('00:15')).toBe('12:15 am');
  });
});
