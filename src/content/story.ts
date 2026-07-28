/**
 * Story questline — "The Ballad of Brambleford" (GAME_DESIGN.md §12.1,
 * CONTENT_CATALOG.md §9): 8 chapters × 5 steps = 40 aimed nudges that double as
 * the game's deep onboarding. Each step points at something you were going to
 * do anyway, wraps it in prose, and pays a small purse for doing it on purpose.
 *
 * Structure (decision recorded here and in CONTENT §9): **chapters gate by
 * hero level and progress independently of one another; steps inside a chapter
 * are linear.** A level-45 hero can work chapter 6 while chapter 5's pet steps
 * sit unfinished — which is deliberate, because pets land in M7 and chapter 5
 * is authored against its true goals rather than against placeholders. Nothing
 * downstream of chapter 5 is ever blocked by it.
 *
 * Goals are measured as **lifetime** values off the stat ledger (meta.ts), so
 * targets for a repeated metric ascend across the whole questline, never just
 * within a chapter. Narrative beats with no natural counter ("sign the
 * ledger", "Fenn's plea") use `level` at the chapter gate: they complete on
 * arrival, because they are a beat you read, not a grind you run.
 *
 * Rewards follow BALANCING §2.3 conventions — `gold`/`xp` are multipliers of a
 * 10-vigor frontier mission, everything else is flat. Step 5 of each chapter is
 * the finale: a gem purse rising 5 → 25 and the chapter's title (titles.ts).
 */
import { storyStepSchema, type MetricId, type MetaReward, type StoryStepDef } from './meta';

/** Chapter gates (CONTENT §9) — chapter n becomes visible at CHAPTER_GATES[n-1]. */
const CHAPTER_GATES = [1, 10, 20, 25, 35, 45, 70, 95] as const;

export interface ChapterDef {
  /** 1..8 */
  chapter: number;
  /** hero level the chapter unlocks */
  minLevel: number;
  /** i18n `story.c{n}.name` */
  nameKey: string;
}

export const CHAPTERS: readonly ChapterDef[] = CHAPTER_GATES.map((minLevel, i) => ({
  chapter: i + 1,
  minLevel,
  nameKey: `story.c${i + 1}.name`,
}));

/** Terse constructor — keyBase is always `story.c{chapter}.s{step}`. */
function step(
  chapter: number,
  stepNo: number,
  minLevel: number,
  metric: MetricId,
  target: number,
  screen: string,
  reward: MetaReward,
): StoryStepDef {
  return {
    chapter,
    step: stepNo,
    minLevel,
    goal: { metric, target },
    screen,
    reward,
    keyBase: `story.c${chapter}.s${stepNo}`,
  };
}

export const STORY_STEPS: readonly StoryStepDef[] = [
  // — Chapter 1: Small Beginnings (L1) — the ledger, the board, the first bout.
  step(1, 1, 1, 'level', 1, 'tavern', { gold: 0.5, xp: 0.5 }),
  step(1, 2, 1, 'missionsCompleted', 3, 'tavern', { gold: 1, xp: 1 }),
  step(1, 3, 2, 'level', 2, 'character', { gold: 0.5, xp: 0.5, item: true }),
  step(1, 4, 3, 'attrsBought', 1, 'character', { gold: 1, xp: 1, gems: 1 }),
  // Arena opens at L5 (nav.ts) — Krellbor cannot be fought before then.
  step(1, 5, 5, 'arenaWins', 1, 'arena', {
    gold: 2,
    xp: 2,
    gems: 5,
    titleId: 'newly-signed',
  }),

  // — Chapter 2: The Cellar Situation (L10) — first dungeon, first smith.
  step(2, 1, 10, 'level', 10, 'tavern', { gold: 1, xp: 1 }),
  step(2, 2, 10, 'missionsCompleted', 30, 'tavern', { gold: 1.5, xp: 1, gems: 1 }),
  // Dungeons open at L12 (nav.ts / DUNGEONS[0].unlockLevel).
  step(2, 3, 12, 'dungeonFloors:rat-cellars', 1, 'dungeons', { gold: 1, xp: 1.5, item: true }),
  step(2, 4, 12, 'shopPurchases', 1, 'shops', { gold: 1.5, xp: 1, scraps: 12 }),
  step(2, 5, 12, 'dungeonFloors:rat-cellars', 3, 'dungeons', {
    gold: 2,
    xp: 2,
    gems: 8,
    titleId: 'cellar-cleaner',
  }),

  // — Chapter 3: Dress for Success (L20) — sets and the forge.
  step(3, 1, 20, 'level', 20, 'tavern', { gold: 1, xp: 1 }),
  step(3, 2, 20, 'dungeonFloors:rat-cellars', 5, 'dungeons', { gold: 1.5, xp: 1.5 }),
  step(3, 3, 20, 'setPiecesFound', 1, 'dungeons', { gold: 1, xp: 1, gems: 2 }),
  step(3, 4, 20, 'upgradesForged', 1, 'forge', { gold: 1, xp: 1, scraps: 20 }),
  step(3, 5, 20, 'setPiecesOwned', 2, 'character', {
    gold: 2,
    xp: 2,
    gems: 10,
    titleId: 'well-dressed',
  }),

  // — Chapter 4: The Damp Below (L25) — the crypt, the cove, Marla's regalia.
  step(4, 1, 25, 'level', 25, 'tavern', { gold: 1, xp: 1 }),
  step(4, 2, 25, 'dungeonFloors:sunken-crypt', 1, 'dungeons', { gold: 1.5, xp: 1.5, gems: 1 }),
  step(4, 3, 25, 'expeditions', 1, 'expeditions', { gold: 1.5, xp: 1.5, item: true }),
  step(4, 4, 25, 'dungeonFloors:sunken-crypt', 3, 'dungeons', { gold: 1.5, xp: 1.5, gems: 2 }),
  step(4, 5, 25, 'setPiecesFound', 4, 'dungeons', {
    gold: 2,
    xp: 2,
    gems: 12,
    setPiece: true,
    titleId: 'the-damp',
  }),

  // — Chapter 5: A Peculiar Menagerie (L35) — Fenn's three friends.
  //   Each of the first three steps hands over one of them, and the NEXT step
  //   asks you to have it: the chapter is its own unlock chain, so nothing here
  //   waits on a drop the player cannot influence.
  step(5, 1, 35, 'level', 35, 'menagerie', { gold: 1, xp: 1, petId: 'moss-boar' }),
  step(5, 2, 35, 'petsOwned', 1, 'menagerie', {
    gold: 1.5,
    xp: 1.5,
    treats: 10,
    petId: 'pebble-golem',
  }),
  step(5, 3, 35, 'petsOwned', 2, 'menagerie', {
    gold: 1.5,
    xp: 1.5,
    treats: 10,
    petId: 'dream-moth',
  }),
  step(5, 4, 35, 'petsOwned', 3, 'menagerie', { gold: 1.5, xp: 1.5, treats: 15 }),
  step(5, 5, 35, 'level', 35, 'menagerie', {
    gold: 2,
    xp: 2,
    gems: 15,
    titleId: 'friend-of-beasts',
  }),

  // — Chapter 6: Roots of the Problem (L45) — Ironroot, Sunscorch, the Arcanum.
  step(6, 1, 45, 'level', 45, 'tavern', { gold: 1, xp: 1 }),
  step(6, 2, 45, 'dungeonFloors:ironroot-hollows', 1, 'dungeons', { gold: 1.5, xp: 1.5, gems: 1 }),
  step(6, 3, 45, 'zonesUnlocked', 6, 'tavern', { gold: 1.5, xp: 1.5, item: true }),
  step(6, 4, 45, 'elixirsDrunk', 1, 'shops', { gold: 1, xp: 1, elixir: true }),
  step(6, 5, 45, 'dungeonFloors:ironroot-hollows', 5, 'dungeons', {
    gold: 2,
    xp: 2,
    gems: 18,
    titleId: 'the-rootbreaker',
  }),

  // — Chapter 7: The Glass Ladder (L70) — the Spire, the ladder, the reforge.
  step(7, 1, 70, 'level', 70, 'tavern', { gold: 1, xp: 1 }),
  step(7, 2, 70, 'dungeonFloors:obsidian-spire', 1, 'dungeons', { gold: 1.5, xp: 1.5, gems: 2 }),
  // arenaBestRank is LOWER-is-better (meta.ts LOWER_IS_BETTER): rank ≤ 100.
  step(7, 3, 70, 'arenaBestRank', 100, 'arena', { gold: 2, xp: 2, gems: 3 }),
  step(7, 4, 70, 'maxUpgradeReached', 5, 'forge', { gold: 1.5, xp: 1.5, dust: 8 }),
  step(7, 5, 70, 'dungeonFloors:obsidian-spire', 5, 'dungeons', {
    gold: 2,
    xp: 2,
    gems: 20,
    titleId: 'glass-climber',
  }),

  // — Chapter 8: The Pale Invitation (L95) — the court, Duskgate, the finale.
  step(8, 1, 95, 'level', 95, 'tavern', { gold: 1, xp: 1 }),
  step(8, 2, 95, 'dungeonFloors:pale-court', 1, 'dungeons', { gold: 1.5, xp: 1.5, gems: 2 }),
  // Duskgate is zone 10 and opens at L105 (zones.ts) — the step waits for it.
  step(8, 3, 105, 'zonesUnlocked', 10, 'tavern', { gold: 2, xp: 2, gems: 2 }),
  step(8, 4, 105, 'dungeonFloors:pale-court', 5, 'dungeons', {
    gold: 2,
    xp: 2,
    gems: 3,
    item: true,
  }),
  step(8, 5, 105, 'dungeonFloors:pale-court', 10, 'dungeons', {
    gold: 2,
    xp: 2,
    gems: 25,
    setPiece: true,
    titleId: 'pale-kings-guest',
  }),
];

export const STORY_STEP_COUNT = STORY_STEPS.length;

/** The five steps of a chapter, in order. */
export function stepsOfChapter(chapter: number): StoryStepDef[] {
  return STORY_STEPS.filter((s) => s.chapter === chapter).sort((a, b) => a.step - b.step);
}

/** Hero level chapter `n` unlocks. Throws on an unknown chapter. */
export function chapterGate(chapter: number): number {
  const def = CHAPTERS.find((c) => c.chapter === chapter);
  if (!def) throw new Error(`Unknown story chapter: ${chapter}`);
  return def.minLevel;
}

/** One step by coordinates. Throws on an unknown (chapter, step). */
export function getStep(chapter: number, step: number): StoryStepDef {
  const def = STORY_STEPS.find((s) => s.chapter === chapter && s.step === step);
  if (!def) throw new Error(`Unknown story step: ${chapter}.${step}`);
  return def;
}

/** i18n helpers — `story.c{n}.s{m}.title` / `.body` / `.done`. */
export function stepTitleKey(def: StoryStepDef): string {
  return `${def.keyBase}.title`;
}
export function stepBodyKey(def: StoryStepDef): string {
  return `${def.keyBase}.body`;
}
export function stepDoneKey(def: StoryStepDef): string {
  return `${def.keyBase}.done`;
}

/** Chapter finales carry the title — convenience for the reward reveal. */
export function isFinale(def: StoryStepDef): boolean {
  return def.step === 5;
}

export { storyStepSchema };
export const storySchema = storyStepSchema;
