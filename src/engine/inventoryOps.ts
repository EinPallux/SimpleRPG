/** Equip/unequip/sell — the item lifecycle verbs (GAME_DESIGN.md §9.3). */
import { sellPrice, slotOf } from './items';
import type { EquipSlot, GameSave, ItemInstance } from './types';

export function canEquip(save: GameSave, item: ItemInstance): boolean {
  return item.classId === null || item.classId === save.hero.classId;
}

/**
 * Equip a backpack item into its slot; anything already there swaps into the
 * backpack (net space change is zero, so a full backpack still allows swaps).
 */
export function equipItem(save: GameSave, backpackIndex: number): void {
  const item = save.inventory.backpack[backpackIndex];
  if (!item) throw new Error(`No backpack item at index ${backpackIndex}`);
  if (!canEquip(save, item)) throw new Error('This piece is cut for another class');
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
  return gold;
}
