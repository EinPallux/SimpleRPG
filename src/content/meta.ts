/**
 * The meta layer's shared contracts (M6): quests, achievements, story, titles,
 * calendar, bestiary. Every module here is DATA — the engine reads it.
 *
 * Design (GAME_DESIGN §12–14, decision recorded in §12.3): the **stat ledger**
 * is the backbone. `save.stats` accumulates lifetime counters; quests measure a
 * period delta against a snapshot taken at the period's reset; achievements and
 * story steps measure lifetime values. Nothing needs an event bus, everything
 * is a pure function of the save, and a reload can never lose progress.
 *
 * Metrics that aren't raw counters (level, sets completed, codex %) resolve
 * through `engine/metrics.ts` — content references them by id, so adding a
 * metric never touches the content modules.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// The stat ledger
// ---------------------------------------------------------------------------

/**
 * Every counter `save.stats` may carry. Systems increment these as they run
 * (engine/*); quests/achievements/story only ever read them.
 */
export const STAT_KEYS = [
  // Adventure
  'missionsCompleted',
  'vigorSpent',
  'patrolTicks',
  'expeditions',
  'expeditionsGold', // gold-tier chests opened
  'expeditionCards', // cards resolved
  // Combat
  'arenaFights',
  'arenaWins',
  'arenaLosses',
  'arenaWinStreak', // current streak
  'arenaBestStreak',
  'arenaBestRank', // best (lowest) ladder rank ever held
  'dungeonFloors',
  'dungeonBounces',
  'monstersSlain',
  'crits',
  'blocks',
  'evades',
  'flawlessBossKills', // boss beaten without losing a strike-exchange
  'clutchWins', // won with < 5% HP left
  'bossesOutlevelled', // beat a boss 10+ levels above you
  // Economy
  'goldEarned',
  'goldSpent',
  'attrsBought',
  'biggestAttrPurchase',
  'itemsSold',
  'itemsDismantled',
  'upgradesForged',
  'maxUpgradeReached',
  'shopPurchases',
  'elixirsDrunk',
  'legendariesSold',
  // Fortune
  'wheelSpins',
  'wheelJackpots',
  'gachaTosses',
  'gachaPityHits',
  'gachaDupes', // set/legendary/pet dupes converted rather than wasted
  // Menagerie & Stable (M7) — how many pets OWNED is derived (`petsOwned`);
  // these two are the things only the ledger can remember.
  'petLevelsFed',
  'mountsBought',
  // Collection
  'setPiecesFound',
  'legendariesFound',
  // Meta
  'questsCompleted',
  'dailyChestsOpened',
  'perfectArenaDays', // used all 10 rewarded bouts
  'fullActivityDays', // activity meter hit 100
  'calendarDaysClaimed',
  'daysPlayed',
  // Secrets (GAME_DESIGN §13, CONTENT §10)
  'wellClicks',
  'catPets',
  'catPetDays',
  'loreRead',
] as const;

export type StatKey = (typeof STAT_KEYS)[number];

/**
 * Anything content can measure. Raw stat keys pass through; the rest are
 * derived and resolved by `engine/metrics.ts`. Parameterized forms use a
 * `namespace:argument` shape.
 */
export type MetricId =
  | StatKey
  | 'level'
  | 'zonesUnlocked'
  | 'storyChapter'
  | 'storyStep'
  | 'setsCompleted'
  | 'setPiecesOwned'
  | 'legendariesOwned'
  | 'uniquesOwned' // the eight NAMED legendaries, not any legendary-rarity item
  | 'petsOwned'
  | 'framesOwned'
  | 'mountTier'
  | 'codexPct'
  | 'bestiaryPct'
  | 'armoryPct'
  | 'bestZoneBestiaryPct'
  | 'attrTotalBought'
  | 'arenaRank' // current rank (LOWER is better — see `lowerIsBetter`)
  | 'achievementTiers'
  | 'expeditionLocalesVisited'
  | `dungeonFloors:${string}` // floors cleared in one wing
  | `zoneBestiary:${number}`; // monsters discovered in one zone

/** Metrics where a SMALLER value is better (rank). Engine compares accordingly. */
export const LOWER_IS_BETTER: readonly MetricId[] = ['arenaRank', 'arenaBestRank'];

// ---------------------------------------------------------------------------
// Rewards (shared by quests, story steps, calendar slots)
// ---------------------------------------------------------------------------

/**
 * Reward package. `gold`/`xp` are multipliers of a 10-vigor frontier mission
 * (BALANCING §2.3) so payouts stay level-independent; everything else is flat.
 */
export interface MetaReward {
  /** × missionGold(level, 10) */
  gold?: number;
  /** × missionXp(level, 10) */
  xp?: number;
  gems?: number;
  scraps?: number;
  dust?: number;
  treats?: number;
  /** roll a chest-table item at hero level */
  item?: boolean;
  /** a set piece from the hero's eligible pool (monthly marathons, ch. finales) */
  setPiece?: boolean;
  /** an elixir (calendar) — engine picks the tier by level */
  elixir?: boolean;
  /** cosmetic frame id (calendar day 28, chapter finales) */
  frameId?: string;
  /** title awarded (story chapters, signature achievements) */
  titleId?: string;
  /** a pet joins the menagerie (chapter 5 — Fenn's three friends) */
  petId?: string;
}

export const metaRewardSchema = z
  .object({
    gold: z.number().optional(),
    xp: z.number().optional(),
    gems: z.number().int().optional(),
    scraps: z.number().int().optional(),
    dust: z.number().int().optional(),
    treats: z.number().int().optional(),
    item: z.boolean().optional(),
    setPiece: z.boolean().optional(),
    elixir: z.boolean().optional(),
    frameId: z.string().optional(),
    titleId: z.string().optional(),
    petId: z.string().optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Quests (GAME_DESIGN §12.2)
// ---------------------------------------------------------------------------

export type Cadence = 'daily' | 'weekly' | 'monthly';

export interface QuestDef {
  id: string;
  cadence: Cadence;
  /** what to measure — progress is (current − snapshot at period start) */
  metric: MetricId;
  target: number;
  /** i18n `quest.{id}` — imperative, one line ("Spend 80 vigor") */
  nameKey: string;
  reward: MetaReward;
  /** activity points toward the daily chest (dailies only, pool sums ≫ 100) */
  activity?: number;
  /** never offered below this hero level (keeps early boards achievable) */
  minLevel?: number;
}

export const questSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    cadence: z.enum(['daily', 'weekly', 'monthly']),
    metric: z.string(),
    target: z.number().positive(),
    nameKey: z.string(),
    reward: metaRewardSchema,
    activity: z.number().int().positive().optional(),
    minLevel: z.number().int().positive().optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Achievements & titles (GAME_DESIGN §13)
// ---------------------------------------------------------------------------

export type AchievementCategory =
  'progression' | 'combat' | 'collection' | 'economy' | 'exploration' | 'mastery' | 'secrets';

export interface AchievementDef {
  id: string;
  category: AchievementCategory;
  metric: MetricId;
  /** ascending thresholds; 1 entry = untiered, 3 = bronze/silver/gold */
  tiers: number[];
  /**
   * The i18n BASE key (`achv.{id}`) — not a resolvable key on its own. Use
   * `achievementNameKey(id)` / `achievementDescKey(id)`, which append `.name`
   * and `.desc`. (Sets store a complete key here; achievements and pets store a
   * base. Passing this straight to `t()` silently renders the raw key.)
   */
  nameKey: string;
  /** gems paid on the FINAL tier (§13: gold tiers pay gems) */
  gems?: number;
  /** title unlocked by the final tier */
  titleId?: string;
}

export const achievementSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    category: z.enum([
      'progression',
      'combat',
      'collection',
      'economy',
      'exploration',
      'mastery',
      'secrets',
    ]),
    metric: z.string(),
    tiers: z.array(z.number()).min(1).max(3),
    nameKey: z.string(),
    gems: z.number().int().positive().optional(),
    titleId: z.string().optional(),
  })
  .strict();

export interface TitleDef {
  id: string;
  /** i18n `title.{id}` — the suffix shown after a name ("the Patient") */
  nameKey: string;
  source: 'achievement' | 'story' | 'arena' | 'secret' | 'mount';
}

export const titleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    nameKey: z.string(),
    source: z.enum(['achievement', 'story', 'arena', 'secret', 'mount']),
  })
  .strict();

// ---------------------------------------------------------------------------
// Story — "The Ballad of Brambleford" (GAME_DESIGN §12.1, CONTENT §9)
// ---------------------------------------------------------------------------

export interface StoryStepDef {
  /** 1..8 */
  chapter: number;
  /** 1..5 within the chapter */
  step: number;
  /** hero level the step becomes available (chapter gate on step 1) */
  minLevel: number;
  /** completion condition, measured the moment the board is opened */
  goal: { metric: MetricId; target: number };
  /** which screen the "guided arrow" deep-links to */
  screen: string;
  reward: MetaReward;
  /** i18n `story.c{chapter}.s{step}.title` / `.body` / `.done` */
  keyBase: string;
}

export const storyStepSchema = z
  .object({
    chapter: z.number().int().min(1).max(8),
    step: z.number().int().min(1).max(5),
    minLevel: z.number().int().min(1),
    goal: z.object({ metric: z.string(), target: z.number() }).strict(),
    screen: z.string(),
    reward: metaRewardSchema,
    keyBase: z.string(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Login calendar (GAME_DESIGN §14, CONTENT §15)
// ---------------------------------------------------------------------------

export interface CalendarSlotDef {
  /** 1..28 */
  day: number;
  reward: MetaReward;
}

export const calendarSlotSchema = z
  .object({ day: z.number().int().min(1).max(28), reward: metaRewardSchema })
  .strict();

// ---------------------------------------------------------------------------
// Bestiary (CONTENT §4) — the codex's biggest page
// ---------------------------------------------------------------------------

export type MonsterArchetype = 'grunt' | 'swift' | 'caster' | 'brute' | 'elite';

export interface MonsterDef {
  id: string;
  /** 1..10, matching content/zones.ts */
  zoneIndex: number;
  archetype: MonsterArchetype;
  /** i18n `monster.{id}.name` + `monster.{id}.lore` (lore reveals at 10 kills) */
  nameKey: string;
}

export const monsterSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    zoneIndex: z.number().int().min(1).max(10),
    archetype: z.enum(['grunt', 'swift', 'caster', 'brute', 'elite']),
    nameKey: z.string(),
  })
  .strict();

/** Kills before a monster's codex lore unlocks (GAME_DESIGN §13). */
export const LORE_KILL_THRESHOLD = 10;
