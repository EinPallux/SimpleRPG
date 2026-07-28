/**
 * Menagerie validation (GAME_DESIGN.md §11.1, CONTENT_CATALOG.md §6.3).
 * The pet table is a promise the Menagerie screen makes: 16 pets, four per
 * family, every source reachable and every aura inside its rarity budget.
 * These tests pin the promise — ids, schema, sources against the real zone /
 * dungeon / achievement tables, i18n coverage, and the balance bands.
 */
import { describe, expect, it } from 'vitest';
import { hasKey } from '@/i18n';
import { ACHIEVEMENTS } from './achievements';
import {
  PET_AURA_MAX_MULT,
  PET_MAX_LEVEL,
  type PetAura,
  type PetFamily,
  type PetRarity,
} from './collectibles';
import { DUNGEONS } from './dungeons';
import {
  PETS,
  PET_COUNT,
  PET_FAMILIES,
  getPet,
  petAuras,
  petBlurbKey,
  petFamilyKey,
  petNameKey,
  petSchema,
  petSourceSchema,
  petsOfFamily,
  petsOfSource,
  wellExclusives,
  zonePetChance,
  zonePetFor,
} from './pets';
import { ZONES } from './zones';

/** Strict kebab-case: lowercase words joined by single hyphens. */
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Level-1 ceilings for the MAJOR line, per rarity (module header). */
const MAJOR_CAP: Record<PetRarity, number> = {
  common: 0.035,
  rare: 0.04,
  epic: 0.05,
  legendary: 0.06,
};
/** Level-1 floors — even a common pet has to be worth equipping. */
const MAJOR_FLOOR = 0.02;
/** Percentage-POINT auras live on a different scale and stay tiny. */
const PP_KINDS: readonly PetAura['kind'][] = ['evadePP', 'itemChancePP'];

const isPP = (aura: PetAura): boolean => PP_KINDS.includes(aura.kind);

describe('menagerie roster (M7)', () => {
  it('holds exactly the 16 catalogued pets', () => {
    expect(PETS).toHaveLength(16);
    expect(PET_COUNT).toBe(16);
  });

  it('uses unique kebab-case ids', () => {
    const ids = PETS.map((pet) => pet.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(KEBAB);
  });

  it('validates every entry against petSchema', () => {
    for (const pet of PETS) expect(() => petSchema.parse(pet)).not.toThrow();
  });

  it('validates every source against the discriminated source schema', () => {
    for (const pet of PETS) expect(() => petSourceSchema.parse(pet.source)).not.toThrow();
  });

  it('splits 4/4/4/4 across the families', () => {
    for (const family of PET_FAMILIES) expect(petsOfFamily(family)).toHaveLength(4);
    expect(PET_FAMILIES).toHaveLength(4);
    const families = new Set<PetFamily>(PETS.map((pet) => pet.family));
    expect(families.size).toBe(4);
  });

  it('resolves a pet by id and throws on an unknown one', () => {
    expect(getPet('ember-fox').family).toBe('beast');
    expect(() => getPet('ember-badger')).toThrow(/Unknown pet/);
  });
});

describe('menagerie i18n', () => {
  it('has a name and a blurb for every pet', () => {
    for (const pet of PETS) {
      expect(pet.nameKey).toBe(`pet.${pet.id}`);
      expect(hasKey(petNameKey(pet.id))).toBe(true);
      expect(hasKey(petBlurbKey(pet.id))).toBe(true);
    }
  });

  it('has a label for every family', () => {
    for (const family of PET_FAMILIES) expect(hasKey(petFamilyKey(family))).toBe(true);
  });
});

describe('menagerie sources', () => {
  it('matches the catalog volumes per source kind', () => {
    expect(petsOfSource('story')).toHaveLength(3);
    expect(petsOfSource('zone')).toHaveLength(6);
    expect(petsOfSource('dungeon')).toHaveLength(2);
    expect(petsOfSource('achievement')).toHaveLength(2);
    expect(petsOfSource('well')).toHaveLength(2);
    expect(petsOfSource('wheel')).toHaveLength(1);
  });

  it('unlocks the story pets with the Menagerie itself (chapter 5)', () => {
    for (const pet of petsOfSource('story')) {
      if (pet.source.kind !== 'story') throw new Error('narrowing');
      expect(pet.source.chapter).toBe(5);
    }
  });

  it('drops zone pets in real zones, one per zone, and zonePetFor finds them', () => {
    const zoneIndices = ZONES.map((zone) => zone.index);
    const seen = new Set<number>();
    for (const pet of petsOfSource('zone')) {
      if (pet.source.kind !== 'zone') throw new Error('narrowing');
      const { zoneIndex, chance } = pet.source;
      expect(zoneIndices).toContain(zoneIndex);
      expect(zoneIndex).toBeGreaterThanOrEqual(1);
      expect(zoneIndex).toBeLessThanOrEqual(10);
      expect(seen.has(zoneIndex)).toBe(false);
      seen.add(zoneIndex);
      expect(chance).toBeGreaterThanOrEqual(0.015);
      expect(chance).toBeLessThanOrEqual(0.03);
      expect(zonePetFor(zoneIndex)).toBe(pet);
      expect(zonePetChance(zoneIndex)).toBe(chance);
    }
    expect(seen.size).toBe(6);
  });

  it('keeps the Ember Fox on its catalogued Cinderpeak chain (~2%)', () => {
    const fox = getPet('ember-fox');
    expect(fox.source).toEqual({ kind: 'zone', zoneIndex: 8, chance: 0.02 });
    expect(zonePetFor(8)?.id).toBe('ember-fox');
  });

  it('returns null (and zero chance) for zones without a chain', () => {
    const zonesWithPets = new Set(
      petsOfSource('zone').map((pet) => (pet.source.kind === 'zone' ? pet.source.zoneIndex : 0)),
    );
    for (const zone of ZONES) {
      if (zonesWithPets.has(zone.index)) continue;
      expect(zonePetFor(zone.index)).toBeNull();
      expect(zonePetChance(zone.index)).toBe(0);
    }
  });

  it('points dungeon pets at real dungeons (D3 and D5 first-clears)', () => {
    const ids = DUNGEONS.map((dungeon) => dungeon.id);
    for (const pet of petsOfSource('dungeon')) {
      if (pet.source.kind !== 'dungeon') throw new Error('narrowing');
      expect(ids).toContain(pet.source.dungeonId);
    }
    expect(getPet('storm-mote').source).toEqual({
      kind: 'dungeon',
      dungeonId: DUNGEONS[2]!.id,
    });
    expect(getPet('grave-owl').source).toEqual({
      kind: 'dungeon',
      dungeonId: DUNGEONS[4]!.id,
    });
  });

  it('points achievement pets at real, gold-tier achievements', () => {
    for (const pet of petsOfSource('achievement')) {
      if (pet.source.kind !== 'achievement') throw new Error('narrowing');
      const { achievementId } = pet.source;
      const achievement = ACHIEVEMENTS.find((entry) => entry.id === achievementId);
      expect(achievement, `missing achievement for ${pet.id}`).toBeDefined();
      // bronze/silver/gold — the catalog awards these on the gold tier
      expect(achievement!.tiers).toHaveLength(3);
    }
  });

  it('gives the Well one exclusive per rotation phase and the wheel exactly one', () => {
    expect(wellExclusives()).toHaveLength(2);
    expect(wellExclusives('A').map((pet) => pet.id)).toEqual(['fernwyrm']);
    expect(wellExclusives('B').map((pet) => pet.id)).toEqual(['moon-calf']);
    expect(petsOfSource('wheel').map((pet) => pet.id)).toEqual(['the-gilded-snail']);
  });

  it('reserves the legendaries for the Well and the wheel jackpot', () => {
    const legendaries = PETS.filter((pet) => pet.rarity === 'legendary');
    expect(legendaries).toHaveLength(3);
    for (const pet of legendaries) expect(['well', 'wheel']).toContain(pet.source.kind);
  });
});

describe('menagerie aura budget', () => {
  it('gives every pet two positive aura lines', () => {
    for (const pet of PETS) {
      const auras = petAuras(pet);
      expect(auras).toHaveLength(2);
      for (const aura of auras) {
        expect(aura.value, `${pet.id} ${aura.kind}`).toBeGreaterThan(0);
        if (aura.kind === 'attrPct') expect(aura.attr).toBeDefined();
        else expect('attr' in aura).toBe(false);
      }
    }
  });

  it('keeps major lines inside their rarity band', () => {
    for (const pet of PETS) {
      if (isPP(pet.major)) continue;
      expect(pet.major.value, `${pet.id} major`).toBeLessThanOrEqual(MAJOR_CAP[pet.rarity]);
      expect(pet.major.value, `${pet.id} major`).toBeGreaterThanOrEqual(MAJOR_FLOOR);
    }
    const common = PETS.filter((pet) => pet.rarity === 'common');
    const legendary = PETS.filter((pet) => pet.rarity === 'legendary');
    expect(common.length).toBeGreaterThan(0);
    expect(legendary.length).toBeGreaterThan(0);
    for (const pet of common) expect(pet.major.value).toBeLessThanOrEqual(0.035);
    for (const pet of legendary) expect(pet.major.value).toBeLessThanOrEqual(0.06);
  });

  it('keeps minor lines the smaller half of the package', () => {
    for (const pet of PETS) {
      if (isPP(pet.minor)) continue;
      expect(pet.minor.value, `${pet.id} minor`).toBeLessThanOrEqual(0.03);
      if (!isPP(pet.major)) {
        expect(pet.minor.value, `${pet.id} minor`).toBeLessThanOrEqual(pet.major.value);
      }
    }
  });

  it('keeps percentage-point auras tiny and off the major line', () => {
    for (const pet of PETS) {
      expect(isPP(pet.major), `${pet.id} major`).toBe(false);
      if (!isPP(pet.minor)) continue;
      expect(pet.minor.value, `${pet.id} minor`).toBeGreaterThanOrEqual(0.5);
      expect(pet.minor.value, `${pet.id} minor`).toBeLessThanOrEqual(1.5);
    }
  });

  it('carries the named magnitudes from the catalog', () => {
    expect(getPet('fernwyrm').major).toEqual({ kind: 'missionSpeed', value: 0.05 });
    expect(getPet('the-gilded-snail').major).toEqual({ kind: 'shopDiscount', value: 0.05 });
  });

  it('never lets a maxed pet dwarf a full item set', () => {
    for (const pet of PETS) {
      for (const aura of petAuras(pet)) {
        if (isPP(aura)) {
          expect(aura.value * PET_AURA_MAX_MULT).toBeLessThanOrEqual(5);
          continue;
        }
        expect(
          aura.value * PET_AURA_MAX_MULT,
          `${pet.id} ${aura.kind} at L${PET_MAX_LEVEL}`,
        ).toBeLessThanOrEqual(0.2);
      }
    }
  });
});
