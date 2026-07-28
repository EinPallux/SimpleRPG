/** Old Coalbeard's benches (GAME_DESIGN.md §9.6): upgrade & dismantle. Reforge lands at L60 (M5+). */
import {
  DISMANTLES_PER_DAY,
  FORGE_GOLD_COEF,
  FORGE_GOLD_EXP,
  FORGE_UPGRADE_MAX,
} from './constants';
import { dismantleYield, shopPrice } from './items';
import type { EquipSlot, GameSave, ItemInstance } from './types';

export type ItemLocation =
  { kind: 'equipped'; slot: EquipSlot } | { kind: 'backpack'; index: number };

export function itemAt(save: GameSave, loc: ItemLocation): ItemInstance | null {
  return loc.kind === 'equipped'
    ? (save.inventory.equipped[loc.slot] ?? null)
    : (save.inventory.backpack[loc.index] ?? null);
}

/** Cost of the NEXT upgrade level: k scraps + 0.12 × k^1.8 × shopPrice gold (§5.5). */
export function upgradeCost(item: ItemInstance): { scraps: number; gold: number } | null {
  if (item.upgrade >= FORGE_UPGRADE_MAX) return null;
  const k = item.upgrade + 1;
  return {
    scraps: k,
    gold: Math.ceil(FORGE_GOLD_COEF * Math.pow(k, FORGE_GOLD_EXP) * shopPrice(item)),
  };
}

export function upgradeItem(save: GameSave, loc: ItemLocation): ItemInstance {
  const item = itemAt(save, loc);
  if (!item) throw new Error('No item there to upgrade');
  const cost = upgradeCost(item);
  if (!cost) throw new Error('Already at the maximum upgrade');
  if (save.hero.scraps < cost.scraps) throw new Error('Not enough scraps');
  if (save.hero.gold < cost.gold) throw new Error('Not enough gold');
  save.hero.scraps -= cost.scraps;
  save.hero.gold -= cost.gold;
  item.upgrade += 1;
  save.stats.upgradesForged = (save.stats.upgradesForged ?? 0) + 1;
  save.stats.goldSpent = (save.stats.goldSpent ?? 0) + cost.gold;
  save.stats.maxUpgradeReached = Math.max(save.stats.maxUpgradeReached ?? 0, item.upgrade);
  return item;
}

export function dismantlesLeft(save: GameSave): number {
  return Math.max(0, DISMANTLES_PER_DAY - save.daily.dismantles);
}

/** Break a backpack item into materials — 5 a day, no exceptions (daily gate). */
export function dismantleItem(
  save: GameSave,
  backpackIndex: number,
): { scraps: number; dust: number } {
  if (dismantlesLeft(save) === 0) throw new Error('The furnace needs to cool until tomorrow');
  const item = save.inventory.backpack[backpackIndex];
  if (!item) throw new Error(`No backpack item at index ${backpackIndex}`);
  const yields = dismantleYield(item);
  save.inventory.backpack.splice(backpackIndex, 1);
  save.hero.scraps += yields.scraps;
  save.hero.dust += yields.dust;
  save.daily.dismantles += 1;
  save.stats.itemsDismantled = (save.stats.itemsDismantled ?? 0) + 1;
  return yields;
}
