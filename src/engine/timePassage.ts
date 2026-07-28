/**
 * Offline catch-up & reset engine (TECHNICAL_ARCHITECTURE.md §6, GAME_DESIGN §14).
 * Walks every local midnight between lastSeenAt and now in order, banking
 * patrol and applying daily/weekly/monthly resets. Pure over (save, nowMs) —
 * the clock-tamper guard freezes instead of ever punishing.
 */
import { CLOCK_ROLLBACK_GRACE_MS, VIGOR_DAILY_BASE } from './constants';
import { collectPatrol } from './patrol';
import { prunePotions } from './potions';
import { resetShopsDaily } from './shops';
import { isoWeekKey, localDayKey, localMonthKey } from './time';
import type { GameSave, QuestBlock } from './types';

export interface TimePassageResult {
  frozen: boolean;
  daysCrossed: number;
  weeksCrossed: number;
  monthsCrossed: number;
  patrolGoldBanked: number;
}

/** The local midnight that begins the day AFTER the given instant. */
function nextMidnight(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime();
}

/**
 * Start a cadence's quest slate over: clear the board and re-snapshot the stat
 * ledger, so the new period's progress counts from zero (types.ts QuestBlock).
 * The board itself is rolled lazily on first visit (engine/quests.ts).
 */
function resetQuestBlock(save: GameSave, block: QuestBlock): void {
  block.questIds = [];
  block.questProgress = {};
  block.questsClaimed = [];
  block.statsAt = { ...save.stats };
}

export function applyDailyReset(save: GameSave, newDayMs: number): void {
  save.daily.dayKey = localDayKey(newDayMs);
  save.daily.vigor = VIGOR_DAILY_BASE; // unspent vigor is lost at reset (§4)
  save.daily.secondWindUsed = false;
  save.daily.aleUsed = 0;
  save.daily.wheelSpins = 0;
  save.daily.dismantles = 0;
  save.daily.expeditions = 0;
  save.daily.tavernRerollUsed = false;
  save.daily.freeTossUsed = false;
  save.daily.activity = 0;
  save.daily.questSwapUsed = false;
  save.daily.activityChestClaimed = false;
  resetQuestBlock(save, save.daily);
  save.activities.arena.fightsToday = 0;
  save.activities.arena.cooldownUntil = null;
  save.stats.daysPlayed = (save.stats.daysPlayed ?? 0) + 1;
  resetShopsDaily(save); // fresh merchant stock at midnight (GAME_DESIGN §9.5)
}

export function applyWeeklyReset(save: GameSave, newWeekMs: number): void {
  save.weekly.weekKey = isoWeekKey(newWeekMs);
  resetQuestBlock(save, save.weekly);
}

export function applyMonthlyReset(save: GameSave, newMonthMs: number): void {
  const key = localMonthKey(newMonthMs);
  save.monthly.monthKey = key;
  resetQuestBlock(save, save.monthly);
  save.calendar.monthKey = key;
  save.calendar.claimedDays = [];
}

/**
 * Process everything between save.lastSeenAt and nowMs. Mutates the draft and
 * stamps lastSeenAt = now unless the clock ran backwards (frozen).
 */
export function applyTimePassage(save: GameSave, nowMs: number): TimePassageResult {
  const lastSeen = Date.parse(save.lastSeenAt);

  if (nowMs < lastSeen - CLOCK_ROLLBACK_GRACE_MS) {
    // Device clock jumped backwards: freeze (no accrual, no resets, no penalty)
    // until wall time passes the high-water mark again.
    return { frozen: true, daysCrossed: 0, weeksCrossed: 0, monthsCrossed: 0, patrolGoldBanked: 0 };
  }

  let days = 0;
  let weeks = 0;
  let months = 0;
  let patrolGold = 0;

  let cursor = lastSeen;
  let boundary = nextMidnight(cursor);
  while (boundary <= nowMs) {
    // 1) Bank the running patrol up to this midnight, then end it (§6: never spans days).
    if (save.activities.patrol) {
      const collected = collectPatrol(save, boundary);
      patrolGold += collected.gold;
      save.activities.patrol = null;
    }
    // 2) Apply resets for the day beginning at `boundary`.
    const prevDayMs = boundary - 1;
    applyDailyReset(save, boundary);
    days += 1;
    if (isoWeekKey(boundary) !== isoWeekKey(prevDayMs)) {
      applyWeeklyReset(save, boundary);
      weeks += 1;
    }
    if (localMonthKey(boundary) !== localMonthKey(prevDayMs)) {
      applyMonthlyReset(save, boundary);
      months += 1;
    }
    cursor = boundary;
    boundary = nextMidnight(cursor);
  }

  prunePotions(save, nowMs);
  save.lastSeenAt = new Date(nowMs).toISOString();
  return {
    frozen: false,
    daysCrossed: days,
    weeksCrossed: weeks,
    monthsCrossed: months,
    patrolGoldBanked: patrolGold,
  };
}
