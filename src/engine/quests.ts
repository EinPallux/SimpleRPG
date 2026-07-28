/**
 * The quest board (GAME_DESIGN.md §12.2): 3 dailies, 3 weeklies, 2 monthlies,
 * plus the Activity meter and its Daily Chest.
 *
 * Progress is never written — it is always derived as
 * `metricValue(save, metric) − statsAt[metric]` against the snapshot taken at
 * the period's reset (types.ts QuestBlock). That makes offline catch-up free,
 * makes a mid-quest reload impossible to desync, and means no system in the
 * game has to know quests exist.
 *
 * Boards roll from `(worldSeed, cadence, periodKey)` on a throwaway stream, so
 * they are fixed for the period — nothing to fish — yet differ per world.
 */
import {
  ACTIVITY_CHEST_GEM_CHANCE,
  ACTIVITY_CHEST_GOLD_MULT,
  ACTIVITY_CHEST_SCRAPS,
  ACTIVITY_MAX,
  ACTIVITY_PER_ARENA_FIGHT,
  ACTIVITY_PER_DUNGEON_FLOOR,
  ACTIVITY_PER_EXPEDITION,
  ACTIVITY_PER_MISSION,
  ACTIVITY_PER_WHEEL_SPIN,
  MONTHLY_QUEST_SLOTS,
  QUEST_SLOTS,
  WEEKLY_QUEST_SLOTS,
} from './constants';
import { getQuest, questsForLevel } from '@/content/quests';
import type { Cadence, MetricId, QuestDef } from '@/content/meta';
import { grantReward, type GrantedReward } from './rewards';
import { metricValue } from './metrics';
import { Rng, seedState } from './rng';
import type { GameSave, QuestBlock } from './types';

export function questBlock(save: GameSave, cadence: Cadence): QuestBlock {
  if (cadence === 'daily') return save.daily;
  if (cadence === 'weekly') return save.weekly;
  return save.monthly;
}

function periodKey(save: GameSave, cadence: Cadence): string {
  if (cadence === 'daily') return save.daily.dayKey;
  if (cadence === 'weekly') return save.weekly.weekKey;
  return save.monthly.monthKey;
}

function slotsFor(cadence: Cadence): number {
  if (cadence === 'daily') return QUEST_SLOTS;
  if (cadence === 'weekly') return WEEKLY_QUEST_SLOTS;
  return MONTHLY_QUEST_SLOTS;
}

/**
 * Fill an empty board. Deterministic per (world, cadence, period); level-gated
 * so a new hero is never handed a dungeon quest they cannot enter.
 */
export function ensureQuestBoard(save: GameSave, cadence: Cadence): QuestDef[] {
  const block = questBlock(save, cadence);
  const pool = questsForLevel(cadence, save.hero.level);
  const slots = Math.min(slotsFor(cadence), pool.length);

  if (block.questIds.length < slots) {
    const rng = new Rng(
      seedState(save.worldSeed, `quests|${cadence}|${periodKey(save, cadence)}`),
    );
    const picked = [...block.questIds];
    const available = pool.filter((q) => !picked.includes(q.id));
    while (picked.length < slots && available.length > 0) {
      const idx = rng.int(0, available.length - 1);
      picked.push(available.splice(idx, 1)[0]!.id);
    }
    block.questIds = picked;
  }
  return block.questIds.map((id) => getQuest(id));
}

/** How far along a quest is, clamped to its target. */
export function questProgress(save: GameSave, quest: QuestDef): number {
  const block = questBlock(save, quest.cadence);
  const base = block.statsAt[quest.metric as string] ?? 0;
  const now = metricValue(save, quest.metric as MetricId);
  return Math.max(0, Math.min(quest.target, now - base));
}

export function questComplete(save: GameSave, quest: QuestDef): boolean {
  return questProgress(save, quest) >= quest.target;
}

export function questClaimed(save: GameSave, quest: QuestDef): boolean {
  return questBlock(save, quest.cadence).questsClaimed.includes(quest.id);
}

export function canClaimQuest(save: GameSave, quest: QuestDef): boolean {
  return questComplete(save, quest) && !questClaimed(save, quest);
}

export interface QuestClaim {
  quest: QuestDef;
  reward: GrantedReward;
  activityGained: number;
}

/** Bank a finished quest. Dailies also pour into the Activity meter. */
export function claimQuest(save: GameSave, questId: string, nowMs: number): QuestClaim {
  const quest = getQuest(questId);
  if (!canClaimQuest(save, quest)) throw new Error(`Quest ${questId} is not claimable`);
  const block = questBlock(save, quest.cadence);
  block.questsClaimed.push(quest.id);
  const reward = grantReward(save, quest.reward, nowMs);
  const activityGained = quest.cadence === 'daily' ? (quest.activity ?? 0) : 0;
  save.daily.activity = Math.min(ACTIVITY_MAX, save.daily.activity + activityGained);
  save.stats.questsCompleted = (save.stats.questsCompleted ?? 0) + 1;
  return { quest, reward, activityGained };
}

/**
 * The one free daily swap (§12.2 — no feel-bads). Replaces an unclaimed daily
 * with one that isn't already on the board.
 */
export function canSwapDaily(save: GameSave, questId: string): boolean {
  if (save.daily.questSwapUsed) return false;
  if (!save.daily.questIds.includes(questId)) return false;
  return !save.daily.questsClaimed.includes(questId);
}

export function swapDaily(save: GameSave, questId: string): QuestDef {
  if (!canSwapDaily(save, questId)) throw new Error('That daily cannot be swapped');
  const pool = questsForLevel('daily', save.hero.level).filter(
    (q) => !save.daily.questIds.includes(q.id),
  );
  if (pool.length === 0) throw new Error('No other daily to swap in');
  const rng = new Rng(
    seedState(save.worldSeed, `swap|${save.daily.dayKey}|${questId}`),
  );
  const replacement = rng.pick(pool);
  save.daily.questIds = save.daily.questIds.map((id) => (id === questId ? replacement.id : id));
  save.daily.questSwapUsed = true;
  return replacement;
}

// ---------------------------------------------------------------------------
// The Activity meter & Daily Chest
// ---------------------------------------------------------------------------

/**
 * Playing the game at all trickles into the meter, so a day of solid adventuring
 * tops up whatever the three dailies leave behind. Derived from the same
 * period-delta the quests use — no extra bookkeeping.
 */
export function coreActivity(save: GameSave): number {
  const since = (key: string) => {
    const base = save.daily.statsAt[key] ?? 0;
    return Math.max(0, (save.stats[key] ?? 0) - base);
  };
  return (
    since('missionsCompleted') * ACTIVITY_PER_MISSION +
    since('arenaFights') * ACTIVITY_PER_ARENA_FIGHT +
    since('expeditions') * ACTIVITY_PER_EXPEDITION +
    since('dungeonFloors') * ACTIVITY_PER_DUNGEON_FLOOR +
    since('wheelSpins') * ACTIVITY_PER_WHEEL_SPIN
  );
}

/** 0–100. Claimed dailies plus the day's core-loop trickle. */
export function activityTotal(save: GameSave): number {
  return Math.min(ACTIVITY_MAX, Math.round(save.daily.activity + coreActivity(save)));
}

export function canClaimActivityChest(save: GameSave): boolean {
  return !save.daily.activityChestClaimed && activityTotal(save) >= ACTIVITY_MAX;
}

/** The "did my dailies" payoff: gold, scraps and a 40% shot at a gem. */
export function claimActivityChest(save: GameSave, nowMs: number): GrantedReward {
  if (!canClaimActivityChest(save)) throw new Error('The Activity Chest is not ready');
  save.daily.activityChestClaimed = true;
  save.stats.dailyChestsOpened = (save.stats.dailyChestsOpened ?? 0) + 1;
  save.stats.fullActivityDays = (save.stats.fullActivityDays ?? 0) + 1;
  const rng = new Rng(seedState(save.worldSeed, `chest|${save.daily.dayKey}`));
  return grantReward(
    save,
    {
      gold: ACTIVITY_CHEST_GOLD_MULT,
      scraps: ACTIVITY_CHEST_SCRAPS,
      ...(rng.chance(ACTIVITY_CHEST_GEM_CHANCE) ? { gems: 1 } : {}),
    },
    nowMs,
  );
}
