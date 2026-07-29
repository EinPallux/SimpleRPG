/** Equip/unequip/sell — the item lifecycle verbs (GAME_DESIGN.md §9.3). */
import { getClass } from '@/content/classes';
import { sellPrice, slotOf } from './items';
import type { EquipSlot, GameSave, ItemInstance } from './types';

/**
 * Anyone can wear anything.
 *
 * The class cut on a piece is a statement about who it was MADE for, not a lock
 * — a Mage may absolutely put on plate, and will then be a Mage in plate, which
 * is its own answer. Refusing the equip taught nothing and just meant two
 * thirds of every drop was a dead card the moment it was named; letting it
 * through turns the same drop into a decision the stat lines argue about.
 *
 * `suitsClass` below is what the UI warns with, and it is advice, never a gate.
 */
export function canEquip(_save: GameSave, _item: ItemInstance): boolean {
  return true;
}

/** True when the piece was cut for this hero's class (or for nobody in particular). */
export function suitsClass(save: GameSave, item: ItemInstance): boolean {
  return item.classId === null || item.classId === save.hero.classId;
}

/**
 * How much of this piece the hero actually gets to use, 0–1.
 *
 * A class-cut piece rolls its stat lines slanted toward that class's main
 * attribute, so wearing the wrong one is not forbidden, it is simply a worse
 * deal: the armour and the damage still count, and the lines that do not match
 * your main attribute are the part you are leaving on the table. This is the
 * number the UI turns into "you would be wasting most of this".
 */
export function classFitness(save: GameSave, item: ItemInstance): number {
  if (suitsClass(save, item)) return 1;
  const mine = getClass(save.hero.classId).mainAttr;
  if (item.lines.length === 0) return 1; // nothing to waste
  const useful = item.lines.filter((l) => l.attr === mine || l.attr === 'all').length;
  // Half credit for the base armour/damage, which every class benefits from.
  return 0.5 + 0.5 * (useful / item.lines.length);
}

/**
 * Equip a backpack item into its slot; anything already there swaps into the
 * backpack (net space change is zero, so a full backpack still allows swaps).
 */
export function equipItem(save: GameSave, backpackIndex: number): void {
  const item = save.inventory.backpack[backpackIndex];
  if (!item) throw new Error(`No backpack item at index ${backpackIndex}`);
  const slot: EquipSlot = slotOf(item);
  const previous = save.inventory.equipped[slot];
  save.inventory.backpack.splice(backpackIndex, 1);
  if (previous) save.inventory.backpack.push(previous);
  save.inventory.equipped[slot] = item;
}

export function unequipItem(save: GameSave, slot: EquipSlot): void {
  const item = save.inventory.equipped[slot];
  if (!item) throw new Error(`Nothing equipped in ${slot}`);
  if (save.inventory.backpack.length >= save.inventory.capacity) {
    throw new Error('Backpack is full');
  }
  delete save.inventory.equipped[slot];
  save.inventory.backpack.push(item);
}

export function sellItem(save: GameSave, backpackIndex: number): number {
  const item = save.inventory.backpack[backpackIndex];
  if (!item) throw new Error(`No backpack item at index ${backpackIndex}`);
  const gold = sellPrice(item);
  save.inventory.backpack.splice(backpackIndex, 1);
  save.hero.gold += gold;
  save.stats.itemsSold = (save.stats.itemsSold ?? 0) + 1;
  // Parting with a legendary is a feat of its own kind (title: the Regretful).
  if (item.rarity === 'legendary') {
    save.stats.legendariesSold = (save.stats.legendariesSold ?? 0) + 1;
  }
  return gold;
}
