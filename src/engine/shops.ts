/**
 * The three merchants of Brambleford (GAME_DESIGN.md §9.5): 6-slot daily stock,
 * one free reroll per shop per day, gems afterwards. Stock persists in the save
 * (no stock-fishing); the daily reset clears it for lazy regeneration.
 */
import { DROP_WEIGHTS_SHOP, SHOP_REROLL_COST_GEMS, SHOP_STOCK_SIZE } from './constants';
import { generateItem, shopPrice } from './items';
import { getStream } from './rng';
import type { EquipSlot, GameSave, ItemInstance, Rarity, ShopId } from './types';

const SHOP_SLOTS: Record<ShopId, readonly EquipSlot[]> = {
  weaponsmith: ['weapon', 'weapon', 'offhand'], // weapons twice as likely
  armorer: ['helmet', 'chest', 'gloves', 'boots', 'belt'],
  arcanum: ['amulet', 'ring', 'talisman'],
};

export const SHOP_IDS: readonly ShopId[] = ['weaponsmith', 'armorer', 'arcanum'];

function rollStock(save: GameSave, shopId: ShopId): (ItemInstance | null)[] {
  const rng = getStream(save.rngState, save.worldSeed, 'loot');
  const stock: ItemInstance[] = [];
  for (let i = 0; i < SHOP_STOCK_SIZE; i++) {
    const rarity = rng.weighted(DROP_WEIGHTS_SHOP.map(([r, w]) => [r as Rarity, w] as const));
    const slot = rng.pick(SHOP_SLOTS[shopId]);
    const ilvl = Math.max(1, save.hero.level + rng.int(-2, 2));
    stock.push(generateItem({ ilvl, rarity, slot, biasClass: save.hero.classId }, rng));
  }
  return stock;
}

/** The standing stock — lazily rolled, persisted until reroll or daily reset. */
export function getShopStock(save: GameSave, shopId: ShopId): (ItemInstance | null)[] {
  const shop = save.town.shops[shopId];
  if (!shop.stock) shop.stock = rollStock(save, shopId);
  return shop.stock;
}

export function shopRerollCost(save: GameSave, shopId: ShopId): number {
  return save.town.shops[shopId].rerollUsed ? SHOP_REROLL_COST_GEMS : 0;
}

export function rerollShopStock(save: GameSave, shopId: ShopId): void {
  const cost = shopRerollCost(save, shopId);
  if (save.hero.gems < cost) throw new Error('Not enough gems to refresh the stock');
  if (cost > 0) save.hero.gems -= cost;
  else save.town.shops[shopId].rerollUsed = true;
  save.town.shops[shopId].stock = rollStock(save, shopId);
}

export function buyShopItem(save: GameSave, shopId: ShopId, index: number): ItemInstance {
  const stock = getShopStock(save, shopId);
  const item = stock[index];
  if (!item) throw new Error('That shelf is empty');
  const price = shopPrice(item);
  if (save.hero.gold < price) throw new Error('Not enough gold');
  if (save.inventory.backpack.length >= save.inventory.capacity) {
    throw new Error('Backpack is full');
  }
  save.hero.gold -= price;
  save.inventory.backpack.push(item);
  stock[index] = null; // sold out for the day
  save.stats.shopPurchases = (save.stats.shopPurchases ?? 0) + 1;
  return item;
}

/** Daily reset hook: clear stock (lazy re-roll) and reroll flags. */
export function resetShopsDaily(save: GameSave): void {
  for (const shopId of SHOP_IDS) {
    save.town.shops[shopId] = { stock: null, rerollUsed: false };
  }
}
