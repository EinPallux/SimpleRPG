/**
 * Metric resolution (GAME_DESIGN §12.3): content declares WHAT to measure by
 * id; this module is the only place that knows HOW. Quests measure a period
 * delta (`metricValue(save) − statsAt[metric]`), achievements and story steps
 * measure the lifetime value.
 *
 * Every branch is a pure read of the save — no rng, no clock, no mutation.
 */
import { LOWER_IS_BETTER, STAT_KEYS, type MetricId, type StatKey } from '@/content/meta';
import { MONSTER_COUNT, MONSTERS, monstersOfZone } from '@/content/bestiary';
import { LOCALES } from '@/content/expeditions';
import { SETS } from '@/content/sets';
import { ZONES } from '@/content/zones';
import { EQUIP_SLOTS } from './items';
import { countPrefixed } from './ledger';
import { ownsFullSet } from './sets';
import type { GameSave } from './types';

const STAT_KEY_SET = new Set<string>(STAT_KEYS);

export function isStatKey(metric: string): metric is StatKey {
  return STAT_KEY_SET.has(metric);
}

/** Does a smaller number mean better progress? (arena rank) */
export function lowerIsBetter(metric: MetricId): boolean {
  return (LOWER_IS_BETTER as readonly string[]).includes(metric);
}

// --- derived helpers -------------------------------------------------------

function ownedItems(save: GameSave) {
  return [...Object.values(save.inventory.equipped), ...save.inventory.backpack].filter(
    (item) => item !== undefined && item !== null,
  );
}

function setsCompleted(save: GameSave): number {
  return SETS.filter((set) => ownsFullSet(save, set.id)).length;
}

function bestiarySeen(save: GameSave): number {
  return Object.values(save.progress.codex.monstersSeen).filter((n) => n > 0).length;
}

function zoneBestiaryPct(save: GameSave, zoneIndex: number): number {
  const zoneMonsters = monstersOfZone(zoneIndex);
  if (zoneMonsters.length === 0) return 0;
  const seen = zoneMonsters.filter((m) => (save.progress.codex.monstersSeen[m.id] ?? 0) > 0).length;
  return Math.round((seen / zoneMonsters.length) * 100);
}

/** Armory completion: how many of the possible item "designs" have been seen. */
function armoryPct(save: GameSave): number {
  // A design is a (slot × class-cut) pair — the shape rollDrop can produce.
  const total = EQUIP_SLOTS.length * 5; // 4 classes + the classless (jewelry) cut
  const seen = Object.keys(save.progress.codex.itemsSeen).length;
  return Math.min(100, Math.round((seen / total) * 100));
}

function bestiaryPct(save: GameSave): number {
  return MONSTER_COUNT === 0 ? 0 : Math.round((bestiarySeen(save) / MONSTER_COUNT) * 100);
}

/** The cover number: bestiary and armory weighted equally at v1.0. */
function codexPct(save: GameSave): number {
  return Math.round((bestiaryPct(save) + armoryPct(save)) / 2);
}

function storyChapter(save: GameSave): number {
  // The highest chapter with all five steps done (achievements say "story ch. 2/5/8").
  let done = 0;
  for (let chapter = 1; chapter <= 8; chapter++) {
    if ((save.progress.story[String(chapter)] ?? 0) >= 5) done = chapter;
  }
  return done;
}

function storyStepsTotal(save: GameSave): number {
  return Object.values(save.progress.story).reduce((sum, n) => sum + n, 0);
}

function achievementTiers(save: GameSave): number {
  return Object.values(save.progress.achievements).reduce((sum, n) => sum + n, 0);
}

function loreRead(save: GameSave): number {
  return Object.keys(save.progress.codex.loreSeen).length;
}

// --- the resolver ----------------------------------------------------------

export function metricValue(save: GameSave, metric: MetricId): number {
  // Parameterized forms first.
  if (metric.startsWith('dungeonFloors:')) {
    return save.progress.dungeonFloors[metric.slice('dungeonFloors:'.length)] ?? 0;
  }
  if (metric.startsWith('zoneBestiary:')) {
    return zoneBestiaryPct(save, Number(metric.slice('zoneBestiary:'.length)));
  }
  // Raw ledger counters pass straight through.
  if (isStatKey(metric)) {
    if (metric === 'loreRead') return loreRead(save);
    return save.stats[metric] ?? 0;
  }

  switch (metric) {
    case 'level':
      return save.hero.level;
    case 'zonesUnlocked':
      return save.progress.zonesUnlocked;
    case 'storyChapter':
      return storyChapter(save);
    case 'storyStep':
      return storyStepsTotal(save);
    case 'setsCompleted':
      return setsCompleted(save);
    case 'setPiecesOwned':
      return ownedItems(save).filter((item) => item?.setId).length;
    case 'legendariesOwned':
      return ownedItems(save).filter((item) => item?.rarity === 'legendary').length;
    case 'uniquesOwned': {
      // DISTINCT uniques — the achievement says "all 8", and two copies of the
      // Ladle is not seven eighths of the way there.
      const held = new Set(
        ownedItems(save)
          .map((item) => item?.uniqueId)
          .filter((id): id is string => id !== undefined),
      );
      return held.size;
    }
    case 'petsOwned':
      return Object.values(save.progress.pets).filter((p) => p.owned).length;
    case 'framesOwned':
      return save.progress.frames.length;
    case 'mountTier':
      return save.progress.mountTier;
    case 'codexPct':
      return codexPct(save);
    case 'bestiaryPct':
      return bestiaryPct(save);
    case 'armoryPct':
      return armoryPct(save);
    case 'bestZoneBestiaryPct': {
      let best = 0;
      for (let zone = 1; zone <= ZONES.length; zone++) {
        best = Math.max(best, zoneBestiaryPct(save, zone));
      }
      return best;
    }
    case 'attrTotalBought':
      return Object.values(save.hero.attrsBought).reduce((sum, n) => sum + n, 0);
    case 'arenaRank':
      // Rank needs the world clock, so the ledger keeps the best-ever value
      // (engine/arena.ts records it after every bout).
      return save.stats.arenaBestRank ?? 0;
    case 'achievementTiers':
      return achievementTiers(save);
    case 'expeditionLocalesVisited':
      return Math.min(LOCALES.length, countPrefixed(save, 'localeVisited'));
    default:
      return 0;
  }
}

/** Every distinct monster in the game — used by the codex screen's totals. */
export const TOTAL_MONSTERS = MONSTERS.length;
