/**
 * Collectibles (M7): the Menagerie, the Stable and the Wishing Well
 * (GAME_DESIGN.md §10–11, numbers BALANCING.md §7).
 *
 * Three things here are product promises rather than implementation details,
 * and are asserted as exact numbers on purpose:
 *   1. the odds column the well prints is the column it rolls against;
 *   2. pity is real, per banner, and visible;
 *   3. nothing a dupe returns is wasted.
 * The pet auras get the same treatment — they fold into the *existing* derived
 * stat pipeline, inside the same caps as gear (BALANCING §5.2/§6), so each wiring
 * test compares one save against an otherwise identical one.
 */
import { describe, expect, it } from 'vitest';
import {
  PET_AURA_MAX_MULT,
  PET_COLLECTION_CAP,
  PET_COLLECTION_PCT,
  PET_MAX_LEVEL,
  PITY_EPIC_EVERY,
  PITY_SET_AT,
} from '@/content/collectibles';
import { BANNERS, featuredSetForHero, OUTCOME_ORDER, type TossOutcomeKind } from '@/content/gacha';
import { getMount, MAX_MOUNT_TIER, MOUNTS } from '@/content/mounts';
import { getPet, PETS } from '@/content/pets';
import { getSet } from '@/content/sets';
import { heroToCombatant } from './combatants';
import {
  CAP_EVADE,
  CAP_GOLD_FIND,
  DUPE_LEGENDARY_DUST,
  DUPE_PET_TREATS,
  DUPE_SET_DUST,
  MOUNT_SPEED,
  PATROL_TICK_MIN,
  PATROL_TICKS_PER_TREAT,
  STABLE_UNLOCK_LEVEL,
  TOSS_COST_GEMS,
  TOSS_TEN_COST_GEMS,
  TOSS_TEN_COUNT,
  WELL_UNLOCK_LEVEL,
} from './constants';
import {
  canToss,
  freeTossAvailable,
  pityRemaining,
  toss,
  tossCost,
  wellUnlocked,
  type TossResult,
} from './gacha';
import { generateItem, generateSetPiece, shopPrice } from './items';
import { metricValue } from './metrics';
import { missionDurationSec } from './missions';
import {
  buyMount,
  canBuyMount,
  currentMount,
  mountPrice,
  mountSpeedup,
  stableUnlocked,
} from './mounts';
import { baseAttribute, createNewSave, deriveEmblem } from './newSave';
import { collectPatrol, startPatrol } from './patrol';
import {
  auraTotal,
  auraValueAt,
  canFeedPet,
  collectionBonus,
  equipPet,
  feedPet,
  feedPetMax,
  grantPet,
  petState,
  treatsToNextLevel,
} from './pets';
import { grantTitle } from './rewards';
import { Rng, seedState } from './rng';
import { heroShopPrice } from './shops';
import { gearPercents, heroMaxHp, totalAttribute } from './stats';
import { ATTRIBUTE_IDS, type ClassId, type GameSave, type ItemInstance } from './types';

const T0 = new Date(2026, 6, 28, 9, 0).getTime();
const SEED = 'a7'.repeat(16);

/** W1 of the featured rotation is the Bulwark Boar line (CONTENT_CATALOG §7). */
const WEEK = 1;
/** A fixed clock — the engine never reads one itself (CLAUDE.md invariant 4). */
const NOW = Date.UTC(2026, 6, 28, 12, 0, 0);

const EPIC_PLUS: readonly TossOutcomeKind[] = ['epic', 'setPiece', 'legendary'];

// Pets referenced by name below, each picked for the single aura it isolates.
const MOSS_BOAR = 'moss-boar'; // common
const RIDGEBACK = 'ridgeback-wolf'; // rare · attrPct str
const STORM_MOTE = 'storm-mote'; // epic
const FERNWYRM = 'fernwyrm'; // legendary · missionSpeed
const EMBER_FOX = 'ember-fox'; // goldFind
const HEARTH_CHERUB = 'hearth-cherub'; // attrPct 'all'
const TIDE_SPRITE = 'tide-sprite'; // hpPct (major touches INT, which never feeds maxHP)
const THICKET_HARE = 'thicket-hare'; // evadePP
const GILDED_SNAIL = 'the-gilded-snail'; // shopDiscount
const MOON_CALF = 'moon-calf'; // treatFind

function fresh(level = 40, classId: ClassId = 'warrior', seed = SEED): GameSave {
  const save = createNewSave(
    { name: 'Keeper', classId, emblem: deriveEmblem('Keeper', classId), worldSeed: seed },
    T0,
  );
  save.hero.level = level;
  save.hero.attrsBought = { str: 200, dex: 120, int: 40, con: 160, lck: 80 };
  return save;
}

/** Adopt `petId`, feed it to `level` and put it in the slot. */
function withPet(save: GameSave, petId: string, level = 1): GameSave {
  grantPet(save, petId);
  save.progress.pets[petId]!.level = level;
  equipPet(save, petId);
  return save;
}

/**
 * Adopt `petId` but leave the slot empty. This is the honest baseline for a
 * wiring test: the collection bonus (+0.5%/pet) is identical on both sides, so
 * whatever moves is the equipped aura and nothing else.
 */
function owningOnly(save: GameSave, petId: string, level = 1): GameSave {
  withPet(save, petId, level);
  equipPet(save, null);
  return save;
}

/** A real generated item with its bonus lines replaced, for cap tests. */
function riggedItem(tag: string, lines: ItemInstance['lines']): ItemInstance {
  const rng = new Rng(seedState('collectibles-rig', tag));
  const item = generateItem({ ilvl: 30, rarity: 'epic', slot: 'amulet' }, rng);
  return { ...item, lines };
}

function wellHero(level = 40, seed = SEED): GameSave {
  const save = fresh(level, 'warrior', seed);
  save.hero.gems = 10_000;
  return save;
}

// ---------------------------------------------------------------------------
// Pets
// ---------------------------------------------------------------------------

describe('the menagerie', () => {
  it('walks the first pet into the empty slot and adopts each pet once', () => {
    const save = fresh();
    expect(save.progress.equippedPet).toBeNull();
    expect(metricValue(save, 'petsOwned')).toBe(0);

    expect(grantPet(save, MOSS_BOAR)).toBe(true);
    expect(save.progress.equippedPet).toBe(MOSS_BOAR);
    expect(metricValue(save, 'petsOwned')).toBe(1);

    // Idempotent: a second copy is not a second pet (the well pays treats for it).
    expect(grantPet(save, MOSS_BOAR)).toBe(false);
    expect(metricValue(save, 'petsOwned')).toBe(1);

    // Only the FIRST auto-equips; later adoptions never yank the slot.
    expect(grantPet(save, RIDGEBACK)).toBe(true);
    expect(save.progress.equippedPet).toBe(MOSS_BOAR);
    expect(metricValue(save, 'petsOwned')).toBe(2);

    expect(() => grantPet(save, 'no-such-pet')).toThrow(/Unknown pet/);
  });

  it('lets the slot be emptied but never filled with a pet you do not own', () => {
    const save = withPet(fresh(), RIDGEBACK);
    expect(auraTotal(save, 'attrPct', 'str')).toBeGreaterThan(0);

    equipPet(save, null);
    expect(save.progress.equippedPet).toBeNull();
    expect(auraTotal(save, 'attrPct', 'str')).toBe(0);

    expect(() => equipPet(save, FERNWYRM)).toThrow(/not owned/);
    expect(save.progress.equippedPet).toBeNull();
  });
});

describe('treats and levelling', () => {
  it('prices each level by level and rarity — a legendary eats twice a common', () => {
    // Level 10 is quoted rather than level 1 because each rarity ceils its own
    // raw cost: ceil(1.5·L^1.1·mult). At L=10 the raw cost lands where the
    // ceilings agree, so the ×2 legendary multiplier (BALANCING §4.7) is exact.
    expect(treatsToNextLevel(MOSS_BOAR, 10)).toBe(19); // common ×1
    expect(treatsToNextLevel(RIDGEBACK, 10)).toBe(23); // rare ×1.2
    expect(treatsToNextLevel(STORM_MOTE, 10)).toBe(29); // epic ×1.5
    expect(treatsToNextLevel(FERNWYRM, 10)).toBe(38); // legendary ×2
    expect(treatsToNextLevel(FERNWYRM, 10)).toBe(2 * treatsToNextLevel(MOSS_BOAR, 10));

    // Strictly rising with level, so the tail is a genuine long-tail.
    for (let level = 1; level < PET_MAX_LEVEL - 1; level++) {
      expect(treatsToNextLevel(MOSS_BOAR, level + 1)).toBeGreaterThan(
        treatsToNextLevel(MOSS_BOAR, level),
      );
    }
    // …and rising with rarity at every rung.
    for (let level = 5; level < PET_MAX_LEVEL; level += 5) {
      expect(treatsToNextLevel(RIDGEBACK, level)).toBeGreaterThan(
        treatsToNextLevel(MOSS_BOAR, level),
      );
      expect(treatsToNextLevel(STORM_MOTE, level)).toBeGreaterThan(
        treatsToNextLevel(RIDGEBACK, level),
      );
      expect(treatsToNextLevel(FERNWYRM, level)).toBeGreaterThan(
        treatsToNextLevel(STORM_MOTE, level),
      );
    }

    // 50 is the ceiling: there is no level 51 to charge for.
    expect(treatsToNextLevel(FERNWYRM, PET_MAX_LEVEL)).toBe(0);
    expect(treatsToNextLevel(FERNWYRM, PET_MAX_LEVEL + 1)).toBe(0);
  });

  it('feeds one level for exactly its price, and refuses a treat short', () => {
    const save = fresh();
    grantPet(save, MOSS_BOAR);
    const cost = treatsToNextLevel(MOSS_BOAR, 1);
    save.hero.treats = cost;

    expect(canFeedPet(save, MOSS_BOAR)).toBe(true);
    expect(feedPet(save, MOSS_BOAR)).toBe(2);
    expect(save.hero.treats).toBe(0);
    expect(save.stats.petLevelsFed).toBe(1);

    save.hero.treats = treatsToNextLevel(MOSS_BOAR, 2) - 1;
    expect(canFeedPet(save, MOSS_BOAR)).toBe(false);
    expect(() => feedPet(save, MOSS_BOAR)).toThrow(/Cannot feed/);
    expect(save.stats.petLevelsFed).toBe(1);

    // An un-owned pet is never feedable, however deep the treat jar is.
    save.hero.treats = 1_000_000;
    expect(canFeedPet(save, FERNWYRM)).toBe(false);
  });

  it('feedPetMax stops at the first level it cannot afford', () => {
    const save = fresh();
    grantPet(save, MOSS_BOAR);
    save.hero.treats = 100;

    // Common costs run 2, 4, 6, 7, 9, 11, 13, 15, 17, 19… — the first nine
    // levels total 84, and the tenth (19) does not fit in the remaining 16.
    expect(feedPetMax(save, MOSS_BOAR)).toBe(9);
    expect(petState(save, MOSS_BOAR).level).toBe(10);
    expect(save.hero.treats).toBe(16);
    expect(save.hero.treats).toBeLessThan(treatsToNextLevel(MOSS_BOAR, 10));
    expect(canFeedPet(save, MOSS_BOAR)).toBe(false);
    expect(feedPetMax(save, MOSS_BOAR)).toBe(0);
    expect(save.stats.petLevelsFed).toBe(9);
  });
});

describe('auras', () => {
  it('scales from the printed value at 1 to exactly ×3 at 50, monotonically', () => {
    const aura = getPet(EMBER_FOX).major;
    expect(auraValueAt(aura, 1)).toBe(aura.value);
    expect(auraValueAt(aura, PET_MAX_LEVEL)).toBeCloseTo(aura.value * PET_AURA_MAX_MULT, 12);

    let prev = 0;
    for (let level = 1; level <= PET_MAX_LEVEL; level++) {
      const value = auraValueAt(aura, level);
      expect(value).toBeGreaterThan(prev);
      prev = value;
    }
    // Clamped outside the band, so a corrupt level can never invent power.
    expect(auraValueAt(aura, 0)).toBe(auraValueAt(aura, 1));
    expect(auraValueAt(aura, PET_MAX_LEVEL + 500)).toBe(auraValueAt(aura, PET_MAX_LEVEL));
  });

  it("respects the attribute filter: 'all' feeds everything, a named attr only itself", () => {
    const everything = withPet(fresh(), HEARTH_CHERUB); // major attrPct 'all'
    for (const attr of ATTRIBUTE_IDS) {
      expect(auraTotal(everything, 'attrPct', attr)).toBeCloseTo(0.04, 12);
    }

    const strOnly = withPet(fresh(), RIDGEBACK); // major attrPct 'str'
    expect(auraTotal(strOnly, 'attrPct', 'str')).toBeCloseTo(0.04, 12);
    for (const attr of ATTRIBUTE_IDS.filter((a) => a !== 'str')) {
      expect(auraTotal(strOnly, 'attrPct', attr)).toBe(0);
    }
    // Unfiltered, the aura counts for whatever it names.
    expect(auraTotal(strOnly, 'attrPct')).toBeCloseTo(0.04, 12);
    // A kind the pet does not carry is simply absent.
    expect(auraTotal(strOnly, 'goldFind')).toBe(0);
  });

  it('pays +0.5% per distinct pet and hard-caps at +8%', () => {
    const save = fresh();
    expect(collectionBonus(save)).toBe(0);

    let owned = 0;
    for (const pet of PETS) {
      grantPet(save, pet.id);
      owned += 1;
      expect(collectionBonus(save)).toBeCloseTo(
        Math.min(PET_COLLECTION_CAP, owned * PET_COLLECTION_PCT),
        12,
      );
    }
    expect(metricValue(save, 'petsOwned')).toBe(PETS.length);
    expect(collectionBonus(save)).toBe(PET_COLLECTION_CAP);
  });
});

// ---------------------------------------------------------------------------
// Aura wiring — each case is "with the pet" vs "the same save without"
// ---------------------------------------------------------------------------

describe('aura wiring', () => {
  it('a goldFind pet lifts gold find, but not through the engine ceiling', () => {
    const bare = fresh();
    const foxed = withPet(fresh(), EMBER_FOX);
    expect(gearPercents(bare).goldFind).toBe(0);
    expect(gearPercents(foxed).goldFind).toBeCloseTo(0.04, 12);

    // A pet is a fifth source of gold find, not an exemption from CAP_GOLD_FIND
    // (stats.ts: the §6 economy audit depends on the ceiling holding).
    const amulet = riggedItem('goldfind', [{ attr: 'goldFind', value: 60 }]);
    const cappedBare = fresh();
    cappedBare.inventory.equipped.amulet = amulet;
    const cappedFoxed = withPet(fresh(), EMBER_FOX, PET_MAX_LEVEL);
    cappedFoxed.inventory.equipped.amulet = amulet;
    expect(gearPercents(cappedBare).goldFind).toBe(CAP_GOLD_FIND);
    expect(gearPercents(cappedFoxed).goldFind).toBe(CAP_GOLD_FIND);
  });

  it('an attrPct pet — and the collection bonus alone — raise attributes', () => {
    const bare = fresh();
    const base = baseAttribute(bare, 'str');
    expect(totalAttribute(bare, 'str')).toBe(base);

    // Owning one pet without equipping it is already worth the collection bonus.
    const shelved = owningOnly(fresh(), HEARTH_CHERUB);
    expect(totalAttribute(shelved, 'str')).toBe(Math.round(base * (1 + PET_COLLECTION_PCT)));
    expect(totalAttribute(shelved, 'str')).toBeGreaterThan(base);

    // Equipping adds the aura on top, in the same multiplicative bracket.
    const equipped = withPet(fresh(), HEARTH_CHERUB);
    expect(totalAttribute(equipped, 'str')).toBe(
      Math.round(base * (1 + 0.04 + PET_COLLECTION_PCT)),
    );
    expect(totalAttribute(equipped, 'str')).toBeGreaterThan(totalAttribute(shelved, 'str'));

    // …and the fighter built from the save carries the same numbers.
    expect(heroToCombatant(equipped).attrs.str).toBe(totalAttribute(equipped, 'str'));
    expect(heroToCombatant(equipped).attrs.str).toBeGreaterThan(heroToCombatant(bare).attrs.str);
    expect(heroToCombatant(equipped).maxHp).toBeGreaterThan(heroToCombatant(bare).maxHp);
  });

  it('an hpPct pet raises max HP by exactly its aura', () => {
    // The Tide Sprite's major is attrPct INT, which never feeds maxHP (CON does),
    // so the whole delta here is the 1.5% minor.
    const shelved = owningOnly(fresh(), TIDE_SPRITE);
    const equipped = withPet(fresh(), TIDE_SPRITE);
    expect(totalAttribute(equipped, 'con')).toBe(totalAttribute(shelved, 'con'));
    expect(heroMaxHp(equipped)).toBeGreaterThan(heroMaxHp(shelved));
    expect(heroMaxHp(equipped) / heroMaxHp(shelved)).toBeCloseTo(1.015, 4);
  });

  it('an evadePP pet adds points of evade, inside CAP_EVADE', () => {
    const bare = fresh(40, 'scout');
    const hared = withPet(fresh(40, 'scout'), THICKET_HARE, PET_MAX_LEVEL);
    // 0.5pp at level 1 → 1.5pp maxed; the aura is in POINTS, the combatant in fractions.
    expect(hared.progress.equippedPet).toBe(THICKET_HARE);
    expect(heroToCombatant(hared).evadeChance).toBeCloseTo(
      heroToCombatant(bare).evadeChance + 0.015,
      6,
    );
    // Even the most evasive build the game can assemble stays under the ceiling.
    expect(heroToCombatant(hared).evadeChance).toBeLessThanOrEqual(CAP_EVADE);
  });

  it('a missionSpeed pet stacks with the mount MULTIPLICATIVELY', () => {
    expect(missionDurationSec(fresh(), 10)).toBe(600);

    const mounted = fresh();
    mounted.progress.mountTier = 4; // Ember Drake, −50%
    expect(missionDurationSec(mounted, 10)).toBe(300);

    const petted = withPet(fresh(), FERNWYRM); // −5% at level 1
    expect(missionDurationSec(petted, 10)).toBe(570);

    const both = withPet(fresh(), FERNWYRM, PET_MAX_LEVEL); // −15% maxed
    both.progress.mountTier = 4;
    // 600 × (1 − 0.50) × (1 − 0.15) = 255s. Additive stacking would say 210s and
    // put a near-zero-duration mission in reach, breaking the vigor metering the
    // idle loop is paced by (missions.ts, BALANCING §2.2).
    expect(missionDurationSec(both, 10)).toBe(255);
    expect(missionDurationSec(both, 10)).not.toBe(210);
  });

  it('a shopDiscount pet is charged at the till, not just printed', () => {
    const shelfRng = new Rng(seedState('collectibles-rig', 'shelf'));
    const item = generateItem({ ilvl: 30, rarity: 'rare', slot: 'weapon' }, shelfRng);
    const list = shopPrice(item);

    expect(heroShopPrice(fresh(), item)).toBe(list);
    const snailed = withPet(fresh(), GILDED_SNAIL); // 5% off at level 1
    expect(heroShopPrice(snailed, item)).toBe(Math.round(list * 0.95));
    expect(heroShopPrice(snailed, item)).toBeLessThan(list);
  });

  it('a treatFind pet compounds: more treats per patrol, which buy aura levels', () => {
    const bare = fresh();
    const calfed = withPet(fresh(), MOON_CALF, PET_MAX_LEVEL); // treatFind 0.06 → 0.18
    const eightHours = T0 + 8 * 3_600_000;
    for (const save of [bare, calfed]) {
      save.daily.vigor = 0; // the Watch only hires the exhausted
      startPatrol(save, T0);
    }
    // 8h = 16 ticks, one treat per PATROL_TICKS_PER_TREAT ticks.
    const baseTreats = (8 * 60) / (PATROL_TICKS_PER_TREAT * PATROL_TICK_MIN);
    expect(collectPatrol(bare, eightHours).treats).toBe(baseTreats);
    expect(collectPatrol(calfed, eightHours).treats).toBe(Math.round(baseTreats * 1.18));
  });
});

// ---------------------------------------------------------------------------
// Mounts
// ---------------------------------------------------------------------------

describe('the stable', () => {
  it('restates MOUNT_SPEED index-for-index', () => {
    expect(MOUNT_SPEED).toHaveLength(MAX_MOUNT_TIER + 1);
    expect(MOUNT_SPEED[0]).toBe(0); // tier 0 = on foot
    for (const mount of MOUNTS) expect(MOUNT_SPEED[mount.tier]).toBe(mount.speed);
  });

  it('opens at L10 and only ever sells UP, and only what you can pay for', () => {
    const rookie = fresh(STABLE_UNLOCK_LEVEL - 1);
    rookie.hero.gold = 10_000_000;
    rookie.hero.gems = 999;
    expect(stableUnlocked(rookie)).toBe(false);
    expect(canBuyMount(rookie, 1)).toBe(false);
    expect(() => buyMount(rookie, 1)).toThrow(/not open/);

    const rider = fresh(STABLE_UNLOCK_LEVEL);
    rider.hero.gold = 10_000_000;
    rider.hero.gems = 999;
    expect(stableUnlocked(rider)).toBe(true);
    expect(canBuyMount(rider, 1)).toBe(true);
    buyMount(rider, 2);
    // A tier already in the stall (or below it) would be a free re-grant of its
    // title, so the Stable refuses rather than clamping (mounts.ts).
    expect(canBuyMount(rider, 2)).toBe(false);
    expect(canBuyMount(rider, 1)).toBe(false);
    expect(canBuyMount(rider, 0)).toBe(false);
    expect(canBuyMount(rider, MAX_MOUNT_TIER + 1)).toBe(false);
    expect(canBuyMount(rider, 2.5)).toBe(false);

    const broke = fresh(STABLE_UNLOCK_LEVEL);
    broke.hero.gold = 4_999; // one coin short of the mule
    expect(canBuyMount(broke, 1)).toBe(false);
    expect(() => buyMount(broke, 1)).toThrow(/Cannot buy/);
  });

  it('charges the difference within a currency, and hands over the title once', () => {
    const save = fresh(STABLE_UNLOCK_LEVEL);
    save.hero.gold = 2_000_000;

    buyMount(save, 1);
    expect(save.hero.gold).toBe(2_000_000 - 5_000);
    expect(save.progress.mountTier).toBe(1);

    const before = save.hero.gold;
    const purchase = buyMount(save, 3);
    // Upgrading pays price(3) − price(1), not price(3) (§11.2).
    expect(purchase.paid.gold).toBe(1_200_000 - 5_000);
    expect(save.hero.gold).toBe(before - 1_195_000);
    expect(save.progress.mountTier).toBe(3);
    expect(save.stats.mountsBought).toBe(2);
    expect(purchase.titleId).toBe(getMount('bastion-warhorse').titleId);
    // Titles are kept, not swapped: the mule's title survives the trade-up.
    expect(save.progress.titles).toEqual([
      getMount('barley-pack-mule').titleId,
      getMount('bastion-warhorse').titleId,
    ]);

    const held = fresh(STABLE_UNLOCK_LEVEL);
    held.hero.gold = 10_000;
    grantTitle(held, getMount('barley-pack-mule').titleId);
    expect(buyMount(held, 1).titleId).toBeNull();
    expect(held.progress.titles).toHaveLength(1);
  });

  it('sells the Ember Drake for its full 60 gems, whatever the horses cost', () => {
    const rich = fresh(STABLE_UNLOCK_LEVEL);
    rich.hero.gold = 2_000_000;
    rich.hero.gems = 100;
    buyMount(rich, 3); // 1.2M gold now sunk into horses

    const goldBefore = rich.hero.gold;
    const drake = buyMount(rich, 4);
    expect(drake.paid).toEqual({ gold: 0, gems: 60 });
    expect(rich.hero.gems).toBe(40);
    expect(rich.hero.gold).toBe(goldBefore); // no refund, no cross-currency discount
    expect(currentMount(rich)?.id).toBe('ember-drake');
    expect(mountSpeedup(rich)).toBe(0.5);

    // …and straight from on foot it is the same 60 gems, no gold at all.
    const direct = fresh(STABLE_UNLOCK_LEVEL);
    direct.hero.gems = 60;
    expect(mountPrice(direct, 4)).toEqual({ gold: 0, gems: 60 });
    expect(canBuyMount(direct, 4)).toBe(true);
    expect(buyMount(direct, 4).paid.gems).toBe(60);
    expect(direct.hero.gold).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The Wishing Well
// ---------------------------------------------------------------------------

describe('the wishing well: odds and prices', () => {
  it('prints an odds column that sums to exactly 100', () => {
    // The engine bisects this column with ONE roll, so a short column would
    // silently bias the last row (BALANCING §7).
    for (const banner of BANNERS) {
      const total = OUTCOME_ORDER.reduce((sum, kind) => sum + banner.odds[kind], 0);
      expect(total).toBe(100);
    }
  });

  it('prices 1 and 10 tosses, and spends the free daily toss exactly once', () => {
    const save = wellHero();
    expect(wellUnlocked(save)).toBe(true);
    expect(freeTossAvailable(save, 'standard')).toBe(true);
    expect(freeTossAvailable(save, 'featured')).toBe(false); // Standard-only (§10)

    // The free toss knocks off ONE single-toss price, never more.
    expect(tossCost(save, 'standard', 1)).toBe(0);
    expect(tossCost(save, 'standard', TOSS_TEN_COUNT)).toBe(TOSS_TEN_COST_GEMS - TOSS_COST_GEMS);
    expect(tossCost(save, 'featured', 1)).toBe(TOSS_COST_GEMS);
    expect(tossCost(save, 'featured', TOSS_TEN_COUNT)).toBe(TOSS_TEN_COST_GEMS);

    const gems = save.hero.gems;
    toss(save, 'standard', WEEK, 1, NOW);
    expect(save.hero.gems).toBe(gems); // it really was free
    expect(save.daily.freeTossUsed).toBe(true);
    expect(freeTossAvailable(save, 'standard')).toBe(false);
    expect(tossCost(save, 'standard', 1)).toBe(TOSS_COST_GEMS);
    expect(tossCost(save, 'standard', TOSS_TEN_COUNT)).toBe(TOSS_TEN_COST_GEMS);

    toss(save, 'standard', WEEK, TOSS_TEN_COUNT, NOW);
    expect(save.hero.gems).toBe(gems - TOSS_TEN_COST_GEMS);
  });

  it('is shut below L18 and takes 1 or 10 tosses, nothing else', () => {
    const rookie = wellHero(WELL_UNLOCK_LEVEL - 1);
    expect(wellUnlocked(rookie)).toBe(false);
    expect(canToss(rookie, 'standard', 1)).toBe(false);
    expect(canToss(rookie, 'standard', TOSS_TEN_COUNT)).toBe(false);
    expect(() => toss(rookie, 'standard', WEEK, 1, NOW)).toThrow(/not open/);

    const save = wellHero(WELL_UNLOCK_LEVEL);
    expect(canToss(save, 'standard', 1)).toBe(true);
    expect(canToss(save, 'standard', TOSS_TEN_COUNT)).toBe(true);
    for (const count of [0, 2, 5, 9, 11, 100]) {
      expect(canToss(save, 'standard', count)).toBe(false);
    }
    expect(() => toss(save, 'standard', WEEK, 5, NOW)).toThrow(/1 or 10/);

    const broke = wellHero();
    broke.hero.gems = 0;
    broke.daily.freeTossUsed = true;
    expect(canToss(broke, 'standard', 1)).toBe(false);
    expect(() => toss(broke, 'standard', WEEK, 1, NOW)).toThrow(/Not enough gems/);
  });
});

describe('the wishing well: pity', () => {
  it('guarantees Epic+ within ten tosses and a set piece within thirty', () => {
    const save = wellHero();
    const first = toss(save, 'standard', WEEK, TOSS_TEN_COUNT, NOW);
    expect(first).toHaveLength(TOSS_TEN_COUNT);
    expect(first.some((r) => EPIC_PLUS.includes(r.kind))).toBe(true);

    // §10 hard pity: a set piece lands by the 30th toss on the same banner.
    const thirty = wellHero();
    const results: TossResult[] = [];
    for (let block = 0; block < 3; block++) {
      results.push(...toss(thirty, 'featured', WEEK, TOSS_TEN_COUNT, NOW));
    }
    expect(results).toHaveLength(PITY_SET_AT);
    expect(results.some((r) => r.kind === 'setPiece')).toBe(true);
    // Every window of ten contains an Epic+, not just the first.
    for (let start = 0; start + PITY_EPIC_EVERY <= results.length; start += PITY_EPIC_EVERY) {
      const window = results.slice(start, start + PITY_EPIC_EVERY);
      expect(window.some((r) => EPIC_PLUS.includes(r.kind))).toBe(true);
    }
  });

  it('counts the pity display down and resets it on a real hit', () => {
    const save = wellHero();
    expect(pityRemaining(save, 'standard')).toEqual({
      toEpic: PITY_EPIC_EVERY,
      toSet: PITY_SET_AT,
    });

    let sinceEpic = 0;
    let sinceSet = 0;
    for (const result of toss(save, 'standard', WEEK, TOSS_TEN_COUNT, NOW)) {
      sinceEpic = EPIC_PLUS.includes(result.kind) ? 0 : sinceEpic + 1;
      sinceSet = result.kind === 'setPiece' ? 0 : sinceSet + 1;
      expect(result.pityAfter).toEqual({ sinceEpic, sinceSet });
    }
    expect(sinceEpic).toBeLessThan(PITY_EPIC_EVERY); // the guarantee did fire
    expect(pityRemaining(save, 'standard')).toEqual({
      toEpic: PITY_EPIC_EVERY - sinceEpic,
      toSet: PITY_SET_AT - sinceSet,
    });
  });

  it('keeps a separate counter per banner', () => {
    const save = wellHero();
    toss(save, 'standard', WEEK, TOSS_TEN_COUNT, NOW);
    expect(pityRemaining(save, 'standard').toSet).toBeLessThan(PITY_SET_AT);
    // Grinding the Standard Well must not bank progress toward the Featured one.
    expect(pityRemaining(save, 'featured')).toEqual({
      toEpic: PITY_EPIC_EVERY,
      toSet: PITY_SET_AT,
    });
    expect(pityRemaining(save, 'pet')).toEqual({ toEpic: PITY_EPIC_EVERY, toSet: PITY_SET_AT });
  });

  it("pays the week's featured set when hard pity fires on the Featured banner", () => {
    const save = wellHero(20);
    save.progress.gachaPity.featured = { sinceEpic: 0, sinceSet: PITY_SET_AT - 1 };

    const [result] = toss(save, 'featured', WEEK, 1, NOW);
    expect(result?.kind).toBe('setPiece');
    expect(result?.pity).toBe('set');
    // A guarantee that paid a random set would be hollow (gacha.ts pickSetId).
    expect(result?.setId).toBe(featuredSetForHero(WEEK, 20));
    expect(save.stats.gachaPityHits).toBe(1);
    expect(result?.pityAfter).toEqual({ sinceEpic: 0, sinceSet: 0 });
  });
});

describe('the wishing well: dupes and bookkeeping', () => {
  it('turns a pet you already own into treats, not nothing', () => {
    const save = wellHero();
    for (const pet of PETS) grantPet(save, pet.id);
    const treatsBefore = save.hero.treats;

    // Pet eggs are 6% of the pet banner (§7), so pull 10-toss blocks until one
    // hatches. Deterministic: the same seed always finds it on the same block.
    const results: TossResult[] = [];
    for (let block = 0; block < 20; block++) {
      results.push(...toss(save, 'pet', WEEK, TOSS_TEN_COUNT, NOW));
      if (results.some((r) => r.kind === 'petEgg')) break;
    }
    const eggs = results.filter((r) => r.kind === 'petEgg');
    expect(eggs.length).toBeGreaterThan(0);
    for (const egg of eggs) {
      expect(egg.dupe).toBe(true);
      expect(egg.petId).not.toBeNull();
      expect(egg.treats).toBe(DUPE_PET_TREATS);
    }
    expect(metricValue(save, 'petsOwned')).toBe(PETS.length); // no phantom adoptions

    // Nothing is wasted: every treat the well announced is in the jar.
    const announced = results.reduce((sum, r) => sum + r.treats, 0);
    expect(save.hero.treats).toBe(treatsBefore + announced);
    const converted = results.filter(
      (r) => r.dupe && (r.kind === 'petEgg' || r.kind === 'setPiece'),
    );
    expect(save.stats.gachaDupes).toBe(converted.length);
  });

  it('turns a completed set into dust and still books the codex credit', () => {
    const save = wellHero(20);
    const setId = featuredSetForHero(WEEK, 20);
    const rig = new Rng(seedState('collectibles-rig', setId));
    for (const slot of getSet(setId).slots) {
      save.inventory.backpack.push(generateSetPiece(setId, slot, rig));
    }
    save.progress.gachaPity.featured = { sinceEpic: 0, sinceSet: PITY_SET_AT - 1 };
    const bagBefore = save.inventory.backpack.length;

    const [result] = toss(save, 'featured', WEEK, 1, NOW);
    expect(result?.kind).toBe('setPiece');
    expect(result?.setId).toBe(setId);
    expect(result?.dupe).toBe(true);
    expect(getSet(setId).level).toBeLessThan(100);
    expect(result?.dust).toBe(DUPE_SET_DUST);
    expect(save.hero.dust).toBe(DUPE_SET_DUST);
    expect(save.stats.gachaDupes).toBe(1);
    // Credit is still recorded even though the piece never reached the bag (§7).
    expect(save.stats.setPiecesFound).toBe(1);
    expect(save.inventory.backpack).toHaveLength(bagBefore);
    expect(result?.item).toBeNull();
  });

  it('pays the legendary dust rate for a completed L100 set', () => {
    const save = wellHero(100);
    const setId = featuredSetForHero(WEEK, 100);
    expect(getSet(setId).level).toBe(100);
    const rig = new Rng(seedState('collectibles-rig', setId));
    for (const slot of getSet(setId).slots) {
      save.inventory.backpack.push(generateSetPiece(setId, slot, rig));
    }
    save.progress.gachaPity.featured = { sinceEpic: 0, sinceSet: PITY_SET_AT - 1 };

    const [result] = toss(save, 'featured', WEEK, 1, NOW);
    expect(result?.dupe).toBe(true);
    expect(result?.dust).toBe(DUPE_LEGENDARY_DUST);
    expect(save.hero.dust).toBe(DUPE_LEGENDARY_DUST);
  });

  it('counts every toss in the ledger, the free one included', () => {
    const save = wellHero();
    expect(save.stats.gachaTosses).toBeUndefined();
    toss(save, 'standard', WEEK, 1, NOW); // the free daily
    expect(save.stats.gachaTosses).toBe(1);
    toss(save, 'standard', WEEK, TOSS_TEN_COUNT, NOW);
    expect(save.stats.gachaTosses).toBe(1 + TOSS_TEN_COUNT);
    toss(save, 'featured', WEEK, 1, NOW);
    expect(save.stats.gachaTosses).toBe(2 + TOSS_TEN_COUNT);
  });

  it('replays identically from the same save and seed', () => {
    // The gacha stream lives in the save, so a reload cannot re-roll a toss and
    // the simulator replays a player's exact luck (gacha.ts header).
    const original = wellHero();
    const clone = structuredClone(original);
    const kinds = (save: GameSave): TossOutcomeKind[] =>
      [
        ...toss(save, 'standard', WEEK, TOSS_TEN_COUNT, NOW),
        ...toss(save, 'featured', WEEK, TOSS_TEN_COUNT, NOW),
      ].map((r) => r.kind);

    expect(kinds(clone)).toEqual(kinds(original));
    expect(clone.hero.gems).toBe(original.hero.gems);
    expect(clone.rngState.gacha).toEqual(original.rngState.gacha);

    // A different world tells a different story.
    const elsewhere = wellHero(40, 'f1'.repeat(16));
    expect(kinds(elsewhere).join()).not.toBe(kinds(wellHero()).join());
  });
});
