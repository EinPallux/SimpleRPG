/**
 * The Menagerie (GAME_DESIGN.md §11.1): 16 pets, one equipped at a time, each
 * with a major and a minor aura that grows as you feed it treats. Collecting
 * matters beyond the equipped one — every distinct pet owned is +0.5% to all
 * attributes, capped at +8%.
 *
 * Auras are declarative (content/collectibles.ts), so this module hands the
 * derived-stat pipeline a plain bag of effects and nothing else in the game
 * needs to know pets exist.
 */
import {
  PET_AURA_MAX_MULT,
  PET_COLLECTION_CAP,
  PET_COLLECTION_PCT,
  PET_MAX_LEVEL,
  type PetAura,
  type PetDef,
} from '@/content/collectibles';
import { getPet, PETS } from '@/content/pets';
import { PET_TREAT_BASE, PET_TREAT_EXP, PET_TREAT_RARITY_MULT } from './constants';
import { bump } from './ledger';
import type { AttributeId, GameSave } from './types';

export function petState(save: GameSave, petId: string): { owned: boolean; level: number } {
  return save.progress.pets[petId] ?? { owned: false, level: 0 };
}

export function petOwned(save: GameSave, petId: string): boolean {
  return petState(save, petId).owned;
}

export function ownedPets(save: GameSave): PetDef[] {
  return PETS.filter((pet) => petOwned(save, pet.id));
}

/** Adopt a pet. Returns false when it was already in the menagerie. */
export function grantPet(save: GameSave, petId: string): boolean {
  getPet(petId); // throws on unknown id
  if (petOwned(save, petId)) return false;
  save.progress.pets[petId] = { owned: true, level: 1 };
  // How many pets you own is derived from this map (`petsOwned` in metrics.ts),
  // so there is deliberately no counter to drift out of sync with it.
  // First pet walks itself into the empty slot — no ceremony required.
  if (save.progress.equippedPet === null) save.progress.equippedPet = petId;
  return true;
}

export function equipPet(save: GameSave, petId: string | null): void {
  if (petId !== null && !petOwned(save, petId)) throw new Error(`Pet ${petId} is not owned`);
  save.progress.equippedPet = petId;
}

// ---------------------------------------------------------------------------
// Treats & levelling
// ---------------------------------------------------------------------------

/** Treats to go from `level` to `level + 1` (rarity makes rare pets hungrier). */
export function treatsToNextLevel(petId: string, level: number): number {
  if (level >= PET_MAX_LEVEL) return 0;
  const def = getPet(petId);
  const mult = PET_TREAT_RARITY_MULT[def.rarity];
  return Math.ceil(PET_TREAT_BASE * Math.pow(level, PET_TREAT_EXP) * mult);
}

export function canFeedPet(save: GameSave, petId: string): boolean {
  const state = petState(save, petId);
  if (!state.owned || state.level >= PET_MAX_LEVEL) return false;
  return save.hero.treats >= treatsToNextLevel(petId, state.level);
}

/** Feed one level. Returns the new level. */
export function feedPet(save: GameSave, petId: string): number {
  if (!canFeedPet(save, petId)) throw new Error(`Cannot feed ${petId}`);
  const state = save.progress.pets[petId]!;
  save.hero.treats -= treatsToNextLevel(petId, state.level);
  state.level += 1;
  bump(save, 'petLevelsFed');
  return state.level;
}

/** Feed until the treats run out — the button players actually want. */
export function feedPetMax(save: GameSave, petId: string): number {
  let fed = 0;
  while (canFeedPet(save, petId)) {
    feedPet(save, petId);
    fed += 1;
  }
  return fed;
}

// ---------------------------------------------------------------------------
// Auras
// ---------------------------------------------------------------------------

/** An aura's strength at a given level: base at 1, ×PET_AURA_MAX_MULT at 50. */
export function auraValueAt(aura: PetAura, level: number): number {
  const clamped = Math.max(1, Math.min(PET_MAX_LEVEL, level));
  const t = (clamped - 1) / (PET_MAX_LEVEL - 1);
  return aura.value * (1 + t * (PET_AURA_MAX_MULT - 1));
}

export type AuraKind = PetAura['kind'];

/** The equipped pet's two auras, scaled — everything else reads this. */
export function activeAuras(save: GameSave): { aura: PetAura; value: number }[] {
  const petId = save.progress.equippedPet;
  if (petId === null || !petOwned(save, petId)) return [];
  const def = getPet(petId);
  const level = petState(save, petId).level;
  return [def.major, def.minor].map((aura) => ({ aura, value: auraValueAt(aura, level) }));
}

/** Summed strength of one aura kind from the equipped pet (0 when absent). */
export function auraTotal(save: GameSave, kind: AuraKind, attr?: AttributeId): number {
  let total = 0;
  for (const { aura, value } of activeAuras(save)) {
    if (aura.kind !== kind) continue;
    if (kind === 'attrPct' && aura.kind === 'attrPct') {
      // 'all' feeds every attribute; a named attribute only its own.
      if (aura.attr !== 'all' && attr !== undefined && aura.attr !== attr) continue;
    }
    total += value;
  }
  return total;
}

/**
 * Collection bonus: +0.5% to all attributes per DISTINCT pet owned, capped at
 * +8% (§11.1) — the reason to chase pets you'll never equip.
 */
export function collectionBonus(save: GameSave): number {
  return Math.min(PET_COLLECTION_CAP, ownedPets(save).length * PET_COLLECTION_PCT);
}

export const TOTAL_PETS = PETS.length;
