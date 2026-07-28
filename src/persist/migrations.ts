/**
 * Save migrations (invariant 9: saves migrate forward, never wipe).
 * Each entry upgrades version N-1 → N. `migrateSave` walks a raw object up to
 * SAVE_VERSION, then zod-validates. Every future entry ships a fixture test in
 * `migrations.test.ts` alongside the schema bump.
 */
import { SAVE_VERSION } from '@/engine/constants';
import type { GameSave } from '@/engine/types';
import { parseGameSave } from './schema';

type RawSave = Record<string, unknown>;

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
