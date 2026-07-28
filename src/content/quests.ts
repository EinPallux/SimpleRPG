/**
 * Daily / weekly / monthly quests (GAME_DESIGN.md §12.2, contracts in
 * `content/meta.ts`). The board draws 3 dailies from a pool of 24, 3 weeklies
 * from 12 and 2 monthlies from 6 — 42 definitions in total.
 *
 * Progress is a **period delta**: (current stat − the snapshot taken at the
 * period's reset). Every `metric` here is therefore a monotonically increasing
 * counter from `STAT_KEYS`; derived metrics (level, arenaRank, codexPct) can
 * go sideways or down and are deliberately absent.
 *
 * Rewards use `MetaReward`, where `gold`/`xp` are multipliers of one 10-vigor
 * frontier mission (BALANCING §2.3) so a payout never has to be re-tuned per
 * level. Budget, per BALANCING §6 (quests/activity ≈ 3.5 M10/day) and the gem
 * income line (weeklies 3×3 = 9/wk, monthlies amortised ≈ 10/wk):
 *   · daily   — gold 1.5–3.5 · scraps 3–6 · treats 2–4 · 1 gem on the long ones
 *   · weekly  — 3 gems flat + scraps 20–40 + dust 2–5
 *   · monthly — 15–20 gems + a set piece on the two biggest + one frame
 *
 * `activity` feeds the Activity meter (0–100, Daily Chest at 100). Three
 * dailies sit on the board at once and every daily pays at least 30, so the
 * worst-possible board still reaches 90 and the core-loop trickle tops it off.
 *
 * `minLevel` keeps a board from offering something the hero cannot reach yet:
 * arena/wheel 5, expeditions 8, shops 10, dungeons/elixirs 12, forge 15.
 */
import { questSchema, type Cadence, type QuestDef } from './meta';

// ---------------------------------------------------------------------------
// Daily — 24, the board shows 3 (GAME_DESIGN §12.2)
// ---------------------------------------------------------------------------

export const DAILY_QUESTS: readonly QuestDef[] = [
  // — Vigor & missions: the backbone —
  {
    id: 'daily-vigor-80',
    cadence: 'daily',
    metric: 'vigorSpent',
    target: 80,
    nameKey: 'quest.daily-vigor-80',
    reward: { gold: 2, xp: 0.8, treats: 2 },
    activity: 32,
  },
  {
    id: 'daily-vigor-150',
    cadence: 'daily',
    metric: 'vigorSpent',
    target: 150,
    nameKey: 'quest.daily-vigor-150',
    reward: { gold: 3.2, xp: 1.2, scraps: 5 },
    activity: 40,
  },
  {
    id: 'daily-missions-6',
    cadence: 'daily',
    metric: 'missionsCompleted',
    target: 6,
    nameKey: 'quest.daily-missions-6',
    reward: { gold: 1.8, xp: 0.5, scraps: 3 },
    activity: 30,
  },
  {
    id: 'daily-missions-12',
    cadence: 'daily',
    metric: 'missionsCompleted',
    target: 12,
    nameKey: 'quest.daily-missions-12',
    reward: { gold: 3, xp: 1, treats: 3 },
    activity: 38,
  },
  // — Patrol —
  {
    id: 'daily-patrol-8',
    cadence: 'daily',
    metric: 'patrolTicks',
    target: 8,
    nameKey: 'quest.daily-patrol-8',
    reward: { gold: 1.5, treats: 2 },
    activity: 30,
  },
  {
    id: 'daily-patrol-16',
    cadence: 'daily',
    metric: 'patrolTicks',
    target: 16,
    nameKey: 'quest.daily-patrol-16',
    reward: { gold: 2.5, xp: 0.6, scraps: 4 },
    activity: 36,
  },
  // — Expeditions —
  {
    id: 'daily-expedition-1',
    cadence: 'daily',
    metric: 'expeditions',
    target: 1,
    nameKey: 'quest.daily-expedition-1',
    reward: { gold: 2.2, xp: 0.8, scraps: 4 },
    activity: 33,
    minLevel: 8,
  },
  {
    id: 'daily-expedition-2',
    cadence: 'daily',
    metric: 'expeditions',
    target: 2,
    nameKey: 'quest.daily-expedition-2',
    reward: { gold: 3.5, xp: 1.2, scraps: 6, gems: 1 },
    activity: 40,
    minLevel: 8,
  },
  // — Arena —
  {
    id: 'daily-arena-fights-5',
    cadence: 'daily',
    metric: 'arenaFights',
    target: 5,
    nameKey: 'quest.daily-arena-fights-5',
    reward: { gold: 1.8, treats: 2 },
    activity: 30,
    minLevel: 5,
  },
  {
    id: 'daily-arena-wins-3',
    cadence: 'daily',
    metric: 'arenaWins',
    target: 3,
    nameKey: 'quest.daily-arena-wins-3',
    reward: { gold: 2, xp: 0.6, scraps: 3 },
    activity: 32,
    minLevel: 5,
  },
  {
    id: 'daily-arena-wins-6',
    cadence: 'daily',
    metric: 'arenaWins',
    target: 6,
    nameKey: 'quest.daily-arena-wins-6',
    reward: { gold: 3.2, xp: 1, scraps: 5, gems: 1 },
    activity: 38,
    minLevel: 5,
  },
  // — Dungeons —
  {
    id: 'daily-dungeon-floor-1',
    cadence: 'daily',
    metric: 'dungeonFloors',
    target: 1,
    nameKey: 'quest.daily-dungeon-floor-1',
    reward: { gold: 3, xp: 1.5, scraps: 6, gems: 1 },
    activity: 40,
    minLevel: 12,
  },
  // — Fortune & shops —
  {
    id: 'daily-wheel-3',
    cadence: 'daily',
    metric: 'wheelSpins',
    target: 3,
    nameKey: 'quest.daily-wheel-3',
    reward: { gold: 1.5, treats: 3 },
    activity: 30,
    minLevel: 5,
  },
  {
    id: 'daily-shop-2',
    cadence: 'daily',
    metric: 'shopPurchases',
    target: 2,
    nameKey: 'quest.daily-shop-2',
    reward: { gold: 2, scraps: 4 },
    activity: 32,
    minLevel: 10,
  },
  // — Attributes & upkeep —
  {
    id: 'daily-attrs-8',
    cadence: 'daily',
    metric: 'attrsBought',
    target: 8,
    nameKey: 'quest.daily-attrs-8',
    reward: { gold: 1.6, xp: 0.5, treats: 2 },
    activity: 30,
  },
  {
    id: 'daily-attrs-25',
    cadence: 'daily',
    metric: 'attrsBought',
    target: 25,
    nameKey: 'quest.daily-attrs-25',
    reward: { gold: 2.6, xp: 0.8, scraps: 4 },
    activity: 36,
  },
  {
    id: 'daily-forge-2',
    cadence: 'daily',
    metric: 'upgradesForged',
    target: 2,
    nameKey: 'quest.daily-forge-2',
    reward: { gold: 2.2, scraps: 5 },
    activity: 34,
    minLevel: 15,
  },
  {
    id: 'daily-elixir-1',
    cadence: 'daily',
    metric: 'elixirsDrunk',
    target: 1,
    nameKey: 'quest.daily-elixir-1',
    reward: { gold: 1.8, treats: 3 },
    activity: 30,
    minLevel: 12,
  },
  {
    id: 'daily-dismantle-2',
    cadence: 'daily',
    metric: 'itemsDismantled',
    target: 2,
    nameKey: 'quest.daily-dismantle-2',
    reward: { gold: 1.5, scraps: 6 },
    activity: 30,
  },
  {
    id: 'daily-sell-5',
    cadence: 'daily',
    metric: 'itemsSold',
    target: 5,
    nameKey: 'quest.daily-sell-5',
    reward: { gold: 2, treats: 2 },
    activity: 30,
  },
  // — Combat texture —
  {
    id: 'daily-slay-20',
    cadence: 'daily',
    metric: 'monstersSlain',
    target: 20,
    nameKey: 'quest.daily-slay-20',
    reward: { gold: 2.4, xp: 1, scraps: 4 },
    activity: 34,
  },
  {
    id: 'daily-crits-15',
    cadence: 'daily',
    metric: 'crits',
    target: 15,
    nameKey: 'quest.daily-crits-15',
    reward: { gold: 2, xp: 0.6, treats: 3 },
    activity: 32,
  },
  {
    id: 'daily-blocks-10',
    cadence: 'daily',
    metric: 'blocks',
    target: 10,
    nameKey: 'quest.daily-blocks-10',
    reward: { gold: 2.2, scraps: 3 },
    activity: 33,
    minLevel: 5,
  },
  {
    id: 'daily-evades-10',
    cadence: 'daily',
    metric: 'evades',
    target: 10,
    nameKey: 'quest.daily-evades-10',
    reward: { gold: 2.2, treats: 3 },
    activity: 33,
    minLevel: 5,
  },
];

// ---------------------------------------------------------------------------
// Weekly — 12, the board shows 3. Headline: 3 gems each + materials.
// ---------------------------------------------------------------------------

export const WEEKLY_QUESTS: readonly QuestDef[] = [
  {
    id: 'weekly-missions-40',
    cadence: 'weekly',
    metric: 'missionsCompleted',
    target: 40,
    nameKey: 'quest.weekly-missions-40',
    reward: { gems: 3, scraps: 24, dust: 2 },
  },
  {
    id: 'weekly-vigor-500',
    cadence: 'weekly',
    metric: 'vigorSpent',
    target: 500,
    nameKey: 'quest.weekly-vigor-500',
    reward: { gems: 3, scraps: 30, dust: 3 },
  },
  {
    id: 'weekly-patrol-70',
    cadence: 'weekly',
    metric: 'patrolTicks',
    target: 70,
    nameKey: 'quest.weekly-patrol-70',
    reward: { gems: 3, scraps: 22, dust: 2 },
  },
  {
    id: 'weekly-expeditions-6',
    cadence: 'weekly',
    metric: 'expeditions',
    target: 6,
    nameKey: 'quest.weekly-expeditions-6',
    reward: { gems: 3, scraps: 28, dust: 3 },
    minLevel: 8,
  },
  {
    id: 'weekly-arena-fights-40',
    cadence: 'weekly',
    metric: 'arenaFights',
    target: 40,
    nameKey: 'quest.weekly-arena-fights-40',
    reward: { gems: 3, scraps: 20, dust: 2 },
    minLevel: 5,
  },
  {
    id: 'weekly-arena-wins-25',
    cadence: 'weekly',
    metric: 'arenaWins',
    target: 25,
    nameKey: 'quest.weekly-arena-wins-25',
    reward: { gems: 3, scraps: 32, dust: 4 },
    minLevel: 5,
  },
  {
    id: 'weekly-dungeon-floors-2',
    cadence: 'weekly',
    metric: 'dungeonFloors',
    target: 2,
    nameKey: 'quest.weekly-dungeon-floors-2',
    reward: { gems: 3, scraps: 40, dust: 5 },
    minLevel: 12,
  },
  {
    id: 'weekly-attrs-60',
    cadence: 'weekly',
    metric: 'attrsBought',
    target: 60,
    nameKey: 'quest.weekly-attrs-60',
    reward: { gems: 3, scraps: 26, dust: 3 },
  },
  {
    id: 'weekly-forge-10',
    cadence: 'weekly',
    metric: 'upgradesForged',
    target: 10,
    nameKey: 'quest.weekly-forge-10',
    reward: { gems: 3, scraps: 35, dust: 4 },
    minLevel: 15,
  },
  {
    id: 'weekly-dismantle-15',
    cadence: 'weekly',
    metric: 'itemsDismantled',
    target: 15,
    nameKey: 'quest.weekly-dismantle-15',
    reward: { gems: 3, scraps: 20, dust: 2, treats: 4 },
  },
  {
    id: 'weekly-slay-120',
    cadence: 'weekly',
    metric: 'monstersSlain',
    target: 120,
    nameKey: 'quest.weekly-slay-120',
    reward: { gems: 3, scraps: 30, dust: 3 },
  },
  {
    id: 'weekly-wheel-15',
    cadence: 'weekly',
    metric: 'wheelSpins',
    target: 15,
    nameKey: 'quest.weekly-wheel-15',
    reward: { gems: 3, scraps: 22, dust: 2, treats: 5 },
    minLevel: 5,
  },
];

// ---------------------------------------------------------------------------
// Monthly — 6 marathons, the board shows 2. 15–20 gems; the two biggest also
// pay a set piece, and the expedition marathon pays the cosmetic frame.
// ---------------------------------------------------------------------------

export const MONTHLY_QUESTS: readonly QuestDef[] = [
  {
    id: 'monthly-missions-500',
    cadence: 'monthly',
    metric: 'missionsCompleted',
    target: 500,
    nameKey: 'quest.monthly-missions-500',
    reward: { gems: 15, scraps: 40, dust: 4, item: true },
  },
  {
    id: 'monthly-arena-wins-200',
    cadence: 'monthly',
    metric: 'arenaWins',
    target: 200,
    nameKey: 'quest.monthly-arena-wins-200',
    reward: { gems: 20, scraps: 60, dust: 8, setPiece: true },
    minLevel: 5,
  },
  {
    id: 'monthly-dungeon-floors-20',
    cadence: 'monthly',
    metric: 'dungeonFloors',
    target: 20,
    nameKey: 'quest.monthly-dungeon-floors-20',
    reward: { gems: 20, scraps: 55, dust: 8, setPiece: true },
    minLevel: 12,
  },
  {
    id: 'monthly-expeditions-56',
    cadence: 'monthly',
    metric: 'expeditions',
    target: 56,
    nameKey: 'quest.monthly-expeditions-56',
    reward: { gems: 18, scraps: 45, dust: 6, frameId: 'long-road-laurel' },
    minLevel: 8,
  },
  {
    id: 'monthly-vigor-6500',
    cadence: 'monthly',
    metric: 'vigorSpent',
    target: 6500,
    nameKey: 'quest.monthly-vigor-6500',
    reward: { gems: 16, scraps: 50, dust: 5, item: true },
  },
  {
    id: 'monthly-attrs-2500',
    cadence: 'monthly',
    metric: 'attrsBought',
    target: 2500,
    nameKey: 'quest.monthly-attrs-2500',
    reward: { gems: 16, scraps: 45, dust: 5, treats: 12 },
  },
];

export const ALL_QUESTS: readonly QuestDef[] = [
  ...DAILY_QUESTS,
  ...WEEKLY_QUESTS,
  ...MONTHLY_QUESTS,
];

/** The pool a board of the given cadence draws from. */
export function questsOfCadence(cadence: Cadence): readonly QuestDef[] {
  switch (cadence) {
    case 'daily':
      return DAILY_QUESTS;
    case 'weekly':
      return WEEKLY_QUESTS;
    case 'monthly':
      return MONTHLY_QUESTS;
  }
}

export function getQuest(id: string): QuestDef {
  const def = ALL_QUESTS.find((q) => q.id === id);
  if (!def) throw new Error(`Unknown quest: ${id}`);
  return def;
}

/** Pool filtered to what a hero of this level may be offered (§12.2). */
export function questsForLevel(cadence: Cadence, level: number): readonly QuestDef[] {
  return questsOfCadence(cadence).filter((q) => level >= (q.minLevel ?? 1));
}

/** Activity the three dailies on the worst-possible board would pay. */
export function worstCaseDailyActivity(): number {
  return DAILY_QUESTS.map((q) => q.activity ?? 0)
    .sort((a, b) => a - b)
    .slice(0, 3)
    .reduce((sum, points) => sum + points, 0);
}

export { questSchema };
