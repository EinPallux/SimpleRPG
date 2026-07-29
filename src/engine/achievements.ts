/**
 * Achievements & titles (GAME_DESIGN.md §13): 70 feats, most tiered
 * bronze/silver/gold. Every CLAIMED tier grants a permanent +3 to all five
 * attributes — the long-tail power curve that rewards breadth of play.
 *
 * Tier state is one number per achievement (tiers claimed so far), and
 * eligibility is a pure read of the stat ledger, so the screen can be opened
 * at any time and always shows the truth.
 */
import { ACHIEVEMENTS, getAchievement } from '@/content/achievements';
import type { AchievementDef } from '@/content/meta';
import { ACHIEVEMENT_ATTR_PER_TIER } from './constants';
import { lowerIsBetter, metricValue } from './metrics';
import { petsOfSource } from '@/content/pets';
import { grantReward, type GrantedReward } from './rewards';
import type { GameSave } from './types';

/** Tiers already banked for one achievement. */
export function tiersClaimed(save: GameSave, id: string): number {
  return save.progress.achievements[id] ?? 0;
}

/** How many tiers the hero's numbers currently satisfy. */
export function tiersEarned(save: GameSave, def: AchievementDef): number {
  const value = metricValue(save, def.metric);
  const better = lowerIsBetter(def.metric);
  let earned = 0;
  for (const threshold of def.tiers) {
    const met = better ? value > 0 && value <= threshold : value >= threshold;
    if (met) earned += 1;
  }
  return earned;
}

export function unclaimedTiers(save: GameSave, def: AchievementDef): number {
  return Math.max(0, tiersEarned(save, def) - tiersClaimed(save, def.id));
}

export function canClaimAchievement(save: GameSave, id: string): boolean {
  return unclaimedTiers(save, getAchievement(id)) > 0;
}

export interface AchievementClaim {
  def: AchievementDef;
  tiersGained: number;
  /** the tier index reached after claiming (1-based) */
  tierNow: number;
  attrGained: number;
  reward: GrantedReward | null;
}

/**
 * Bank every tier currently earned on one achievement. Attributes go up per
 * tier; the FINAL tier additionally pays its gems and unlocks its title.
 */
export function claimAchievement(save: GameSave, id: string, nowMs: number): AchievementClaim {
  const def = getAchievement(id);
  const gained = unclaimedTiers(save, def);
  if (gained === 0) throw new Error(`Achievement ${id} has nothing to claim`);
  const before = tiersClaimed(save, id);
  const after = before + gained;
  save.progress.achievements[id] = after;

  const attrGained = gained * ACHIEVEMENT_ATTR_PER_TIER;
  // The bonus is applied through the same attribute pool the hero buys into,
  // so every downstream stat (HP, combat, par) picks it up for free.
  for (const attr of ['str', 'dex', 'int', 'con', 'lck'] as const) {
    save.hero.attrsBought[attr] += attrGained;
  }

  // Reaching the last tier is the headline: gems, the title, and — for the two
  // feats that keep one — a pet ride on it. The pet↔achievement link lives in
  // `content/pets.ts` (`source.achievementId`), so this stays a lookup rather
  // than a list of ids the two files could drift apart on.
  let reward: GrantedReward | null = null;
  if (before < def.tiers.length && after >= def.tiers.length) {
    const pet = petsOfSource('achievement').find(
      (p) => p.source.kind === 'achievement' && p.source.achievementId === def.id,
    );
    const payload = {
      ...(def.gems ? { gems: def.gems } : {}),
      ...(def.titleId ? { titleId: def.titleId } : {}),
      ...(pet ? { petId: pet.id } : {}),
    };
    if (Object.keys(payload).length > 0) reward = grantReward(save, payload, nowMs);
  }

  return { def, tiersGained: gained, tierNow: after, attrGained, reward };
}

/** Everything claimable right now (the screen's "claim all" button). */
export function claimableAchievements(save: GameSave): AchievementDef[] {
  return ACHIEVEMENTS.filter((def) => unclaimedTiers(save, def) > 0);
}

export function claimAllAchievements(save: GameSave, nowMs: number): AchievementClaim[] {
  // Snapshot first: claiming raises attributes, which could satisfy another
  // achievement mid-loop — those wait for the next visit, keeping this honest.
  const pending = claimableAchievements(save).map((d) => d.id);
  return pending.map((id) => claimAchievement(save, id, nowMs));
}

/** Total tiers banked — drives the "+X to all attributes" summary line. */
export function totalTiersClaimed(save: GameSave): number {
  return Object.values(save.progress.achievements).reduce((sum, n) => sum + n, 0);
}

export function achievementAttrBonus(save: GameSave): number {
  return totalTiersClaimed(save) * ACHIEVEMENT_ATTR_PER_TIER;
}
