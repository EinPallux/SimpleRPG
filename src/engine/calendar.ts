/**
 * The login calendar (GAME_DESIGN.md §14): a 28-slot monthly board. Each day
 * you show up you claim the NEXT slot — a missed day never resets the board,
 * it just waits for you. Slots 7/14/21 pay gems, slot 28 pays the month's
 * cosmetic frame plus 10 more.
 */
import { CALENDAR_SLOTS, frameForMonth, getSlot } from '@/content/calendar';
import { localDayKey } from './time';
import { grantReward, type GrantedReward } from './rewards';
import type { GameSave } from './types';

/** How many slots have been stamped this month (0..28). */
export function slotsClaimed(save: GameSave): number {
  return save.calendar.claimedDays.length;
}

/** The slot a visit today would stamp, or null when the board is full. */
export function nextSlot(save: GameSave): number | null {
  const claimed = slotsClaimed(save);
  return claimed >= CALENDAR_SLOTS.length ? null : claimed + 1;
}

export function claimedToday(save: GameSave, nowMs: number): boolean {
  return save.calendar.lastClaimDayKey === localDayKey(nowMs);
}

export function canClaimCalendar(save: GameSave, nowMs: number): boolean {
  return nextSlot(save) !== null && !claimedToday(save, nowMs);
}

export interface CalendarClaim {
  day: number;
  reward: GrantedReward;
  /** true when this stamp completed the whole month */
  monthComplete: boolean;
}

/** Stamp today's slot. One per local day; the board never punishes a gap. */
export function claimCalendarDay(save: GameSave, nowMs: number): CalendarClaim {
  if (!canClaimCalendar(save, nowMs)) throw new Error('Nothing to claim on the calendar today');
  const day = nextSlot(save)!;
  const slot = getSlot(day);
  save.calendar.claimedDays.push(day);
  save.calendar.lastClaimDayKey = localDayKey(nowMs);
  save.stats.calendarDaysClaimed = (save.stats.calendarDaysClaimed ?? 0) + 1;

  // Day 28's frame rotates by month, so the slot's stored id is a placeholder.
  const reward =
    slot.reward.frameId !== undefined
      ? { ...slot.reward, frameId: frameForMonth(new Date(nowMs).getMonth()) }
      : slot.reward;

  const granted = grantReward(save, reward, nowMs);
  return {
    day,
    reward: granted,
    monthComplete: save.calendar.claimedDays.length >= CALENDAR_SLOTS.length,
  };
}
