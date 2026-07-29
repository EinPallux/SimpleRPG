/**
 * Save migrations (invariant 9: saves migrate forward, never wipe).
 * Each entry upgrades version N-1 → N. `migrateSave` walks a raw object up to
 * SAVE_VERSION, then zod-validates. Every future entry ships a fixture test in
 * `migrations.test.ts` alongside the schema bump.
 */
import { ONBOARDING_DONE } from '@/content/onboarding';
import { SAVE_VERSION } from '@/engine/constants';
import type { GameSave } from '@/engine/types';
import { parseGameSave } from './schema';

type RawSave = Record<string, unknown>;

/** Drop a key entirely — `{ k: undefined }` still trips zod's strict mode. */
function omit(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

const MIGRATIONS: Record<number, (raw: RawSave) => RawSave> = {
  /**
   * v1 (M0) → v2 (M1): activities carry typed payloads, items carry a class
   * cut, rng streams live in the save. v1 saves had no activities or items in
   * flight, so this is mostly annotation; rng streams lazy-init from worldSeed.
   */
  2: (raw) => {
    const inventory = raw.inventory as {
      equipped: Record<string, Record<string, unknown>>;
      backpack: Record<string, unknown>[];
    };
    const addClass = (item: Record<string, unknown>) => ({ classId: null, ...item });
    return {
      ...raw,
      version: 2,
      inventory: {
        ...inventory,
        equipped: Object.fromEntries(
          Object.entries(inventory.equipped).map(([slot, item]) => [slot, addClass(item)]),
        ),
        backpack: inventory.backpack.map(addClass),
      },
    };
  },
  /**
   * v2 (M1) → v3 (M2): the tavern board persists its three offers, and mission
   * payloads carry a flavor-text roll. In-flight v2 missions get flavor 0.
   */
  3: (raw) => {
    const activities = raw.activities as Record<string, unknown>;
    const mission = activities.mission as { payload?: Record<string, unknown> } | null;
    return {
      ...raw,
      version: 3,
      activities: {
        ...activities,
        tavernOffers: null,
        mission: mission ? { ...mission, payload: { flavor: 0, ...mission.payload } } : null,
      },
    };
  },
  /** v3 (M2) → v4 (M3): the town's shops keep their daily stock in the save. */
  4: (raw) => ({
    ...raw,
    version: 4,
    town: {
      shops: {
        weaponsmith: { stock: null, rerollUsed: false },
        armorer: { stock: null, rerollUsed: false },
        arcanum: { stock: null, rerollUsed: false },
      },
    },
  }),
  /**
   * v4 (M3) → v5 (M5): expeditions become interactive step sessions (the old
   * timed shape never shipped a start button, so nothing can be in flight),
   * and the day tracks how many were embarked on. Set pieces carry `setId`
   * (optional — pre-M5 items simply have none).
   */
  5: (raw) => {
    const activities = raw.activities as Record<string, unknown>;
    const daily = raw.daily as Record<string, unknown>;
    return {
      ...raw,
      version: 5,
      activities: { ...activities, expedition: null },
      daily: { ...daily, expeditions: 0 },
    };
  },
  /**
   * v5 (M5) → v6 (M6): the meta layer. Quest slates gain claim tracking and a
   * stat-ledger snapshot (progress is a delta, so a fresh snapshot simply means
   * "this period starts now"); the story becomes per-chapter step counters
   * (chapters gate by level and advance independently); titles, frames and
   * codex lore-read tracking arrive. Quest slates are cleared so the next reset
   * rolls them from the M6 pools.
   */
  6: (raw) => {
    const daily = raw.daily as Record<string, unknown>;
    const weekly = raw.weekly as Record<string, unknown>;
    const monthly = raw.monthly as Record<string, unknown>;
    const progress = raw.progress as Record<string, unknown>;
    const stats = (raw.stats ?? {}) as Record<string, number>;
    const codex = (progress.codex ?? {}) as Record<string, unknown>;
    // A fresh slate snapshots the ledger as it stands: nothing already earned
    // counts toward today's quests, which is what a player would expect.
    const freshBlock = {
      questIds: [],
      questProgress: {},
      questsClaimed: [],
      statsAt: { ...stats },
    };
    return {
      ...raw,
      version: 6,
      daily: {
        ...daily,
        ...freshBlock,
        questSwapUsed: false,
        activityChestClaimed: false,
      },
      weekly: { weekKey: weekly.weekKey, ...freshBlock },
      monthly: { monthKey: monthly.monthKey, ...freshBlock },
      progress: {
        ...omit(progress, 'storyStep'), // v5's linear pointer never shipped a UI
        story: {},
        titles: [],
        frames: [],
        codex: {
          monstersSeen: codex.monstersSeen ?? {},
          itemsSeen: codex.itemsSeen ?? {},
          loreSeen: {},
        },
      },
    };
  },
  /**
   * v6 (M6) → v7 (M8): the scripted first run (GAME_DESIGN §17).
   *
   * An existing save has, by definition, already played its first day — so it
   * is marked onboarded rather than dragged back through the cold open. The
   * per-screen tours are left UNSEEN: they are 15-second contextual tips, and
   * an existing hero who has never opened the Menagerie should still get one.
   */
  7: (raw) => {
    const progress = raw.progress as Record<string, unknown>;
    return {
      ...raw,
      version: 7,
      progress: {
        ...progress,
        onboarding: { step: ONBOARDING_DONE, skipped: true },
        toursSeen: [],
      },
    };
  },
  /**
   * v7 (M8) → v8 (B2): a mission carries the vigor it cost.
   *
   * Vigor is now one per minute of clock, so an offer's price is no longer
   * recoverable from its size alone — a v7 board rolled at level 3 and a v8
   * board rolled at level 30 can both say `durationMin: 15`. The price is
   * therefore stored next to the rewards it bought.
   *
   * A v7 save paid the OLD rule, full size, and its stored xp/gold were priced
   * at full size to match — so `vigorCost = durationMin` is not a default here,
   * it is the true historical price. Writing anything else would hand a
   * standing board a discount it was never sold at.
   */
  8: (raw) => {
    const activities = raw.activities as Record<string, unknown>;
    const priced = (offer: Record<string, unknown>) => ({
      vigorCost: offer.durationMin,
      ...offer,
    });
    const mission = activities.mission as { payload?: Record<string, unknown> } | null;
    const offers = activities.tavernOffers as Record<string, unknown>[] | null;
    return {
      ...raw,
      version: 8,
      activities: {
        ...activities,
        tavernOffers: offers ? offers.map(priced) : null,
        mission: mission?.payload ? { ...mission, payload: priced(mission.payload) } : mission,
      },
    };
  },
};

export function migrateSave(raw: unknown): GameSave {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Save data is not an object.');
  }
  let working = { ...(raw as RawSave) };
  let version = Number(working.version);
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version + 1];
    if (!step) throw new Error(`No migration path from save version ${version}.`);
    working = step(working);
    version = Number(working.version);
  }
  return parseGameSave(working);
}
