/**
 * The Stable (GAME_DESIGN.md §11.2): four mounts, each a permanent purchase
 * that shortens every mission. Upgrading pays the difference.
 *
 * The speed itself was already wired in M2 — `missionDurationSec` reads
 * `MOUNT_SPEED[save.progress.mountTier]` — so this module is only the shop
 * side: what you can afford, what it costs, and the little title that comes
 * with the animal.
 */
import {
  getMount,
  MAX_MOUNT_TIER,
  mountForTier,
  upgradeCostGems,
  upgradeCostGold,
} from '@/content/mounts';
import type { MountDef } from '@/content/mounts';
import { MOUNT_SPEED, STABLE_UNLOCK_LEVEL } from './constants';
import { bump } from './ledger';
import { grantTitle } from './rewards';
import type { GameSave } from './types';

export { MAX_MOUNT_TIER, getMount, mountForTier };
export type { MountDef };

export function stableUnlocked(save: GameSave): boolean {
  return save.hero.level >= STABLE_UNLOCK_LEVEL;
}

/** The mount currently in the stall, or null when on foot. */
export function currentMount(save: GameSave): MountDef | null {
  return mountForTier(save.progress.mountTier);
}

/** Mission-duration reduction in force, mount only (pets add theirs later). */
export function mountSpeedup(save: GameSave): number {
  return MOUNT_SPEED[save.progress.mountTier] ?? 0;
}

export interface MountPrice {
  gold: number;
  gems: number;
}

/** What trading up from the current tier to `tier` costs, per currency. */
export function mountPrice(save: GameSave, tier: number): MountPrice {
  const from = save.progress.mountTier;
  return { gold: upgradeCostGold(from, tier), gems: upgradeCostGems(from, tier) };
}

/**
 * The Stable only sells UP. Buying a tier you already have (or a lower one)
 * would be a free no-op that quietly re-grants its title, so it is refused
 * outright rather than clamped.
 */
export function canBuyMount(save: GameSave, tier: number): boolean {
  if (!stableUnlocked(save)) return false;
  if (!Number.isInteger(tier) || tier <= save.progress.mountTier || tier > MAX_MOUNT_TIER) {
    return false;
  }
  const price = mountPrice(save, tier);
  return save.hero.gold >= price.gold && save.hero.gems >= price.gems;
}

export interface MountPurchase {
  mount: MountDef;
  paid: MountPrice;
  /** null when the hero somehow already held the title */
  titleId: string | null;
}

export function buyMount(save: GameSave, tier: number): MountPurchase {
  if (!stableUnlocked(save)) throw new Error('The Stable is not open yet');
  if (!canBuyMount(save, tier)) throw new Error(`Cannot buy mount tier ${tier}`);
  const mount = getMount(mountForTier(tier)!.id);
  const paid = mountPrice(save, tier);

  save.hero.gold -= paid.gold;
  save.hero.gems -= paid.gems;
  if (paid.gold > 0) bump(save, 'goldSpent', paid.gold);
  save.progress.mountTier = tier;
  bump(save, 'mountsBought');

  // Titles are kept, not swapped: trading up never takes back the day you
  // first managed to afford a mule.
  const titleId = grantTitle(save, mount.titleId) ? mount.titleId : null;
  return { mount, paid, titleId };
}

/** Every tier with its price and whether it is currently reachable — the Stable list. */
export function stableRows(
  save: GameSave,
): { mount: MountDef; price: MountPrice; owned: boolean; affordable: boolean }[] {
  const rows: { mount: MountDef; price: MountPrice; owned: boolean; affordable: boolean }[] = [];
  for (let tier = 1; tier <= MAX_MOUNT_TIER; tier++) {
    const mount = mountForTier(tier);
    if (!mount) continue;
    rows.push({
      mount,
      price: mountPrice(save, tier),
      owned: save.progress.mountTier >= tier,
      affordable: canBuyMount(save, tier),
    });
  }
  return rows;
}
