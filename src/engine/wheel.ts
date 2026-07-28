/**
 * The Wheel of Destiny (GAME_DESIGN.md §14, CONTENT §11, payouts BALANCING
 * §4.6): five daily spins, the first free, the rest at rising gold cost.
 * Everything rolls on the persisted `wheel` stream — Lorenzo is honest,
 * mathematically speaking.
 */
import { WHEEL_SLOTS, type WheelSlotKind } from '@/content/wheel';
import {
  WHEEL_DUST,
  WHEEL_GEMS,
  WHEEL_GOLD,
  WHEEL_SCRAPS,
  WHEEL_SPIN_COSTS,
  WHEEL_SPINS_PER_DAY,
  WHEEL_TREATS,
  WHEEL_XP_MULT,
} from './constants';
import { missionGold, missionXp } from './economy';
import { generateItem, rollDrop, sellPrice } from './items';
import { getStream, type Rng } from './rng';
import type { GameSave, ItemInstance } from './types';
import { applyXp, type XpResult } from './xpGain';

export function wheelSpinsLeft(save: GameSave): number {
  return Math.max(0, WHEEL_SPINS_PER_DAY - save.daily.wheelSpins);
}

/** Gold cost of the NEXT spin (0 = the daily free one), null when spent out. */
export function wheelSpinCost(save: GameSave): number | null {
  if (wheelSpinsLeft(save) === 0) return null;
  const mult = WHEEL_SPIN_COSTS[save.daily.wheelSpins] ?? WHEEL_SPIN_COSTS[4]!;
  return Math.round(missionGold(save.hero.level, 10) * mult);
}

export function canSpinWheel(save: GameSave): boolean {
  const cost = wheelSpinCost(save);
  return cost !== null && save.hero.gold >= cost;
}

export interface WheelOutcome {
  /** index into WHEEL_SLOTS where the pointer lands (final result) */
  slotIndex: number;
  kind: WheelSlotKind;
  /** the pointer first hit Mystery, then re-rolled with payouts doubled */
  mystery: boolean;
  cost: number;
  gold: number;
  xp: XpResult | null;
  items: ItemInstance[];
  scraps: number;
  treats: number;
  dust: number;
  gems: number;
  autoSoldGold: number;
}

function pickSlot(rng: Rng, exclude: WheelSlotKind[] = []): number {
  const pool = WHEEL_SLOTS.map((slot, index) => ({ slot, index })).filter(
    ({ slot }) => !exclude.includes(slot.kind),
  );
  const picked = rng.weighted(pool.map((p) => [p, p.slot.weight] as const));
  return picked.index;
}

export function spinWheel(save: GameSave): WheelOutcome {
  const cost = wheelSpinCost(save);
  if (cost === null) throw new Error('No spins left today');
  if (save.hero.gold < cost) throw new Error('Not enough gold');
  save.hero.gold -= cost;
  save.daily.wheelSpins += 1;

  const rng = getStream(save.rngState, save.worldSeed, 'wheel');
  let slotIndex = pickSlot(rng);
  let mystery = false;
  if (WHEEL_SLOTS[slotIndex]!.kind === 'mystery') {
    // Mystery: land somewhere else, payout doubled (jackpot stays earned, not gifted).
    mystery = true;
    slotIndex = pickSlot(rng, ['mystery', 'jackpot']);
  }
  const kind = WHEEL_SLOTS[slotIndex]!.kind;
  const mult = mystery ? 2 : 1;
  const m10 = missionGold(save.hero.level, 10);

  let gold = 0;
  let xp: XpResult | null = null;
  const items: ItemInstance[] = [];
  let scraps = 0;
  let treats = 0;
  let dust = 0;
  let gems = 0;

  if (kind === 'goldS' || kind === 'goldM' || kind === 'goldL') {
    gold = Math.round(m10 * WHEEL_GOLD[kind] * mult);
  } else if (kind === 'xp') {
    xp = applyXp(save, Math.round(missionXp(save.hero.level, 10) * WHEEL_XP_MULT * mult));
  } else if (kind === 'item') {
    for (let i = 0; i < mult; i++) {
      items.push(rollDrop('mission', save.hero.level, save.hero.classId, rng));
    }
  } else if (kind === 'scraps') {
    scraps = WHEEL_SCRAPS * mult;
  } else if (kind === 'treats') {
    treats = WHEEL_TREATS * mult;
  } else if (kind === 'dust') {
    dust = WHEEL_DUST * mult;
  } else if (kind === 'gem') {
    gems = WHEEL_GEMS * mult;
  } else if (kind === 'jackpot') {
    // Legendary at hero level. The Gilded Snail (pets) and the 25-gem fallback
    // join with the Menagerie in M7 — until then the wheel always pays gear.
    items.push(
      generateItem(
        { ilvl: save.hero.level + 2, rarity: 'legendary', biasClass: save.hero.classId },
        rng,
      ),
    );
  }
  // 'salute': nothing but dignity.

  let autoSoldGold = 0;
  for (const item of items) {
    if (save.inventory.backpack.length < save.inventory.capacity) {
      save.inventory.backpack.push(item);
    } else {
      autoSoldGold += sellPrice(item);
    }
  }

  save.hero.gold += gold + autoSoldGold;
  save.hero.scraps += scraps;
  save.hero.treats += treats;
  save.hero.dust += dust;
  save.hero.gems += gems;
  if (gold + autoSoldGold > 0) {
    save.stats.goldEarned = (save.stats.goldEarned ?? 0) + gold + autoSoldGold;
  }
  save.stats.wheelSpins = (save.stats.wheelSpins ?? 0) + 1;

  return {
    slotIndex,
    kind,
    mystery,
    cost,
    gold,
    xp,
    items,
    scraps,
    treats,
    dust,
    gems,
    autoSoldGold,
  };
}
