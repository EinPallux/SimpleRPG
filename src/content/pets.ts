/**
 * The Menagerie — 16 pets (GAME_DESIGN.md §11.1, CONTENT_CATALOG.md §6.3).
 * Four families of four, one equipped at a time, levelled 1→50 on Pet Treats.
 *
 * Every `value` here is the aura AT PET LEVEL 1; `engine/pets.ts` scales it to
 * PET_AURA_MAX_MULT× at PET_MAX_LEVEL, so read each number as "a third of what
 * a devoted owner eventually gets". Budget bands used below (level-1 major):
 * common 0.02–0.03 · rare 0.03–0.04 · epic 0.04–0.05 · legendary 0.05–0.06,
 * minors roughly half — a maxed legendary lands near a full item set (§5) but
 * never above it. `evadePP` / `itemChancePP` are percentage POINTS and stay
 * deliberately tiny; they buy flavour, not a build.
 *
 * Sources mirror the catalog exactly: story ch. 5 (3) · zone mission chains (6,
 * one per zone so the mission-claim path can look a pet up by index) · dungeon
 * first-clears (2) · gold achievements (2) · Wishing Well pet banner (2, one per
 * rotation phase) · wheel jackpot (1). Nothing here is ever sold for money.
 */
import { z } from 'zod';
import {
  petSchema,
  type PetAura,
  type PetDef,
  type PetFamily,
  type PetSource,
} from './collectibles';

export const PETS: readonly PetDef[] = [
  // ---------------------------------------------------------------------------
  // Beast — the ones with opinions about hedges
  // ---------------------------------------------------------------------------
  {
    id: 'ember-fox',
    family: 'beast',
    rarity: 'rare',
    major: { kind: 'goldFind', value: 0.04 },
    minor: { kind: 'attrPct', attr: 'dex', value: 0.02 },
    source: { kind: 'zone', zoneIndex: 8, chance: 0.02 },
    nameKey: 'pet.ember-fox',
  },
  {
    id: 'moss-boar',
    family: 'beast',
    rarity: 'common',
    major: { kind: 'attrPct', attr: 'con', value: 0.03 },
    minor: { kind: 'armorPct', value: 0.015 },
    source: { kind: 'story', chapter: 5 },
    nameKey: 'pet.moss-boar',
  },
  {
    id: 'thicket-hare',
    family: 'beast',
    rarity: 'common',
    major: { kind: 'attrPct', attr: 'dex', value: 0.03 },
    minor: { kind: 'evadePP', value: 0.5 },
    source: { kind: 'zone', zoneIndex: 1, chance: 0.03 },
    nameKey: 'pet.thicket-hare',
  },
  {
    id: 'ridgeback-wolf',
    family: 'beast',
    rarity: 'rare',
    major: { kind: 'attrPct', attr: 'str', value: 0.04 },
    minor: { kind: 'critDmg', value: 0.02 },
    source: { kind: 'zone', zoneIndex: 4, chance: 0.025 },
    nameKey: 'pet.ridgeback-wolf',
  },

  // ---------------------------------------------------------------------------
  // Elemental — weather with a name and a feeding schedule
  // ---------------------------------------------------------------------------
  {
    id: 'cinder-wisp',
    family: 'elemental',
    rarity: 'rare',
    major: { kind: 'critDmg', value: 0.04 },
    minor: { kind: 'attrPct', attr: 'int', value: 0.02 },
    source: { kind: 'zone', zoneIndex: 6, chance: 0.022 },
    nameKey: 'pet.cinder-wisp',
  },
  {
    id: 'tide-sprite',
    family: 'elemental',
    rarity: 'common',
    major: { kind: 'attrPct', attr: 'int', value: 0.03 },
    minor: { kind: 'hpPct', value: 0.015 },
    source: { kind: 'zone', zoneIndex: 5, chance: 0.025 },
    nameKey: 'pet.tide-sprite',
  },
  {
    id: 'pebble-golem',
    family: 'elemental',
    rarity: 'common',
    major: { kind: 'armorPct', value: 0.03 },
    minor: { kind: 'attrPct', attr: 'con', value: 0.015 },
    source: { kind: 'story', chapter: 5 },
    nameKey: 'pet.pebble-golem',
  },
  {
    id: 'storm-mote',
    family: 'elemental',
    rarity: 'epic',
    major: { kind: 'xp', value: 0.05 },
    minor: { kind: 'attrPct', attr: 'lck', value: 0.025 },
    source: { kind: 'dungeon', dungeonId: 'ironroot-hollows' },
    nameKey: 'pet.storm-mote',
  },

  // ---------------------------------------------------------------------------
  // Spirit — unfinished business, domesticated
  // ---------------------------------------------------------------------------
  {
    id: 'lantern-ghost',
    family: 'spirit',
    rarity: 'rare',
    major: { kind: 'goldFind', value: 0.04 },
    minor: { kind: 'xp', value: 0.02 },
    source: { kind: 'zone', zoneIndex: 9, chance: 0.018 },
    nameKey: 'pet.lantern-ghost',
  },
  {
    id: 'hearth-cherub',
    family: 'spirit',
    rarity: 'epic',
    major: { kind: 'attrPct', attr: 'all', value: 0.04 },
    minor: { kind: 'hpPct', value: 0.02 },
    source: { kind: 'achievement', achievementId: 'known-at-the-door' },
    nameKey: 'pet.hearth-cherub',
  },
  {
    id: 'dream-moth',
    family: 'spirit',
    rarity: 'common',
    major: { kind: 'attrPct', attr: 'lck', value: 0.03 },
    minor: { kind: 'itemChancePP', value: 1 },
    source: { kind: 'story', chapter: 5 },
    nameKey: 'pet.dream-moth',
  },
  {
    id: 'grave-owl',
    family: 'spirit',
    rarity: 'epic',
    major: { kind: 'arenaGold', value: 0.05 },
    minor: { kind: 'honorGain', value: 0.025 },
    source: { kind: 'dungeon', dungeonId: 'pale-court' },
    nameKey: 'pet.grave-owl',
  },

  // ---------------------------------------------------------------------------
  // Cryptid — the ones the guild refuses to file
  // ---------------------------------------------------------------------------
  {
    id: 'snallygaster',
    family: 'cryptid',
    rarity: 'epic',
    major: { kind: 'dungeonLuck', value: 0.05 },
    minor: { kind: 'attrPct', attr: 'str', value: 0.025 },
    source: { kind: 'achievement', achievementId: 'basement-cartographer' },
    nameKey: 'pet.snallygaster',
  },
  {
    id: 'fernwyrm',
    family: 'cryptid',
    rarity: 'legendary',
    major: { kind: 'missionSpeed', value: 0.05 },
    minor: { kind: 'attrPct', attr: 'dex', value: 0.03 },
    source: { kind: 'well', phase: 'A' },
    nameKey: 'pet.fernwyrm',
  },
  {
    id: 'moon-calf',
    family: 'cryptid',
    rarity: 'legendary',
    major: { kind: 'treatFind', value: 0.06 },
    minor: { kind: 'attrPct', attr: 'all', value: 0.02 },
    source: { kind: 'well', phase: 'B' },
    nameKey: 'pet.moon-calf',
  },
  {
    id: 'the-gilded-snail',
    family: 'cryptid',
    rarity: 'legendary',
    major: { kind: 'shopDiscount', value: 0.05 },
    minor: { kind: 'goldFind', value: 0.03 },
    source: { kind: 'wheel' },
    nameKey: 'pet.the-gilded-snail',
  },
];

export const PET_COUNT: number = PETS.length;

/** Menagerie tab order (UI_DESIGN §7) — also the codex ordering. */
export const PET_FAMILIES: readonly PetFamily[] = ['beast', 'elemental', 'spirit', 'cryptid'];

export function getPet(id: string): PetDef {
  const def = PETS.find((pet) => pet.id === id);
  if (!def) throw new Error(`Unknown pet: ${id}`);
  return def;
}

export function petsOfFamily(family: PetFamily): readonly PetDef[] {
  return PETS.filter((pet) => pet.family === family);
}

export function petsOfSource(kind: PetSource['kind']): readonly PetDef[] {
  return PETS.filter((pet) => pet.source.kind === kind);
}

/**
 * The Wishing Well pet-banner exclusives — one focus pet per rotation phase
 * (CONTENT §7). Omit `phase` for both.
 */
export function wellExclusives(phase?: 'A' | 'B'): readonly PetDef[] {
  return PETS.filter(
    (pet) => pet.source.kind === 'well' && (phase === undefined || pet.source.phase === phase),
  );
}

/**
 * The pet whose drop chain runs in a zone, or null where none does — the
 * mission-claim path calls this once per completed mission.
 */
export function zonePetFor(zoneIndex: number): PetDef | null {
  return (
    PETS.find((pet) => pet.source.kind === 'zone' && pet.source.zoneIndex === zoneIndex) ?? null
  );
}

/** Drop chance for this zone's pet (0 when the zone has no chain). */
export function zonePetChance(zoneIndex: number): number {
  const pet = zonePetFor(zoneIndex);
  return pet && pet.source.kind === 'zone' ? pet.source.chance : 0;
}

/** i18n helpers (CONTENT §13: `pet.{id}.name` / `.blurb`). */
export function petNameKey(id: string): string {
  return `pet.${id}.name`;
}
export function petBlurbKey(id: string): string {
  return `pet.${id}.blurb`;
}
/** Family label key for the Menagerie tab strip. */
export function petFamilyKey(family: PetFamily): string {
  return `petFamily.${family}`;
}

/** Both aura lines of a pet, majors first — the shape `engine/pets.ts` folds. */
export function petAuras(pet: PetDef): readonly PetAura[] {
  return [pet.major, pet.minor];
}

export { petSchema };
export const petSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('story'), chapter: z.number().int().positive() }).strict(),
  z
    .object({
      kind: z.literal('zone'),
      zoneIndex: z.number().int().min(1).max(10),
      chance: z.number().positive().max(0.1),
    })
    .strict(),
  z.object({ kind: z.literal('dungeon'), dungeonId: z.string() }).strict(),
  z.object({ kind: z.literal('achievement'), achievementId: z.string() }).strict(),
  z.object({ kind: z.literal('well'), phase: z.enum(['A', 'B']) }).strict(),
  z.object({ kind: z.literal('wheel') }).strict(),
]);
