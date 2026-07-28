/**
 * Item generation & valuation (BALANCING.md §5). Items are procedural: an
 * ItemInstance's stats derive from (slot, ilvl, rarity, classId, lines, seed).
 * Set/legendary catalog pieces join in M5/M7; shops/forge UI in M3.
 */
import {
  ALL_ATTR_LINE_FACTOR,
  ARMOR_PER_ILVL,
  DISMANTLE_DUST,
  DISMANTLE_SCRAPS,
  DROP_ILVL_SPREAD,
  DROP_WEIGHTS_CHEST,
  DROP_WEIGHTS_MISSION,
  ITEM_CHANCE_CAP,
  ITEM_CHANCE_LUCK_MAX_BONUS,
  ITEM_VALUE_EXP,
  LINE_VALUE_PER_ILVL,
  MISSION_ITEM_CHANCE,
  RARITY_BASE_MULT,
  RARITY_LINES,
  RARITY_VALUE_MULT,
  SELL_PRICE_MULT,
  SHOP_PRICE_MULT,
  SLOT_WEIGHTS,
  WEAPON_BASE,
  WEAPON_PER_ILVL,
  WEAPON_SPREAD,
} from './constants';
import { getClass } from '@/content/classes';
import { getSet } from '@/content/sets';
import type { Rng } from './rng';
import type { AttributeId, BonusLineType, ClassId, EquipSlot, ItemInstance, Rarity } from './types';

export const EQUIP_SLOTS: readonly EquipSlot[] = [
  'weapon',
  'offhand',
  'helmet',
  'chest',
  'gloves',
  'boots',
  'belt',
  'amulet',
  'ring',
  'talisman',
];

const JEWELRY: readonly EquipSlot[] = ['amulet', 'ring', 'talisman'];
const ATTR_LINES: readonly AttributeId[] = ['str', 'dex', 'int', 'con', 'lck'];
const PERCENT_LINES: readonly BonusLineType[] = ['critDmg', 'goldFind', 'xp'];

// ---------------------------------------------------------------------------
// Derived stats
// ---------------------------------------------------------------------------

/** Weapon damage range for an instance (upgrades add +2.5% per level). */
export function weaponDamage(item: ItemInstance): { min: number; max: number } {
  const mid = (WEAPON_BASE + WEAPON_PER_ILVL * item.ilvl) * RARITY_BASE_MULT[item.rarity];
  const up = 1 + 0.025 * item.upgrade;
  return {
    min: Math.max(1, Math.round(mid * (1 - WEAPON_SPREAD) * up)),
    max: Math.max(1, Math.round(mid * (1 + WEAPON_SPREAD) * up)),
  };
}

/** Armor contributed by an armor-slot instance (0 for weapons/jewelry). */
export function itemArmor(item: ItemInstance): number {
  const slot = slotOf(item);
  const weight = (SLOT_WEIGHTS as Record<string, number>)[slot];
  if (!weight) return 0;
  const classMult = item.classId ? getClass(item.classId).armorMult : 1;
  const up = 1 + 0.025 * item.upgrade;
  return Math.round(
    weight * ARMOR_PER_ILVL * item.ilvl * classMult * RARITY_BASE_MULT[item.rarity] * up,
  );
}

export function slotOf(item: ItemInstance): EquipSlot {
  const slot = item.defId.split(':')[0] as EquipSlot;
  if (!EQUIP_SLOTS.includes(slot)) throw new Error(`Bad item defId: ${item.defId}`);
  return slot;
}

/** Base valuation (§5.4): itemValue = ilvl^1.75 × rarityValueMult. */
export function itemValue(item: ItemInstance): number {
  return Math.round(Math.pow(item.ilvl, ITEM_VALUE_EXP) * RARITY_VALUE_MULT[item.rarity]);
}

export function shopPrice(item: ItemInstance): number {
  return Math.max(1, Math.round(itemValue(item) * SHOP_PRICE_MULT));
}

export function sellPrice(item: ItemInstance): number {
  return Math.max(1, Math.round(itemValue(item) * SELL_PRICE_MULT));
}

export function dismantleYield(item: ItemInstance): { scraps: number; dust: number } {
  return { scraps: DISMANTLE_SCRAPS[item.rarity], dust: DISMANTLE_DUST[item.rarity] };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export interface GenerateItemInput {
  ilvl: number;
  rarity: Rarity;
  slot?: EquipSlot;
  /** class the piece is cut for; omit for a random cut biased to `biasClass` */
  classId?: ClassId | null;
  biasClass?: ClassId;
}

/** Deterministic given the rng stream state. */
export function generateItem(input: GenerateItemInput, rng: Rng): ItemInstance {
  const slot = input.slot ?? rng.pick(EQUIP_SLOTS);
  const classId =
    input.classId !== undefined
      ? input.classId
      : JEWELRY.includes(slot)
        ? null // jewelry is classless
        : input.biasClass && rng.chance(0.6)
          ? input.biasClass
          : rng.pick(['warrior', 'scout', 'mage', 'assassin'] as const);

  const lineCount = RARITY_LINES[input.rarity];
  const lines: ItemInstance['lines'] = [];
  const used = new Set<BonusLineType>();
  const jewelryBonus = JEWELRY.includes(slot) ? 1 : 0; // §5.1: jewelry trades armor for +1 line
  for (let i = 0; i < lineCount + jewelryBonus && i < 4; i++) {
    const canPercent =
      input.rarity === 'epic' || input.rarity === 'legendary' || input.rarity === 'set';
    const usePercent = canPercent && rng.chance(0.2);
    const pool = (usePercent ? PERCENT_LINES : [...ATTR_LINES, 'all' as const]).filter(
      (l) => !used.has(l),
    );
    if (pool.length === 0) break;
    const attr = rng.pick(pool);
    used.add(attr);
    let value: number;
    if (attr === 'critDmg' || attr === 'goldFind') value = rng.int(5, 15);
    else if (attr === 'xp') value = rng.int(5, 10);
    else if (attr === 'all')
      value = Math.max(1, Math.ceil(LINE_VALUE_PER_ILVL * input.ilvl * ALL_ATTR_LINE_FACTOR));
    else value = Math.max(1, Math.ceil(LINE_VALUE_PER_ILVL * input.ilvl));
    lines.push({ attr, value });
  }

  return {
    // id derives purely from the stream → same seed, same item, every run
    id: `itm-${rng.nextUint32().toString(36)}${rng.nextUint32().toString(36)}`,
    defId: `${slot}:${classId ?? 'any'}`,
    ilvl: Math.max(1, input.ilvl),
    rarity: input.rarity,
    classId,
    lines,
    upgrade: 0,
    seed: rng.nextUint32(),
  };
}

// ---------------------------------------------------------------------------
// Drops
// ---------------------------------------------------------------------------

/** Mission item chance with Luck's small nudge (§5.6). */
export function effectiveItemChance(luck: number, level: number): number {
  return Math.min(
    ITEM_CHANCE_CAP,
    MISSION_ITEM_CHANCE + (luck / (luck + 50 * level)) * ITEM_CHANCE_LUCK_MAX_BONUS,
  );
}

/** A set piece: fixed slot, fixed ilvl (the set's level), set rarity + setId. */
export function generateSetPiece(setId: string, slot: EquipSlot, rng: Rng): ItemInstance {
  const def = getSet(setId);
  const item = generateItem(
    { ilvl: def.level, rarity: 'set', slot, classId: def.classId },
    rng,
  );
  item.setId = setId;
  return item;
}

export type DropSource = 'mission' | 'chest';

/** Roll a dropped item at hero level (ilvl = level ± 2, table by source). */
export function rollDrop(
  source: DropSource,
  heroLevel: number,
  biasClass: ClassId,
  rng: Rng,
): ItemInstance {
  const weights = source === 'chest' ? DROP_WEIGHTS_CHEST : DROP_WEIGHTS_MISSION;
  const rarity = rng.weighted(weights.map(([r, w]) => [r as Rarity, w] as const));
  const ilvl = Math.max(1, heroLevel + rng.int(-DROP_ILVL_SPREAD, DROP_ILVL_SPREAD));
  return generateItem({ ilvl, rarity, biasClass }, rng);
}
