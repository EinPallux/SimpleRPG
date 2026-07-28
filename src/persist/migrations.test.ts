import { describe, expect, it } from 'vitest';
import { migrateSave } from './migrations';

/** A save exactly as milestone M0 (schema v1) wrote it — frozen fixture, do not update. */
const V1_FIXTURE = {
  version: 1,
  createdAt: '2026-07-28T12:00:00.000Z',
  lastSeenAt: '2026-07-28T12:00:00.000Z',
  worldSeed: 'deadbeefdeadbeefdeadbeefdeadbeef',
  rngState: {},
  hero: {
    name: 'Fixture',
    classId: 'warrior',
    level: 3,
    xp: 120,
    gold: 500,
    gems: 0,
    scraps: 0,
    dust: 0,
    treats: 0,
    honor: 100,
    attrsBought: { str: 2, dex: 0, int: 0, con: 1, lck: 0 },
    portrait: { icon: 'warrior', palette: 4 },
    titleId: null,
    potions: [],
  },
  inventory: {
    equipped: {},
    // v1 items had no classId — the migration must annotate them
    backpack: [
      {
        id: 'itm-1',
        defId: 'weapon:any:1',
        ilvl: 3,
        rarity: 'common',
        lines: [],
        upgrade: 0,
        seed: 42,
      },
    ],
    capacity: 30,
  },
  activities: {
    mission: null,
    expedition: null,
    patrol: null,
    dungeonCooldowns: {},
    arena: { fightsToday: 0, cooldownUntil: null },
  },
  daily: {
    dayKey: '2026-07-28',
    vigor: 100,
    secondWindUsed: false,
    aleUsed: 0,
    wheelSpins: 0,
    dismantles: 0,
    tavernRerollUsed: false,
    freeTossUsed: false,
    activity: 0,
    questIds: [],
    questProgress: {},
  },
  weekly: { weekKey: '2026-W31', questIds: [], questProgress: {} },
  monthly: { monthKey: '2026-07', questIds: [], questProgress: {} },
  calendar: { monthKey: '2026-07', claimedDays: [], lastClaimDayKey: null },
  progress: {
    storyStep: 0,
    zonesUnlocked: 1,
    zonePinned: null,
    dungeonFloors: {},
    codex: { monstersSeen: {}, itemsSeen: {} },
    achievements: {},
    pets: {},
    equippedPet: null,
    mountTier: 0,
    gachaPity: {},
    milestonesClaimed: [],
  },
  stats: {},
};

describe('save migrations', () => {
  it('migrates a v1 (M0) save forward to the current version', () => {
    const save = migrateSave(structuredClone(V1_FIXTURE));
    expect(save.version).toBe(2);
    expect(save.hero.name).toBe('Fixture');
    expect(save.inventory.backpack[0]?.classId).toBeNull();
    // Missing rng streams are legal — they lazy-init from the world seed.
    expect(save.rngState).toEqual({});
  });

  it('refuses saves with no migration path', () => {
    expect(() => migrateSave({ ...structuredClone(V1_FIXTURE), version: -5 })).toThrow();
  });
});
