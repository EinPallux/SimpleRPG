/**
 * City Watch patrol (GAME_DESIGN.md §6): passive trickle once vigor is spent.
 * 30-minute ticks; ≤8h may sit uncollected; auto-banks at midnight (time.ts).
 */
import { PATROL_CAP_HOURS, PATROL_TICK_MIN, PATROL_TICKS_PER_TREAT } from './constants';
import { patrolGoldPerHour, patrolXpPerHour } from './economy';
import { auraTotal } from './pets';
import { uniqueTotal } from './uniques';
import type { GameSave, PatrolPayload, TimedActivity } from './types';
import { applyXp, type XpResult } from './xpGain';

export const PATROL_VIGOR_THRESHOLD = 5;

export function canStartPatrol(save: GameSave): boolean {
  return (
    save.daily.vigor < PATROL_VIGOR_THRESHOLD &&
    save.activities.patrol === null &&
    save.activities.mission === null &&
    save.activities.expedition === null
  );
}

export function startPatrol(save: GameSave, nowMs: number): void {
  if (!canStartPatrol(save)) {
    throw new Error('The Watch only hires exhausted adventurers (vigor must be spent)');
  }
  const iso = new Date(nowMs).toISOString();
  save.activities.patrol = {
    kind: 'patrol',
    startedAt: iso,
    durationSec: 0, // open-ended; midnight banking ends it
    payload: { collectedUpTo: iso },
  } satisfies TimedActivity<PatrolPayload>;
}

export interface PatrolCollection {
  ticks: number;
  gold: number;
  xp: XpResult | null;
  treats: number;
}

/**
 * Treats banked by a patrol (§11.1 lists patrol ticks as a treat faucet): one
 * per PATROL_TICKS_PER_TREAT ticks, boosted by a `treatFind` aura. Integer
 * division means a short patrol can bank none — treats are a slow trickle by
 * design, and the wheel and quests are the faster taps.
 */
function patrolTreats(save: GameSave, ticks: number): number {
  const base = Math.floor(ticks / PATROL_TICKS_PER_TREAT);
  return Math.round(base * (1 + auraTotal(save, 'treatFind')));
}

/** Non-mutating accrual preview for the UI (mirrors collectPatrol's math). */
export function previewPatrol(
  save: GameSave,
  nowMs: number,
): { ticks: number; gold: number; nextTickInSec: number; capped: boolean } {
  const patrol = save.activities.patrol;
  if (!patrol) return { ticks: 0, gold: 0, nextTickInSec: 0, capped: false };
  const from = Date.parse(patrol.payload.collectedUpTo);
  const capMs = PATROL_CAP_HOURS * 3_600_000;
  const elapsed = Math.max(0, nowMs - from);
  const cappedElapsed = Math.min(elapsed, capMs);
  const tickMs = PATROL_TICK_MIN * 60_000;
  const ticks = Math.floor(cappedElapsed / tickMs);
  const hours = (ticks * PATROL_TICK_MIN) / 60;
  return {
    ticks,
    gold: Math.round(patrolGoldPerHour(save.hero.level) * hours),
    nextTickInSec: Math.max(0, Math.ceil((tickMs - (cappedElapsed % tickMs)) / 1000)),
    capped: elapsed >= capMs,
  };
}

/**
 * Collect full 30-min ticks accrued up to `untilMs` (capped at 8h per
 * collection window). Partial ticks stay accrued via collectedUpTo.
 */
export function collectPatrol(save: GameSave, untilMs: number): PatrolCollection {
  const patrol = save.activities.patrol;
  if (!patrol) throw new Error('No patrol running');
  const from = Date.parse(patrol.payload.collectedUpTo);
  const cappedElapsedMs = Math.min(
    Math.max(0, untilMs - from),
    PATROL_CAP_HOURS * 3_600_000, // uncollected accrual cap
  );
  const tickMs = PATROL_TICK_MIN * 60_000;
  const ticks = Math.floor(cappedElapsedMs / tickMs);
  if (ticks === 0) return { ticks: 0, gold: 0, xp: null, treats: 0 };

  const hours = (ticks * PATROL_TICK_MIN) / 60;
  // Kettle of Endless Soup: the one unique that pays while you are asleep.
  const gold = Math.round(
    patrolGoldPerHour(save.hero.level) * hours * (1 + uniqueTotal(save, 'patrolGold')),
  );
  const xpAmount = Math.round(patrolXpPerHour(save.hero.level) * hours);
  const treats = patrolTreats(save, ticks);

  save.hero.gold += gold;
  save.hero.treats += treats;
  save.stats.goldEarned = (save.stats.goldEarned ?? 0) + gold;
  save.stats.patrolTicks = (save.stats.patrolTicks ?? 0) + ticks;
  patrol.payload.collectedUpTo = new Date(from + ticks * tickMs).toISOString();
  const xp = xpAmount > 0 ? applyXp(save, xpAmount) : null;
  return { ticks, gold, xp, treats };
}

export function stopPatrol(save: GameSave, nowMs: number): PatrolCollection {
  const result = collectPatrol(save, nowMs);
  save.activities.patrol = null;
  return result;
}
