/**
 * The stat ledger (GAME_DESIGN §12.3): one append-only tally of everything the
 * hero has ever done. Quests read a period delta against a snapshot,
 * achievements and story steps read lifetime totals — so the meta layer needs
 * no event bus, and progress can never desync from what actually happened.
 *
 * `save.stats` is a free-form Record<string, number>, which lets set-like facts
 * ("which expedition locales have I visited") live as prefixed keys without a
 * schema change; `countPrefixed` reads them back.
 */
import type { CombatResult } from './combat';
import { LORE_KILL_THRESHOLD, type StatKey } from '@/content/meta';
import type { GameSave, ItemInstance } from './types';

export function bump(save: GameSave, key: StatKey, by = 1): void {
  save.stats[key] = (save.stats[key] ?? 0) + by;
}

/** Record a high-water mark (biggest purchase, deepest upgrade, best streak). */
export function raise(save: GameSave, key: StatKey, value: number): void {
  save.stats[key] = Math.max(save.stats[key] ?? 0, value);
}

/** Record a "lower is better" high-water mark (best arena rank). */
export function lower(save: GameSave, key: StatKey, value: number): void {
  const current = save.stats[key];
  save.stats[key] = current === undefined || current === 0 ? value : Math.min(current, value);
}

/** Set-like membership: `flag(save, 'localeVisited', 'pinewatch')`. */
export function flag(save: GameSave, prefix: string, id: string): void {
  save.stats[`${prefix}:${id}`] = 1;
}

/** How many distinct ids were flagged under a prefix. */
export function countPrefixed(save: GameSave, prefix: string): number {
  let n = 0;
  for (const key of Object.keys(save.stats)) {
    if (key.startsWith(`${prefix}:`) && save.stats[key]) n += 1;
  }
  return n;
}

/**
 * Tally one resolved fight from the hero's point of view: strike outcomes for
 * the combat achievements, plus the clutch/flawless feats. `heroIndex` is the
 * hero's side in the log (0 for every PvE fight and arena bout so far).
 */
export function recordCombat(
  save: GameSave,
  result: CombatResult,
  opts: { heroIndex?: 0 | 1; boss?: { level: number } } = {},
): void {
  const hero = opts.heroIndex ?? 0;
  let crits = 0;
  let blocks = 0;
  let evades = 0;
  let foeLanded = 0;
  for (const round of result.rounds) {
    for (const event of round.events) {
      if (event.dot) continue; // poison ticks aren't swings
      if (event.attacker === hero) {
        if (event.outcome === 'crit') crits += 1;
      } else {
        // Defending outcomes are credited to the hero: they are the hero's
        // shield and footwork, recorded on the attacker's failed swing.
        if (event.outcome === 'blocked') blocks += 1;
        else if (event.outcome === 'evaded') evades += 1;
        else foeLanded += 1;
      }
    }
  }
  if (crits) bump(save, 'crits', crits);
  if (blocks) bump(save, 'blocks', blocks);
  if (evades) bump(save, 'evades', evades);

  const won = result.winner === hero;
  if (won && opts.boss) {
    // Flawless: the boss never landed a single strike on you.
    if (foeLanded === 0) bump(save, 'flawlessBossKills');
    if (opts.boss.level >= save.hero.level + 10) bump(save, 'bossesOutlevelled');
  }
  if (won) {
    const hpLeft = result.hpRemaining[hero];
    const maxHp = startingHp(result, hero);
    if (maxHp > 0 && hpLeft / maxHp < 0.05) bump(save, 'clutchWins');
  }
}

/** Reconstruct a side's starting HP from the first event that touched it. */
function startingHp(result: CombatResult, side: 0 | 1): number {
  for (const round of result.rounds) {
    for (const event of round.events) {
      if (event.attacker !== side && !event.dot) {
        return event.targetHpAfter + event.damage;
      }
    }
  }
  return 0;
}

/** A drop passing through the hero's hands: codex credit + rarity tallies. */
export function recordDrop(save: GameSave, item: ItemInstance): void {
  save.progress.codex.itemsSeen[item.defId] = true;
  if (item.rarity === 'set') bump(save, 'setPiecesFound');
  if (item.rarity === 'legendary') bump(save, 'legendariesFound');
}

/** A monster met in the wild: bestiary kill counter (lore unlocks at 10). */
export function recordMonster(save: GameSave, monsterId: string, kills = 1): void {
  const seen = save.progress.codex.monstersSeen;
  seen[monsterId] = (seen[monsterId] ?? 0) + kills;
  bump(save, 'monstersSlain', kills);
}

/** True once this monster's codex lore has been earned. */
export function loreUnlocked(save: GameSave, monsterId: string): boolean {
  return (save.progress.codex.monstersSeen[monsterId] ?? 0) >= LORE_KILL_THRESHOLD;
}
