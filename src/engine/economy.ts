/** Economy formulas (BALANCING.md §2). Pure functions of level/count — no state. */
import {
  ATTR_COST_CAP,
  ATTR_COST_DIV,
  ATTR_COST_EXP,
  GOLD_EXP,
  GOLD_PER_10VIGOR_BASE,
  MPL_BASE,
  MPL_DIV,
  MPL_EXP,
  PATROL_GOLD_RATE,
  PATROL_XP_RATE,
  ZONE_DECAY,
} from './constants';
import { xpToNext } from './xp';

/** Missions-per-level design target: MPL(L) = 1.2 × (1 + L/12)² (§2.2). */
export function missionsPerLevel(level: number): number {
  return MPL_BASE * Math.pow(1 + level / MPL_DIV, MPL_EXP);
}

/** XP for a mission of `durationMin` at hero level L, before zone multiplier. */
export function missionXp(level: number, durationMin: number): number {
  return Math.ceil((xpToNext(level) / missionsPerLevel(level)) * (durationMin / 10));
}

/** Gold for a mission of `durationMin` at hero level L, before zone multiplier. */
export function missionGold(level: number, durationMin: number): number {
  return Math.ceil(GOLD_PER_10VIGOR_BASE * Math.pow(level, GOLD_EXP) * (durationMin / 10));
}

/** Older zones pay less: −8% per zone below the frontier, floor ×0.60 (§2.3). */
export function zoneMultiplier(zoneIndex: number, frontierIndex: number): number {
  return Math.max(0.6, 1 - ZONE_DECAY * (frontierIndex - zoneIndex));
}

/** Patrol accrual per full hour (GAME_DESIGN.md §6). */
export function patrolGoldPerHour(level: number): number {
  return PATROL_GOLD_RATE * missionGold(level, 10);
}

export function patrolXpPerHour(level: number): number {
  return PATROL_XP_RATE * missionXp(level, 10);
}

/** Gold cost of the nth point in ONE attribute (§2.4): min(10M, ceil(n^2.5 / 8)). */
export function attrCost(n: number): number {
  if (n < 1) throw new Error('attribute point index must be >= 1');
  return Math.min(ATTR_COST_CAP, Math.ceil(Math.pow(n, ATTR_COST_EXP) / ATTR_COST_DIV));
}

/** Total gold to buy points 1..n of one attribute. O(1) via integral + exact tail. */
export function attrCostTotal(n: number): number {
  let total = 0;
  for (let i = 1; i <= n; i++) total += attrCost(i);
  return total;
}

/** Buy one point of an attribute with gold. Mutates the save draft. */
export function buyAttributePoint(
  save: import('./types').GameSave,
  attr: import('./types').AttributeId,
): number {
  const cost = attrCost(save.hero.attrsBought[attr] + 1);
  if (save.hero.gold < cost) throw new Error('Not enough gold for attribute point');
  save.hero.gold -= cost;
  save.hero.attrsBought[attr] += 1;
  save.stats.attrsBought = (save.stats.attrsBought ?? 0) + 1;
  save.stats.goldSpent = (save.stats.goldSpent ?? 0) + cost;
  save.stats.biggestAttrPurchase = Math.max(save.stats.biggestAttrPurchase ?? 0, cost);
  return cost;
}
