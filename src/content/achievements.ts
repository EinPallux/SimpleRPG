/**
 * Achievements (GAME_DESIGN.md §13, CONTENT_CATALOG.md §10): the long tail —
 * 70 definitions across 7 categories, most tiered bronze/silver/gold.
 *
 * Every claimed tier grants **+3 to all attributes** (stacking, engine-side);
 * final tiers pay `gems`, and signature feats hand out a `titleId` from
 * `content/titles.ts`. Nothing here is an event: an achievement is a threshold
 * on a lifetime `MetricId` (raw stat keys pass through, derived metrics resolve
 * in `engine/metrics.ts`), so a reload can never lose progress and the whole
 * board is a pure function of the save (meta.ts header).
 *
 * Category volumes are fixed by CONTENT §10 — 12/14/12/10/10/8/4 = 70 — and
 * asserted in achievements.test.ts. Where the catalog lists a grouped ladder
 * ("Level 10/25/50/75/100/125") it becomes two 3-tier entries, the same way the
 * Character screen shows two separate rows.
 *
 * Tier notes for the ones that aren't literal:
 *   · patrol hours are stored as ticks of 30 min → 100 h = 200, 1,000 h = 2,000
 *   · "max elixirs 7 days straight" → 3 rack slots × 7 days = 21 elixirs drunk
 *   · "L50 with no deaths" has no expressible metric (a floor of zero on
 *     `dungeonBounces` is not a threshold), so the flawless-run feat it stands
 *     for is `arenaBestStreak` 25 — a long run nobody managed to end
 *   · the Krellbor rematch is a scripted humbling; the ledger only carries
 *     `arenaLosses`, and the first one is that fight
 */
import {
  achievementSchema,
  type AchievementCategory,
  type AchievementDef,
  type MetricId,
} from './meta';

/** id · category · metric · tiers · gems on the final tier · optional title. */
function a(
  id: string,
  category: AchievementCategory,
  metric: MetricId,
  tiers: number[],
  gems: number,
  titleId?: string,
): AchievementDef {
  const def: AchievementDef = { id, category, metric, tiers, nameKey: `achv.${id}`, gems };
  if (titleId) def.titleId = titleId;
  return def;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // -------------------------------------------------------------------------
  // Progression (12) — the hero, the map, the ballad and the daily ritual
  // -------------------------------------------------------------------------
  a('growth-spurt', 'progression', 'level', [10, 25, 50], 10),
  a('triple-digits', 'progression', 'level', [75, 100, 125], 25),
  a('fold-marks', 'progression', 'zonesUnlocked', [3, 6, 10], 15),
  a('chapter-and-verse', 'progression', 'storyChapter', [2, 5, 8], 20),
  a('known-at-the-door', 'progression', 'daysPlayed', [7, 30, 100], 12),
  a('year-of-mud', 'progression', 'daysPlayed', [365], 25),
  a('errand-economy', 'progression', 'questsCompleted', [25, 250, 1000], 15),
  a('hinge-whisperer', 'progression', 'dailyChestsOpened', [10, 50, 200], 12),
  a('nothing-left-in-the-tank', 'progression', 'vigorSpent', [2000, 50_000, 500_000], 15),
  a('creature-of-habit', 'progression', 'wheelSpins', [30, 180, 365], 15),
  a('coin-return', 'progression', 'gachaTosses', [25, 250, 1000], 15),
  // Self-referential on purpose (S&F's trophy shelf): 120 of TOTAL_TIERS 146.
  a('shelf-life', 'progression', 'achievementTiers', [20, 60, 120], 20),

  // -------------------------------------------------------------------------
  // Combat (14) — the sand, the stairwell and the two signature feats
  // -------------------------------------------------------------------------
  a('regular-in-the-sand', 'combat', 'arenaWins', [10, 100, 1000], 20),
  a('signed-the-waiver', 'combat', 'arenaFights', [50, 500, 5000], 12),
  a('on-a-tear', 'combat', 'arenaBestStreak', [5, 10], 10),
  a('seam-finder', 'combat', 'crits', [100, 1000, 10_000], 15),
  a('shield-first', 'combat', 'blocks', [500], 6),
  a('immovable-object', 'combat', 'blocks', [2500, 10_000], 15),
  a('elsewhere-professionally', 'combat', 'evades', [500], 6),
  a('rumour-of-a-person', 'combat', 'evades', [2500, 10_000], 15),
  a('stairwell-enthusiast', 'combat', 'dungeonFloors', [5, 25, 50], 15),
  a('basement-cartographer', 'combat', 'dungeonFloors', [100, 250, 500], 22),
  a('the-long-tally', 'combat', 'monstersSlain', [250, 5000, 50_000], 15),
  a('not-a-scratch', 'combat', 'flawlessBossKills', [1], 5, 'the-unbroken'),
  a('one-point-of-dignity', 'combat', 'clutchWins', [1], 5, 'the-underdog'),
  a('statistically-concerning', 'combat', 'clutchWins', [5, 25], 15),

  // -------------------------------------------------------------------------
  // Collection (12) — codex pages, the menagerie, the stable, the wardrobe
  // -------------------------------------------------------------------------
  a('started-a-filing-system', 'collection', 'codexPct', [10, 50], 12),
  a('every-last-page', 'collection', 'codexPct', [100], 25, 'the-completionist'),
  a('know-thy-neighbour', 'collection', 'bestiaryPct', [25, 60, 100], 18),
  a('catalogued-and-judged', 'collection', 'armoryPct', [25, 60, 100], 18),
  a('marginalia', 'collection', 'loreRead', [10, 40], 10),
  a('small-committee', 'collection', 'petsOwned', [4, 10, 16], 18),
  a('fewer-problems', 'collection', 'mountTier', [2, 3, 4], 12),
  a('matching-finally', 'collection', 'setsCompleted', [1, 5, 14], 22, 'the-collector'),
  a('nearly-a-set', 'collection', 'setPiecesFound', [10, 60, 300], 12),
  a('named-things', 'collection', 'legendariesOwned', [1, 4, 8], 22),
  a('lightning-repeatedly', 'collection', 'legendariesFound', [1, 5, 20], 15),
  a('framed', 'collection', 'framesOwned', [3, 12], 12),

  // -------------------------------------------------------------------------
  // Economy (10) — the pouch, the anvil, the vendor and one deep regret
  // -------------------------------------------------------------------------
  a('gold-fever', 'economy', 'goldEarned', [100_000, 10_000_000, 1_000_000_000], 25, 'the-affluent'),
  a('money-moves-out', 'economy', 'goldSpent', [100_000, 10_000_000, 1_000_000_000], 20),
  a('self-improvement-budget', 'economy', 'attrTotalBought', [100, 1000, 5000], 18),
  a('one-expensive-pushup', 'economy', 'biggestAttrPurchase', [10_000_000], 15),
  a('anvils-favourite', 'economy', 'maxUpgradeReached', [20], 18),
  a('ring-ring-ring', 'economy', 'upgradesForged', [25, 250, 1000], 12),
  a('regret-recycled', 'economy', 'itemsDismantled', [100, 1000], 12),
  a('vendors-best-friend', 'economy', 'itemsSold', [100, 1000, 10_000], 12),
  a('just-browsing', 'economy', 'shopPurchases', [50, 500], 12),
  a('you-sold-what', 'economy', 'legendariesSold', [1], 5, 'the-regretful'),

  // -------------------------------------------------------------------------
  // Exploration (10) — the board, the road, the lantern round
  // -------------------------------------------------------------------------
  a('boots-on-the-board', 'exploration', 'missionsCompleted', [50, 500, 2500], 20, 'the-persistent'),
  a('ten-thousand-errands', 'exploration', 'missionsCompleted', [10_000], 25),
  a('out-of-office', 'exploration', 'expeditions', [10, 100], 18, 'the-wayfarer'),
  a('professional-elsewhere', 'exploration', 'expeditions', [500], 22),
  a('gilded-latch', 'exploration', 'expeditionsGold', [10, 100], 15),
  a('choose-wisely-repeatedly', 'exploration', 'expeditionCards', [50, 500, 2500], 12),
  a('all-four-corners', 'exploration', 'expeditionLocalesVisited', [4], 10),
  a('first-full-round', 'exploration', 'patrolTicks', [48], 3), // 24 h of patrol
  a('night-shift', 'exploration', 'patrolTicks', [200, 2000], 20, 'the-vigilant'), // 100 h / 1,000 h
  a('local-expert', 'exploration', 'bestZoneBestiaryPct', [100], 15, 'beast-knower'),

  // -------------------------------------------------------------------------
  // Mastery (8) — one-off feats of luck, nerve and stubborn routine
  // -------------------------------------------------------------------------
  a('the-wheel-is-honest', 'mastery', 'wheelJackpots', [1], 5, 'the-fortunate'),
  a('owed-and-paid', 'mastery', 'gachaPityHits', [1], 5),
  a('twenty-five-straight', 'mastery', 'arenaBestStreak', [25], 20),
  a('punching-upward', 'mastery', 'bossesOutlevelled', [1], 5, 'giant-slayer'),
  a('fully-medicated', 'mastery', 'elixirsDrunk', [21], 12), // 3 slots × 7 days
  a('ten-of-ten-thirty-times', 'mastery', 'perfectArenaDays', [30], 22, 'the-relentless'),
  a('twenty-eight-for-twenty-eight', 'mastery', 'calendarDaysClaimed', [28], 20, 'the-devout'),
  a('meter-pegged', 'mastery', 'fullActivityDays', [100], 25, 'the-patient'),

  // -------------------------------------------------------------------------
  // Secrets (4) — undocumented in the UI until they pop
  // -------------------------------------------------------------------------
  a('fifty-wishes', 'secrets', 'wellClicks', [50], 8, 'wishful-thinker'),
  a('rematch-denied', 'secrets', 'arenaLosses', [1], 5, 'the-humbled'),
  a('the-cat-decides', 'secrets', 'catPetDays', [30], 10, 'cat-person'),
  a('read-the-whole-thing', 'secrets', 'loreRead', [80], 20, 'the-scholar'),
];

/** Board order on the Achievements screen (UI_DESIGN §7 tab strip). */
export const ACHIEVEMENT_CATEGORIES: readonly AchievementCategory[] = [
  'progression',
  'combat',
  'collection',
  'economy',
  'exploration',
  'mastery',
  'secrets',
];

export const ACHIEVEMENTS_BY_CATEGORY: Record<AchievementCategory, readonly AchievementDef[]> =
  ACHIEVEMENT_CATEGORIES.reduce(
    (acc, category) => {
      acc[category] = ACHIEVEMENTS.filter((achievement) => achievement.category === category);
      return acc;
    },
    {} as Record<AchievementCategory, readonly AchievementDef[]>,
  );

export function getAchievement(id: string): AchievementDef {
  const def = ACHIEVEMENTS.find((achievement) => achievement.id === id);
  if (!def) throw new Error(`Unknown achievement: ${id}`);
  return def;
}

export function achievementsOfCategory(category: AchievementCategory): readonly AchievementDef[] {
  return ACHIEVEMENTS_BY_CATEGORY[category];
}

/**
 * Every tier in the game — the engine multiplies this by the +3/tier grant for
 * the "claim everything and you're +N to all attributes" line on the screen.
 */
export const TOTAL_TIERS: number = ACHIEVEMENTS.reduce(
  (total, achievement) => total + achievement.tiers.length,
  0,
);

/** i18n helpers (CONTENT §13: `achv.{id}.name` / `.desc`). */
export function achievementNameKey(id: string): string {
  return `achv.${id}.name`;
}
export function achievementDescKey(id: string): string {
  return `achv.${id}.desc`;
}

/** Titles handed out by the board — cross-checked against `content/titles.ts`. */
export function achievementTitleIds(): string[] {
  return ACHIEVEMENTS.flatMap((achievement) =>
    achievement.titleId ? [achievement.titleId] : [],
  );
}

export { achievementSchema };
