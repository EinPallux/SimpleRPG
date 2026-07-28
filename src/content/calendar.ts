/**
 * The login calendar (GAME_DESIGN.md §14, CONTENT_CATALOG.md §15): a 28-slot
 * monthly board. Showing up stamps the next slot — a missed day costs nothing,
 * the board simply waits. That "no punishment" rule is why the track can be a
 * plain ordered list: slot N is the Nth stamp, never the Nth calendar date.
 *
 * The reward track is the canonical one from CONTENT §15 and is deliberately
 * boring-but-steady: small materials most days, an elixir every ~9, an arena
 * chest twice, gems on 7/14/21/28 (3/5/7/10 = {@link TOTAL_MONTH_GEMS}) and one
 * fat purse on day 27 to pull players over the last-week hump.
 *
 * Payout units follow `MetaReward` (meta.ts): `gold` is a MULTIPLIER of a
 * 10-vigor frontier mission (BALANCING §2.3) so the board never gets stale with
 * level; everything else is flat. `elixir`/`item` are engine rolls — tier and
 * chest table are picked at hero level on claim.
 *
 * **Day 28's frame rotates monthly.** The def carries a stable *placeholder*
 * `frameId` (the first entry of {@link MONTHLY_FRAMES}) so the slot validates,
 * renders and diffs like any other; `engine/calendar.ts` overrides it at claim
 * time with {@link frameForMonth}, keyed off the local month. Content stays a
 * pure data table and the clock stays in the engine (invariant 4).
 *
 * i18n: `calendar.day.{n}` tile labels, `calendar.frame.{id}` cosmetic names,
 * `calendar.month.{1..12}` board themes (the board recolours per theme).
 */
import { z } from 'zod';
import type { CalendarSlotDef, MetaReward } from './meta';
import { calendarSlotSchema } from './meta';

export type { CalendarSlotDef };
/** The one contract, re-exported so consumers never reach past this module. */
export { calendarSlotSchema };

/** Slots on the board. The month's board is this long regardless of month. */
export const CALENDAR_DAYS = 28;

/** Gems paid across a full month: 3 + 5 + 7 + 10 (CONTENT §15). */
export const TOTAL_MONTH_GEMS = 25;

function slot(day: number, reward: MetaReward): CalendarSlotDef {
  return { day, reward };
}

/**
 * Days 1..28, in claim order. Amounts ramp gently within the bands the design
 * allows (scraps 8–20, treats 5–12, dust 2–5) so week four feels richer than
 * week one without any of it mattering to the power curve.
 */
export const CALENDAR_SLOTS: readonly CalendarSlotDef[] = [
  // Week 1 — the habit-forming week: nothing big, nothing missable.
  slot(1, { gold: 1.5 }),
  slot(2, { scraps: 8 }),
  slot(3, { treats: 5 }),
  slot(4, { gold: 1.5 }),
  slot(5, { elixir: true }),
  slot(6, { dust: 2 }),
  slot(7, { gems: 3 }),
  // Week 2 — first chest, first real materials.
  slot(8, { gold: 1.5 }),
  slot(9, { scraps: 10 }),
  slot(10, { item: true }),
  slot(11, { treats: 6 }),
  slot(12, { gold: 2 }),
  slot(13, { elixir: true }),
  slot(14, { gems: 5 }),
  // Week 3 — the same shape, one notch louder.
  slot(15, { scraps: 12 }),
  slot(16, { gold: 2 }),
  slot(17, { dust: 3 }),
  slot(18, { treats: 8 }),
  slot(19, { gold: 2.5 }),
  slot(20, { item: true }),
  slot(21, { gems: 7 }),
  // Week 4 — the payoff run.
  slot(22, { gold: 2.5 }),
  slot(23, { elixir: true }),
  slot(24, { scraps: 16 }),
  slot(25, { dust: 5 }),
  slot(26, { treats: 10 }),
  slot(27, { gold: 5 }),
  slot(28, { frameId: 'frame-frostveil', gems: 10 }),
];

/**
 * The twelve day-28 cosmetics, one per month index (0 = the first month of the
 * year), ordered to match the board themes in `calendar.month.{n}` — the frame
 * you earn looks like the month you earned it in. A player who shows up every
 * month for a year ends the year with the full set and nothing to buy.
 */
export const MONTHLY_FRAMES: readonly string[] = [
  'frame-frostveil',
  'frame-thawtide',
  'frame-firstgreen',
  'frame-sowingband',
  'frame-blossomguard',
  'frame-longlight',
  'frame-highsun',
  'frame-slowgold',
  'frame-harvestgild',
  'frame-turningleaf',
  'frame-mistmoor',
  'frame-hearthglow',
];

/**
 * The frame day 28 pays in a given month. Total and deterministic: any integer
 * maps into 0..11, so a tampered or exotic clock can never fault the claim.
 */
export function frameForMonth(monthIndex: number): string {
  const size = MONTHLY_FRAMES.length;
  const safe = Number.isFinite(monthIndex) ? Math.trunc(monthIndex) : 0;
  return MONTHLY_FRAMES[((safe % size) + size) % size]!;
}

export function getSlot(day: number): CalendarSlotDef {
  const def = CALENDAR_SLOTS.find((s) => s.day === day);
  if (!def) throw new Error(`Unknown calendar day: ${day}`);
  return def;
}

/** i18n key helpers — the tile label, the cosmetic's name, the board theme. */
export function calendarDayKey(day: number): string {
  return `calendar.day.${day}`;
}
export function frameNameKey(frameId: string): string {
  return `calendar.frame.${frameId}`;
}
/** `monthIndex` is 0-based (as `Date#getMonth`); the key is 1-based. */
export function monthThemeKey(monthIndex: number): string {
  const size = MONTHLY_FRAMES.length;
  const safe = Number.isFinite(monthIndex) ? Math.trunc(monthIndex) : 0;
  return `calendar.month.${(((safe % size) + size) % size) + 1}`;
}

/** Days that pay gems, in order — used by the board's "milestone" styling. */
export function gemDays(): readonly CalendarSlotDef[] {
  return CALENDAR_SLOTS.filter((s) => (s.reward.gems ?? 0) > 0);
}

/** Zod view of the whole board — `pnpm validate:content` parses this. */
export const calendarBoardSchema = z.array(calendarSlotSchema).length(CALENDAR_DAYS);
