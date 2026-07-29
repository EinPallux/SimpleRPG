/** M3 engine: equip/sell, shops, potions, forge — the item lifecycle. */
import { describe, expect, it } from 'vitest';
import { parseGameSave } from '@/persist/schema';
import { buyAttributePoint, attrCost } from './economy';
import { dismantleItem, dismantlesLeft, upgradeCost, upgradeItem } from './forge';
import {
  canEquip,
  classFitness,
  equipItem,
  sellItem,
  suitsClass,
  unequipItem,
} from './inventoryOps';
import { generateItem, sellPrice, shopPrice } from './items';
import { createNewSave, deriveEmblem } from './newSave';
import { buyElixir, canBuyElixir, elixirPrice, prunePotions } from './potions';
import { Rng, seedState } from './rng';
import { buyShopItem, getShopStock, rerollShopStock, shopRerollCost } from './shops';
import { totalAttribute } from './stats';
import { applyDailyReset } from './timePassage';
import type { GameSave } from './types';

const T0 = new Date(2026, 6, 28, 9, 0).getTime();
const HOUR = 3_600_000;

function fresh(gold = 0): GameSave {
  const save = createNewSave(
    {
      name: 'Meri',
      classId: 'warrior',
      emblem: deriveEmblem('Meri', 'warrior'),
      worldSeed: 'e'.repeat(32),
    },
    T0,
  );
  save.hero.gold = gold;
  return save;
}

const rig = () => new Rng(seedState('hero-econ', 'loot'));

describe('equip / unequip / sell', () => {
  it('equips into the right slot and swaps the previous piece back', () => {
    const save = fresh();
    const sword = generateItem(
      { ilvl: 5, rarity: 'rare', slot: 'weapon', classId: 'warrior' },
      rig(),
    );
    const sword2 = generateItem(
      { ilvl: 8, rarity: 'epic', slot: 'weapon', classId: 'warrior' },
      rig(),
    );
    const mageStaff = generateItem(
      { ilvl: 5, rarity: 'rare', slot: 'weapon', classId: 'mage' },
      rig(),
    );
    save.inventory.backpack.push(sword, sword2, mageStaff);

    // Nothing is class-LOCKED since B1: the mage staff goes on a warrior fine,
    // it is simply a worse deal, which `classFitness` is what quantifies.
    expect(canEquip(save, mageStaff)).toBe(true);
    expect(suitsClass(save, mageStaff)).toBe(false);
    expect(classFitness(save, mageStaff)).toBeLessThan(1);
    expect(classFitness(save, sword)).toBe(1);
    expect(() => equipItem(save, 2)).not.toThrow();
    unequipItem(save, 'weapon'); // put the staff back before the swap chain

    equipItem(save, 0);
    expect(save.inventory.equipped.weapon?.id).toBe(sword.id);
    equipItem(save, 0); // sword2 now at index 0 — swap
    expect(save.inventory.equipped.weapon?.id).toBe(sword2.id);
    expect(save.inventory.backpack.some((i) => i.id === sword.id)).toBe(true);

    unequipItem(save, 'weapon');
    expect(save.inventory.equipped.weapon).toBeUndefined();
  });

  it('gear lines feed totalAttribute', () => {
    const save = fresh();
    const item = generateItem(
      { ilvl: 20, rarity: 'rare', slot: 'chest', classId: 'warrior' },
      rig(),
    );
    item.lines = [
      { attr: 'str', value: 9 },
      { attr: 'all', value: 4 },
    ];
    save.inventory.backpack.push(item);
    const before = totalAttribute(save, 'str');
    equipItem(save, 0);
    expect(totalAttribute(save, 'str')).toBe(before + 13);
  });

  it('selling pays the 20% rate and frees the slot', () => {
    const save = fresh();
    const item = generateItem({ ilvl: 10, rarity: 'epic', slot: 'ring' }, rig());
    save.inventory.backpack.push(item);
    const gold = sellItem(save, 0);
    expect(gold).toBe(sellPrice(item));
    expect(save.hero.gold).toBe(gold);
    expect(save.inventory.backpack).toHaveLength(0);
  });
});

describe('attribute purchases', () => {
  it('deducts escalating gold and raises the bought counter', () => {
    const save = fresh(1000);
    buyAttributePoint(save, 'str');
    expect(save.hero.attrsBought.str).toBe(1);
    expect(save.hero.gold).toBe(1000 - attrCost(1));
    expect(() => {
      for (let i = 0; i < 500; i++) buyAttributePoint(save, 'str');
    }).toThrow(/gold/);
  });
});

describe('shops', () => {
  it('stock persists per day, sells slot-appropriate wares, and marks sold shelves', () => {
    const save = fresh(1_000_000);
    const stock = getShopStock(save, 'weaponsmith');
    expect(stock).toHaveLength(6);
    expect(getShopStock(save, 'weaponsmith')).toBe(save.town.shops.weaponsmith.stock);
    for (const item of stock) {
      expect(['weapon', 'offhand']).toContain(item!.defId.split(':')[0]);
    }
    const target = stock[0]!;
    const goldBefore = save.hero.gold;
    const bought = buyShopItem(save, 'weaponsmith', 0);
    expect(bought.id).toBe(target.id);
    expect(save.hero.gold).toBe(goldBefore - shopPrice(target));
    expect(getShopStock(save, 'weaponsmith')[0]).toBeNull();
    expect(() => buyShopItem(save, 'weaponsmith', 0)).toThrow(/empty/);
  });

  it('reroll is free once per shop per day, then costs a gem; reset renews everything', () => {
    const save = fresh(1000);
    const first = getShopStock(save, 'armorer');
    expect(shopRerollCost(save, 'armorer')).toBe(0);
    rerollShopStock(save, 'armorer');
    expect(save.town.shops.armorer.stock).not.toEqual(first);
    expect(shopRerollCost(save, 'armorer')).toBe(1);
    expect(shopRerollCost(save, 'arcanum')).toBe(0); // per-shop gates
    save.hero.gems = 0; // creation now grants STARTING_GEMS
    expect(() => rerollShopStock(save, 'armorer')).toThrow(/gems/);

    applyDailyReset(save, T0 + 24 * HOUR);
    expect(save.town.shops.armorer.stock).toBeNull();
    expect(shopRerollCost(save, 'armorer')).toBe(0);
  });
});

describe('elixirs', () => {
  it('buys into 3 sockets, replaces same-attribute, rejects a 4th attribute', () => {
    const save = fresh(10_000_000);
    buyElixir(save, 'elixir-str-1', T0);
    buyElixir(save, 'elixir-dex-2', T0);
    buyElixir(save, 'elixir-con-1', T0);
    expect(save.hero.potions).toHaveLength(3);
    expect(canBuyElixir(save, 'elixir-lck-1')).toEqual({ ok: false, reason: 'slots' });
    buyElixir(save, 'elixir-str-3', T0); // upgrade in place, same socket count
    expect(save.hero.potions).toHaveLength(3);
    expect(save.hero.potions.find((p) => p.attribute === 'str')?.elixirId).toBe('elixir-str-3');
  });

  it('boosts totalAttribute by its percent and expires after 24h', () => {
    const save = fresh(10_000_000);
    const base = totalAttribute(save, 'str'); // warrior start STR 12
    buyElixir(save, 'elixir-str-3', T0); // +25%
    expect(totalAttribute(save, 'str')).toBe(Math.round(base * 1.25));
    prunePotions(save, T0 + 25 * HOUR);
    expect(save.hero.potions).toHaveLength(0);
    expect(totalAttribute(save, 'str')).toBe(base);
  });

  it('prices scale with level (a standing sink)', () => {
    const low = fresh();
    const high = fresh();
    high.hero.level = 50;
    expect(elixirPrice(high, 'elixir-str-1')).toBeGreaterThan(
      elixirPrice(low, 'elixir-str-1') * 100,
    );
  });
});

describe('forge', () => {
  it('upgrades cost scraps + gold and raise base stats 2.5%/level', () => {
    const save = fresh(1_000_000);
    save.hero.scraps = 100;
    const item = generateItem(
      { ilvl: 10, rarity: 'rare', slot: 'weapon', classId: 'warrior' },
      rig(),
    );
    save.inventory.backpack.push(item);
    const cost = upgradeCost(item)!;
    expect(cost.scraps).toBe(1);
    upgradeItem(save, { kind: 'backpack', index: 0 });
    expect(item.upgrade).toBe(1);
    expect(save.hero.scraps).toBe(99);
    expect(upgradeCost({ ...item, upgrade: 20 })).toBeNull();
  });

  it('dismantling is gated to 5 a day and pays the rarity table', () => {
    const save = fresh();
    for (let i = 0; i < 6; i++) {
      save.inventory.backpack.push(generateItem({ ilvl: 5, rarity: 'epic', slot: 'belt' }, rig()));
    }
    for (let i = 0; i < 5; i++) dismantleItem(save, 0);
    expect(save.hero.scraps).toBe(40); // 5 × epic 8
    expect(save.hero.dust).toBe(5);
    expect(dismantlesLeft(save)).toBe(0);
    expect(() => dismantleItem(save, 0)).toThrow(/cool/);
    applyDailyReset(save, T0 + 24 * HOUR);
    expect(dismantlesLeft(save)).toBe(5);
  });
});

describe('save integrity through the whole lifecycle', () => {
  it('remains schema-valid after shopping, equipping, potions and forging', () => {
    const save = fresh(10_000_000);
    save.hero.scraps = 50;
    getShopStock(save, 'weaponsmith');
    const idx = getShopStock(save, 'weaponsmith').findIndex(
      (i) => i?.classId === 'warrior' || i?.classId === null,
    );
    if (idx >= 0) {
      buyShopItem(save, 'weaponsmith', idx);
      equipItem(save, 0);
    }
    buyElixir(save, 'elixir-con-2', T0);
    expect(() => parseGameSave(JSON.parse(JSON.stringify(save)))).not.toThrow();
  });
});
