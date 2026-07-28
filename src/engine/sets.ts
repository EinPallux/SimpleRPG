/**
 * Set-bonus aggregation (CONTENT_CATALOG.md §6.1, BALANCING §4.6): counts
 * equipped pieces per set and folds the active tiers (2-pc / 4-pc / full)
 * into one additive package. Combat behaviors ride the Combatant flags
 * (engine/combat.ts); economy perks (gold/xp/item-chance/expeditions) are
 * read by their systems from the same aggregate.
 */
import { getSet, type SetDef, type SetSpecialEffect, type SetStatBonus } from '@/content/sets';
import { generateSetPiece, slotOf } from './items';
import type { Rng } from './rng';
import {
  ATTRIBUTE_IDS,
  type AttributeId,
  type EquipSlot,
  type GameSave,
  type ItemInstance,
} from './types';

export interface EquippedSet {
  def: SetDef;
  count: number;
}

/** Distinct sets among equipped gear with their piece counts. */
export function equippedSets(save: GameSave): EquippedSet[] {
  const counts = new Map<string, number>();
  for (const item of Object.values(save.inventory.equipped)) {
    if (item?.setId) counts.set(item.setId, (counts.get(item.setId) ?? 0) + 1);
  }
  return [...counts.entries()].map(([setId, count]) => ({ def: getSet(setId), count }));
}

export interface SetAggregate {
  attrPct: Record<AttributeId, number>;
  armorPct: number;
  hpPct: number;
  weaponDmgPct: number;
  critDmgPct: number;
  critPP: number;
  blockPP: number;
  evadePP: number;
  /** highest absolute crit-cap override among active bonuses */
  critCap: number | null;
  goldPct: number;
  xpPct: number;
  /** full-set behaviors currently active */
  effects: SetSpecialEffect[];
}

function emptyAggregate(): SetAggregate {
  return {
    attrPct: { str: 0, dex: 0, int: 0, con: 0, lck: 0 },
    armorPct: 0,
    hpPct: 0,
    weaponDmgPct: 0,
    critDmgPct: 0,
    critPP: 0,
    blockPP: 0,
    evadePP: 0,
    critCap: null,
    goldPct: 0,
    xpPct: 0,
    effects: [],
  };
}

function addBonus(agg: SetAggregate, bonus: SetStatBonus): void {
  for (const attr of ATTRIBUTE_IDS) {
    agg.attrPct[attr] += (bonus.attrPct?.[attr] ?? 0) + (bonus.allAttrPct ?? 0);
  }
  agg.armorPct += bonus.armorPct ?? 0;
  agg.hpPct += bonus.hpPct ?? 0;
  agg.weaponDmgPct += bonus.weaponDmgPct ?? 0;
  agg.critDmgPct += bonus.critDmgPct ?? 0;
  agg.critPP += bonus.critPP ?? 0;
  agg.blockPP += bonus.blockPP ?? 0;
  agg.evadePP += bonus.evadePP ?? 0;
  if (bonus.critCap !== undefined) {
    agg.critCap = Math.max(agg.critCap ?? 0, bonus.critCap);
  }
  agg.goldPct += bonus.goldPct ?? 0;
  agg.xpPct += bonus.xpPct ?? 0;
}

/** Tier gates: 2-pc at ≥2 · 4-pc at ≥4 · full only when every slot is worn. */
export function setAggregate(save: GameSave): SetAggregate {
  const agg = emptyAggregate();
  for (const { def, count } of equippedSets(save)) {
    if (count >= 2) addBonus(agg, def.two);
    if (count >= 4 && def.four) addBonus(agg, def.four);
    if (count === def.slots.length) {
      if (def.full.bonus) addBonus(agg, def.full.bonus);
      if (def.full.effect) agg.effects.push(def.full.effect);
    }
  }
  return agg;
}

/** Convenience: the active full-set effect of a given kind, if any. */
export function activeEffect<K extends SetSpecialEffect['kind']>(
  save: GameSave,
  kind: K,
): Extract<SetSpecialEffect, { kind: K }> | undefined {
  return setAggregate(save).effects.find(
    (e): e is Extract<SetSpecialEffect, { kind: K }> => e.kind === kind,
  );
}

/** Slots of a set the hero already owns (equipped or bagged). */
export function ownedSetSlots(save: GameSave, setId: string): Set<EquipSlot> {
  const owned = new Set<EquipSlot>();
  const all = [...Object.values(save.inventory.equipped), ...save.inventory.backpack];
  for (const item of all) {
    if (item?.setId === setId) owned.add(slotOf(item));
  }
  return owned;
}

/**
 * Roll a piece of a set, preferring slots the hero doesn't own (GAME_DESIGN
 * §15 dupe protection). A completed set yields a random piece — dismantle fuel.
 */
export function rollSetPiece(save: GameSave, setId: string, rng: Rng): ItemInstance {
  const def = getSet(setId);
  const owned = ownedSetSlots(save, setId);
  const missing = def.slots.filter((slot) => !owned.has(slot));
  const pool = missing.length > 0 ? missing : def.slots;
  return generateSetPiece(setId, rng.pick(pool), rng);
}

/** True when the hero owns every slot of the set (drop pools use this for pity). */
export function ownsFullSet(save: GameSave, setId: string): boolean {
  return ownedSetSlots(save, setId).size === getSet(setId).slots.length;
}
