/**
 * The eight named legendaries in play (CONTENT_CATALOG.md §6.2).
 *
 * Two jobs: decide when a legendary drop becomes a NAMED one, and hand the
 * derived-stat pipeline whatever the equipped uniques are contributing.
 *
 * The drop rule is deliberately not a separate lottery. Every existing
 * legendary source — the wheel jackpot, a well toss, a deep dungeon floor —
 * simply asks here first, and gets a unique the hero does not yet own some of
 * the time. That means uniques inherit the pacing of the systems that already
 * pay legendaries instead of needing a schedule of their own, and "all eight"
 * stays reachable because an owned one is never offered twice.
 */
import { uniqueOrNull, uniquesForClass, UNIQUE_COUNT, type UniqueEffect } from '@/content/uniques';
import { UNIQUE_DROP_SHARE } from './constants';
import type { Rng } from './rng';
import type { GameSave, ItemInstance } from './types';

/** Everything the hero is holding, equipped or bagged. */
function held(save: GameSave): ItemInstance[] {
  return [...Object.values(save.inventory.equipped), ...save.inventory.backpack].filter(
    (item): item is ItemInstance => Boolean(item),
  );
}

/** The distinct uniques owned — what `uniquesOwned` reports and the Codex shows. */
export function ownedUniqueIds(save: GameSave): Set<string> {
  const ids = new Set<string>();
  for (const item of held(save)) {
    if (item.uniqueId) ids.add(item.uniqueId);
  }
  return ids;
}

export function ownsAllUniques(save: GameSave): boolean {
  return ownedUniqueIds(save).size >= UNIQUE_COUNT;
}

/**
 * Should this legendary drop be a named one, and if so which?
 *
 * Returns null — and the caller falls through to a generated legendary — when:
 *  - the hero already owns every unique their class can wear at their level. A
 *    duplicate name would be strictly worse than a fresh roll, and there is
 *    nothing to convert it into.
 *  - **the backpack is full.** Every legendary source auto-sells into gold when
 *    there is no room (gacha `stow`, the wheel's jackpot). For a generated drop
 *    that is a fair trade; for one of eight it would mean losing a one-of-a-kind
 *    to pocket change without ever seeing it. So the well simply declines to
 *    offer one until there is somewhere to put it, and it stays in the pool.
 *
 * Rolls on the caller's stream, so a save-scummed reload cannot fish for one.
 */
export function rollUnique(save: GameSave, rng: Rng): string | null {
  if (save.inventory.backpack.length >= save.inventory.capacity) return null;
  const owned = ownedUniqueIds(save);
  const available = uniquesForClass(save.hero.classId, save.hero.level).filter(
    (u) => !owned.has(u.id),
  );
  if (available.length === 0) return null;
  if (!rng.chance(UNIQUE_DROP_SHARE)) return null;
  return rng.pick(available).id;
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

/** The effects of every EQUIPPED unique — bagged ones do nothing, as with sets. */
export function activeUniqueEffects(save: GameSave): UniqueEffect[] {
  const effects: UniqueEffect[] = [];
  for (const item of Object.values(save.inventory.equipped)) {
    const def = uniqueOrNull(item?.uniqueId);
    if (def) effects.push(def.effect);
  }
  return effects;
}

/**
 * Sum one numeric effect kind across the equipped uniques.
 *
 * Generic rather than eight named getters because every consumer wants exactly
 * this: "how much of X am I getting". Two uniques can never share a kind today,
 * but summing is the behaviour that stays correct if one ever does.
 */
export function uniqueTotal(
  save: GameSave,
  kind: 'patrolGold' | 'blockReflect' | 'weaponDmgPct' | 'evadePP' | 'shopDiscount' | 'wheelGemPP',
): number {
  let total = 0;
  for (const effect of activeUniqueEffects(save)) {
    if (effect.kind !== kind) continue;
    total += 'pct' in effect ? effect.pct : effect.pp;
  }
  return total;
}

export function hasUniqueFlag(save: GameSave, kind: 'firstStrikeAlwaysCrit'): boolean {
  return activeUniqueEffects(save).some((effect) => effect.kind === kind);
}

/**
 * Crown of the Understudy: +1 to every attribute per N hero levels.
 *
 * Deliberately keyed to HERO level rather than item level, so the one unique
 * that could have been outgrown instead keeps pace forever — which is the joke
 * in its name.
 */
export function uniqueFlatAttributes(save: GameSave): number {
  let flat = 0;
  for (const effect of activeUniqueEffects(save)) {
    if (effect.kind === 'attrPerLevels') flat += Math.floor(save.hero.level / effect.per);
  }
  return flat;
}
