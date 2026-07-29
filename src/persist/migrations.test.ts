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
    expect(save.version).toBe(8);
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
    expect(save.version).toBe(8);
    expect(save.activities.mission?.payload.flavor).toBe(0);
    expect(save.activities.mission?.payload.xp).toBe(55);
    expect(save.activities.tavernOffers).toBeNull();
    expect(save.town.shops.arcanum.stock).toBeNull();
  });

  it('migrates a v4 (M3/M4) save: expeditions reset, day counter added', () => {
    const save = migrateSave(structuredClone(V4_FIXTURE));
    expect(save.version).toBe(8);
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

  /**
   * v7 → v8 (B2): a mission carries the vigor it cost.
   *
   * The fixture is built by taking a current save back to the v7 shape — drop
   * `vigorCost`, set the version — because that is exactly what is sitting in a
   * real player's IndexedDB right now. The assertion that matters is that the
   * migration writes `durationMin`, not the new cheap price: a v7 board was
   * SOLD at full size and its stored xp/gold were priced to match, so anything
   * else would hand a standing offer a discount it never had.
   */
  it('v7 → v8: a standing board and an in-flight mission are priced at what they cost', () => {
    const current = migrateSave(structuredClone(V1_FIXTURE));
    const offer = {
      zoneIndex: 1,
      durationMin: 15,
      lucky: false,
      xp: 120,
      gold: 90,
      flavor: 3,
    };
    const v7 = JSON.parse(JSON.stringify(current)) as Record<string, unknown>;
    v7.version = 7;
    v7.activities = {
      ...(current.activities as object),
      tavernOffers: [offer, { ...offer, durationMin: 5 }, { ...offer, durationMin: 20 }],
      mission: {
        kind: 'mission',
        startedAt: current.createdAt,
        durationSec: 900,
        payload: { ...offer, durationMin: 10 },
      },
    };

    const save = migrateSave(v7);
    expect(save.version).toBe(8);
    expect(save.activities.tavernOffers?.map((o) => o.vigorCost)).toEqual([15, 5, 20]);
    expect(save.activities.mission?.payload.vigorCost).toBe(10);
    // The rewards it was sold with are untouched — only the price is recorded.
    expect(save.activities.mission?.payload.gold).toBe(90);
  });

  it('refuses saves with no migration path', () => {
    expect(() => migrateSave({ ...structuredClone(V1_FIXTURE), version: -5 })).toThrow();
  });

  /**
   * M9 added two fields and deliberately bumped nothing (invariant 9 wants a
   * migration per schema change; the cheaper honest answer is a change that
   * needs none). Both are optional, so a save written before M9 parses
   * unchanged — the version it lands on is B2's v8.
   */
  describe('M9 added no schema version', () => {
    it('the migrated chain still ends at the current version', () => {
      expect(migrateSave(structuredClone(V1_FIXTURE)).version).toBe(8);
    });

    it('a save carrying M9 fields round-trips, and one without them still parses', () => {
      const withM9 = structuredClone(V1_FIXTURE) as Record<string, unknown>;
      const migrated = migrateSave(structuredClone(V1_FIXTURE));

      // A named legendary in the bag and a reserve mini-boss mid-expedition:
      // the exact two shapes M9 introduced.
      const raw = JSON.parse(JSON.stringify(migrated)) as typeof migrated;
      raw.inventory.backpack[0]!.uniqueId = 'gilded-iou';
      raw.activities.expedition = {
        localeId: 'castaway-cove',
        step: 1,
        heroism: 8,
        cards: null,
        minibossSlug: 'the-tidewright',
      };
      const reparsed = migrateSave(raw);
      expect(reparsed.inventory.backpack[0]?.uniqueId).toBe('gilded-iou');
      expect(reparsed.activities.expedition?.minibossSlug).toBe('the-tidewright');

      // …and the pre-M9 shape, with neither field present, is still legal.
      expect(migrateSave(withM9).inventory.backpack[0]?.uniqueId).toBeUndefined();
    });
  });
});
