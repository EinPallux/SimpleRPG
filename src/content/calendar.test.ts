/**
 * Login calendar validation (GAME_DESIGN.md §14, CONTENT_CATALOG.md §15).
 * The board is a promise: 28 stamps, gems on 7/14/21/28, a frame at the end.
 * These tests pin that promise — the reward track, the gem budget, the monthly
 * frame rotation and full i18n coverage for every tile the player can see.
 */
import { describe, expect, it } from 'vitest';
import { hasKey } from '@/i18n';
import { calendarSlotSchema as sharedSchema } from './meta';
import {
  CALENDAR_DAYS,
  CALENDAR_SLOTS,
  MONTHLY_FRAMES,
  TOTAL_MONTH_GEMS,
  calendarBoardSchema,
  calendarDayKey,
  calendarSlotSchema,
  frameForMonth,
  frameNameKey,
  gemDays,
  getSlot,
  monthThemeKey,
} from './calendar';

/** Strict kebab-case: lowercase words joined by single hyphens. */
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);
/** The canonical track from CONTENT §15, day → the category it pays. */
const TRACK: Record<number, keyof (typeof CALENDAR_SLOTS)[number]['reward']> = {
  1: 'gold',
  2: 'scraps',
  3: 'treats',
  4: 'gold',
  5: 'elixir',
  6: 'dust',
  7: 'gems',
  8: 'gold',
  9: 'scraps',
  10: 'item',
  11: 'treats',
  12: 'gold',
  13: 'elixir',
  14: 'gems',
  15: 'scraps',
  16: 'gold',
  17: 'dust',
  18: 'treats',
  19: 'gold',
  20: 'item',
  21: 'gems',
  22: 'gold',
  23: 'elixir',
  24: 'scraps',
  25: 'dust',
  26: 'treats',
  27: 'gold',
  28: 'frameId',
};

describe('calendar board (M6)', () => {
  it('holds exactly 28 slots numbered 1..28 with no gaps or repeats', () => {
    expect(CALENDAR_DAYS).toBe(28);
    expect(CALENDAR_SLOTS).toHaveLength(28);
    expect(CALENDAR_SLOTS.map((s) => s.day)).toEqual(DAYS);
    expect(new Set(CALENDAR_SLOTS.map((s) => s.day)).size).toBe(28);
  });

  it('validates every slot against the shared schema', () => {
    for (const slot of CALENDAR_SLOTS) expect(() => calendarSlotSchema.parse(slot)).not.toThrow();
    // the re-export is the one contract from meta.ts, not a copy
    expect(calendarSlotSchema).toBe(sharedSchema);
    expect(() => calendarBoardSchema.parse(CALENDAR_SLOTS)).not.toThrow();
  });

  it('rejects malformed slots (schema is strict)', () => {
    expect(() => calendarSlotSchema.parse({ ...CALENDAR_SLOTS[0]!, day: 29 })).toThrow();
    expect(() => calendarSlotSchema.parse({ ...CALENDAR_SLOTS[0]!, day: 0 })).toThrow();
    expect(() => calendarSlotSchema.parse({ ...CALENDAR_SLOTS[0]!, reward: { coins: 3 } })).toThrow();
    expect(() => calendarSlotSchema.parse({ ...CALENDAR_SLOTS[0]!, tier: 'gold' })).toThrow();
    expect(() => calendarBoardSchema.parse(CALENDAR_SLOTS.slice(0, 27))).toThrow();
  });

  it('follows the canonical CONTENT §15 reward track, day for day', () => {
    for (const day of DAYS) {
      const reward = getSlot(day).reward;
      expect({ day, pays: TRACK[day]! in reward }).toEqual({ day, pays: true });
    }
  });

  it('pays one headline per day — only day 28 doubles up (frame + gems)', () => {
    for (const slot of CALENDAR_SLOTS) {
      const keys = Object.keys(slot.reward);
      expect(keys.length).toBe(slot.day === 28 ? 2 : 1);
    }
  });

  it('never pays xp, set pieces or titles — those belong to quests and story', () => {
    for (const slot of CALENDAR_SLOTS) {
      expect(slot.reward.xp).toBeUndefined();
      expect(slot.reward.setPiece).toBeUndefined();
      expect(slot.reward.titleId).toBeUndefined();
    }
  });
});

describe('the gem budget', () => {
  it('pays gems on exactly days 7/14/21/28, at 3/5/7/10', () => {
    expect(gemDays().map((s) => s.day)).toEqual([7, 14, 21, 28]);
    expect(gemDays().map((s) => s.reward.gems)).toEqual([3, 5, 7, 10]);
    for (const slot of CALENDAR_SLOTS) {
      if (![7, 14, 21, 28].includes(slot.day)) expect(slot.reward.gems).toBeUndefined();
    }
  });

  it('sums to TOTAL_MONTH_GEMS = 25', () => {
    const summed = CALENDAR_SLOTS.reduce((total, s) => total + (s.reward.gems ?? 0), 0);
    expect(TOTAL_MONTH_GEMS).toBe(25);
    expect(summed).toBe(TOTAL_MONTH_GEMS);
  });

  it('escalates: every gem day pays more than the one before it', () => {
    const amounts = gemDays().map((s) => s.reward.gems ?? 0);
    for (let i = 1; i < amounts.length; i += 1) expect(amounts[i]!).toBeGreaterThan(amounts[i - 1]!);
  });
});

describe('payout bands (level-independent by design)', () => {
  it('keeps gold a mission multiplier: ~1.5–2.5 normally, 5 on day 27', () => {
    for (const slot of CALENDAR_SLOTS) {
      if (slot.reward.gold === undefined) continue;
      if (slot.day === 27) {
        expect(slot.reward.gold).toBe(5);
      } else {
        expect(slot.reward.gold).toBeGreaterThanOrEqual(1.5);
        expect(slot.reward.gold).toBeLessThanOrEqual(2.5);
      }
    }
    // day 27 is the month's fat purse — strictly bigger than any other gold day
    const others = CALENDAR_SLOTS.filter((s) => s.day !== 27).map((s) => s.reward.gold ?? 0);
    expect(getSlot(27).reward.gold!).toBeGreaterThan(Math.max(...others));
  });

  it('keeps flat materials inside their bands (scraps 8–20, treats 5–12, dust 2–5)', () => {
    for (const slot of CALENDAR_SLOTS) {
      const { scraps, treats, dust } = slot.reward;
      if (scraps !== undefined) {
        expect(scraps).toBeGreaterThanOrEqual(8);
        expect(scraps).toBeLessThanOrEqual(20);
      }
      if (treats !== undefined) {
        expect(treats).toBeGreaterThanOrEqual(5);
        expect(treats).toBeLessThanOrEqual(12);
      }
      if (dust !== undefined) {
        expect(dust).toBeGreaterThanOrEqual(2);
        expect(dust).toBeLessThanOrEqual(5);
      }
    }
  });

  it('serves three elixirs and two arena chests, on the catalog days', () => {
    expect(CALENDAR_SLOTS.filter((s) => s.reward.elixir).map((s) => s.day)).toEqual([5, 13, 23]);
    expect(CALENDAR_SLOTS.filter((s) => s.reward.item).map((s) => s.day)).toEqual([10, 20]);
  });

  it('ramps materials across the month rather than repeating week one', () => {
    const scraps = CALENDAR_SLOTS.filter((s) => s.reward.scraps).map((s) => s.reward.scraps!);
    const treats = CALENDAR_SLOTS.filter((s) => s.reward.treats).map((s) => s.reward.treats!);
    for (const series of [scraps, treats]) {
      expect(series.length).toBeGreaterThan(1);
      expect(series[series.length - 1]!).toBeGreaterThan(series[0]!);
    }
  });
});

describe('the day-28 frame rotation', () => {
  it('carries a stable placeholder frameId that the engine overrides at claim', () => {
    const frameId = getSlot(28).reward.frameId;
    expect(frameId).toBeDefined();
    expect(frameId).toBe(MONTHLY_FRAMES[0]);
    expect(MONTHLY_FRAMES).toContain(frameId!);
    // nobody else on the board hands out cosmetics
    expect(CALENDAR_SLOTS.filter((s) => s.reward.frameId !== undefined)).toHaveLength(1);
  });

  it('offers twelve unique, kebab-case frame ids — one per month', () => {
    expect(MONTHLY_FRAMES).toHaveLength(12);
    expect(new Set(MONTHLY_FRAMES).size).toBe(12);
    for (const id of MONTHLY_FRAMES) {
      expect(id).toMatch(KEBAB);
      expect(id.startsWith('frame-')).toBe(true);
    }
  });

  it('is total over the twelve month indexes and hands out every frame exactly once', () => {
    const year = Array.from({ length: 12 }, (_, m) => frameForMonth(m));
    expect(year).toEqual([...MONTHLY_FRAMES]);
    expect(new Set(year).size).toBe(12);
  });

  it('is deterministic — same month, same frame, every call', () => {
    for (const month of [0, 3, 7, 11]) {
      expect(frameForMonth(month)).toBe(frameForMonth(month));
    }
  });

  it('wraps out-of-range or hostile clock values instead of faulting', () => {
    expect(frameForMonth(12)).toBe(MONTHLY_FRAMES[0]);
    expect(frameForMonth(25)).toBe(MONTHLY_FRAMES[1]);
    expect(frameForMonth(-1)).toBe(MONTHLY_FRAMES[11]);
    expect(frameForMonth(-13)).toBe(MONTHLY_FRAMES[11]);
    expect(frameForMonth(6.9)).toBe(MONTHLY_FRAMES[6]);
    expect(MONTHLY_FRAMES).toContain(frameForMonth(Number.NaN));
  });
});

describe('getSlot', () => {
  it('returns the definition for every day on the board', () => {
    for (const day of DAYS) expect(getSlot(day).day).toBe(day);
    expect(getSlot(7)).toBe(CALENDAR_SLOTS[6]);
  });

  it('throws on a day that is not on the board', () => {
    expect(() => getSlot(0)).toThrow(/Unknown calendar day/);
    expect(() => getSlot(29)).toThrow(/Unknown calendar day/);
    expect(() => getSlot(-4)).toThrow(/Unknown calendar day/);
  });
});

describe('i18n coverage (invariant 8)', () => {
  it('labels all 28 tiles', () => {
    for (const day of DAYS) {
      expect(calendarDayKey(day)).toBe(`calendar.day.${day}`);
      expect(hasKey(calendarDayKey(day))).toBe(true);
    }
  });

  it('names all 12 cosmetic frames', () => {
    for (const id of MONTHLY_FRAMES) {
      expect(frameNameKey(id)).toBe(`calendar.frame.${id}`);
      expect(hasKey(frameNameKey(id))).toBe(true);
    }
  });

  it('themes all 12 monthly boards, keyed 1-based off a 0-based month', () => {
    for (let month = 0; month < 12; month += 1) {
      expect(monthThemeKey(month)).toBe(`calendar.month.${month + 1}`);
      expect(hasKey(monthThemeKey(month))).toBe(true);
    }
    expect(monthThemeKey(12)).toBe('calendar.month.1');
    expect(monthThemeKey(-1)).toBe('calendar.month.12');
  });

  it('emits 52 distinct keys with no collisions', () => {
    const keys = [
      ...DAYS.map(calendarDayKey),
      ...MONTHLY_FRAMES.map(frameNameKey),
      ...Array.from({ length: 12 }, (_, m) => monthThemeKey(m)),
    ];
    expect(keys).toHaveLength(52);
    expect(new Set(keys).size).toBe(52);
    for (const key of keys) expect(hasKey(key)).toBe(true);
  });
});
