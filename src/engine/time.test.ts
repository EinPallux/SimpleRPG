import { describe, expect, it } from 'vitest';
import { isoWeekKey, localDayKey, localMonthKey, msUntilNextLocalMidnight } from './time';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

describe('calendar keys (local time)', () => {
  it('formats day and month keys with padding', () => {
    expect(localDayKey(at(2026, 7, 28))).toBe('2026-07-28');
    expect(localDayKey(at(2026, 1, 3))).toBe('2026-01-03');
    expect(localMonthKey(at(2026, 12, 31))).toBe('2026-12');
  });

  it('computes ISO weeks (Monday start, week of the first Thursday)', () => {
    // 2026-01-01 is a Thursday → week 1
    expect(isoWeekKey(at(2026, 1, 1))).toBe('2026-W01');
    // Sunday still belongs to the week started the previous Monday
    expect(isoWeekKey(at(2026, 1, 4))).toBe('2026-W01');
    expect(isoWeekKey(at(2026, 1, 5))).toBe('2026-W02');
    // Today's fixture: Tuesday 2026-07-28 sits in W31
    expect(isoWeekKey(at(2026, 7, 27))).toBe('2026-W31');
    expect(isoWeekKey(at(2026, 7, 26))).toBe('2026-W30');
    // Year boundary: Fri 2027-01-01 belongs to 2026's final week
    expect(isoWeekKey(at(2026, 12, 28))).toBe('2026-W53');
    expect(isoWeekKey(at(2027, 1, 1))).toBe('2026-W53');
    expect(isoWeekKey(at(2027, 1, 4))).toBe('2027-W01');
  });

  it('midnight distance is positive and lands exactly on the next local midnight', () => {
    const now = at(2026, 7, 28, 21);
    const ms = msUntilNextLocalMidnight(now);
    expect(ms).toBeGreaterThan(0);
    expect(localDayKey(now + ms)).toBe('2026-07-29');
    expect(new Date(now + ms).getHours()).toBe(0);
  });
});
