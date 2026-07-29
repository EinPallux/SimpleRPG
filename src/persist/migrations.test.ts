import { describe, expect, it } from 'vitest';
import { ONBOARDING_DONE } from '@/content/onboarding';
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

/** A v2 (M1) save with a mission in flight — proves payload annotation in v2→v3. */
const V2_FIXTURE = {
  ...structuredClone(V1_FIXTURE),
  version: 2,
  inventory: {
    ...structuredClone(V1_FIXTURE.inventory),
    backpack: [{ ...structuredClone(V1_FIXTURE.inventory.backpack[0]!), classId: null }],
  },
  activities: {
    ...structuredClone(V1_FIXTURE.activities),
    mission: {
      kind: 'mission',
      startedAt: '2026-07-28T11:50:00.000Z',
      durationSec: 600,
      payload: { zoneIndex: 1, durationMin: 10, lucky: false, xp: 55, gold: 20 },
    },
  },
};

/** A v4 (M3/M4) save — proves the v5 expedition/daily upgrade. */
const V4_FIXTURE = {
  ...structuredClone(V2_FIXTURE),
  version: 4,
  activities: {
    ...structuredClone(V1_FIXTURE.activities),
    mission: null,
    tavernOffers: null,
  },
  town: {
    shops: {
      weaponsmith: { stock: null, rerollUsed: false },
      armorer: { stock: null, rerollUsed: false },
      arcanum: { stock: null, rerollUsed: false },
    },
  },
};

describe('save migrations', () => {
  it('migrates a v1 (M0) save forward to the current version', () => {
    const save = migrateSave(structuredClone(V1_FIXTURE));
    expect(save.version).toBe(7);
    expect(save.hero.name).toBe('Fixture');
    expect(save.inventory.backpack[0]?.classId).toBeNull();
    expect(save.activities.tavernOffers).toBeNull();
    expect(save.town.shops.weaponsmith).toEqual({ stock: null, rerollUsed: false });
    expect(save.daily.expeditions).toBe(0);
    // Missing rng streams are legal — they lazy-init from the world seed.
    expect(save.rngState).toEqual({});
  });

  it('migrates a v2 (M1) save with an in-flight mission (payload gains flavor)', () => {
    const save = migrateSave(structuredClone(V2_FIXTURE));
    expect(save.version).toBe(7);
    expect(save.activities.mission?.payload.flavor).toBe(0);
    expect(save.activities.mission?.payload.xp).toBe(55);
    expect(save.activities.tavernOffers).toBeNull();
    expect(save.town.shops.arcanum.stock).toBeNull();
  });

  it('migrates a v4 (M3/M4) save: expeditions reset, day counter added', () => {
    const save = migrateSave(structuredClone(V4_FIXTURE));
    expect(save.version).toBe(7);
    expect(save.activities.expedition).toBeNull();
    expect(save.daily.expeditions).toBe(0);
    // pre-M5 items simply carry no setId
    expect(save.inventory.backpack[0]?.setId).toBeUndefined();
  });

  it('v6 → v7: an existing hero is onboarded, but has seen no tours yet', () => {
    // The v1 fixture walks the whole chain, so it exercises 7 like every other.
    const save = migrateSave(structuredClone(V1_FIXTURE));
    // A save that already exists has, by definition, played its first day —
    // dragging it back through the cold open would be absurd.
    expect(save.progress.onboarding).toEqual({ step: ONBOARDING_DONE, skipped: true });
    // …but the 15-second per-screen tours are contextual tips, not a tutorial:
    // a veteran who has never opened the Menagerie should still get one.
    expect(save.progress.toursSeen).toEqual([]);
  });

  it('refuses saves with no migration path', () => {
    expect(() => migrateSave({ ...structuredClone(V1_FIXTURE), version: -5 })).toThrow();
  });
});
