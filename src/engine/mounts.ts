/**
 * The Stable (GAME_DESIGN.md §11.2): four mounts, each a RENTAL that shortens
 * every mission for a fortnight.
 *
 * B1 changed the shape here in two ways, both to make the Stable matter:
 *
 *  - **It opens at level 1.** Waiting until L10 locked the one system that
 *    shortens the wait away from exactly the players most likely to be lost to
 *    waiting.
 *  - **Mounts lapse** (the S&F model). A mount used to be a permanent purchase,
 *    which made the Stable a four-line checklist you finished and forgot. A
 *    rental is a standing decision: the Drake is worth 60 gems a fortnight or it
 *    is not, and that question comes back.
 *
 * Because every rental is bought outright, there is no more "pay the difference"
 * upgrade path — `mountPrice` is simply the animal's price. Trading up early
 * just means the remaining days on the old rental are forfeit, which is the
 * player's call to make.
 *
 * **Expiry is evaluated against an injected clock** (invariant 4). Nothing in
 * here reads the wall clock; `activeMountTier(save, nowMs)` is the single truth,
 * and `expireMount` is called from the two places that already hold a timestamp:
 * the offline catch-up and the start of a mission.
 */
import { getMount, MAX_MOUNT_TIER, mountForTier } from '@/content/mounts';
import type { MountDef } from '@/content/mounts';
import { MOUNT_RENTAL_DAYS, MOUNT_SPEED, STABLE_UNLOCK_LEVEL } from './constants';
import { bump } from './ledger';
import { grantTitle } from './rewards';
import type { GameSave } from './types';

export { MAX_MOUNT_TIER, getMount, mountForTier };
export type { MountDef };

export function stableUnlocked(save: GameSave): boolean {
  return save.hero.level >= STABLE_UNLOCK_LEVEL;
}

/** When the current rental lapses, or null for "never" (a pre-B1 purchase). */
export function mountExpiresAt(save: GameSave): number | null {
  const until = save.progress.mountUntil;
  return until ? Date.parse(until) : null;
}

/** The tier actually in force at `nowMs` — 0 once the rental has run out. */
export function activeMountTier(save: GameSave, nowMs: number): number {
  const until = mountExpiresAt(save);
  if (until !== null && nowMs >= until) return 0;
  return save.progress.mountTier;
}

/**
 * Whole days left on the rental (0 when lapsed or on foot).
 *
 * ROUNDED, not ceiled. The UI clock ticks on its own schedule and is typically
 * a few milliseconds behind the timestamp the purchase was stamped with, so a
 * ceil turned a freshly-rented fortnight into "15d left" — the one number the
 * player is guaranteed to check. Rounding reads correctly at both ends, and the
 * clamp keeps a rental that is still live from ever displaying as zero.
 */
export function mountDaysLeft(save: GameSave, nowMs: number): number {
  const until = mountExpiresAt(save);
  if (until === null || save.progress.mountTier === 0) return 0;
  const remaining = until - nowMs;
  if (remaining <= 0) return 0;
  return Math.max(1, Math.round(remaining / 86_400_000));
}

/**
 * Put the hero back on foot if the rental has lapsed. Called from wherever a
 * timestamp is already in hand rather than polled, so the engine stays pure.
 */
export function expireMount(save: GameSave, nowMs: number): boolean {
  if (save.progress.mountTier === 0) return false;
  const until = mountExpiresAt(save);
  if (until === null || nowMs < until) return false;
  save.progress.mountTier = 0;
  save.progress.mountUntil = null;
  return true;
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

/** A rental costs the animal's full price, every time. */
export function mountPrice(_save: GameSave, tier: number): MountPrice {
  const mount = mountForTier(tier);
  return { gold: mount?.costGold ?? 0, gems: mount?.costGems ?? 0 };
}

/**
 * Any tier can be rented at any time — including the one already in the stall,
 * which is how you renew, and a cheaper one, which is how you economise when
 * the Drake stops being worth it. The only gates are the Stable being open and
 * the money being there.
 */
export function canBuyMount(save: GameSave, tier: number): boolean {
  if (!stableUnlocked(save)) return false;
  if (!Number.isInteger(tier) || tier < 1 || tier > MAX_MOUNT_TIER) return false;
  const price = mountPrice(save, tier);
  return save.hero.gold >= price.gold && save.hero.gems >= price.gems;
}

export interface MountPurchase {
  mount: MountDef;
  paid: MountPrice;
  /** null when the hero somehow already held the title */
  titleId: string | null;
  /** when this rental lapses (ISO) */
  until: string;
  /** true when this renewed the animal already in the stall */
  renewed: boolean;
}

/**
 * Rent a mount for `MOUNT_RENTAL_DAYS`.
 *
 * Renewing the same tier EXTENDS from whatever is left rather than restarting,
 * so a player who tops up early is not punished for it. Switching tiers starts
 * a clean rental — the old animal has gone back to Wilbur either way.
 */
export function buyMount(save: GameSave, tier: number, nowMs: number): MountPurchase {
  if (!stableUnlocked(save)) throw new Error('The Stable is not open yet');
  if (!canBuyMount(save, tier)) throw new Error(`Cannot buy mount tier ${tier}`);
  const mount = getMount(mountForTier(tier)!.id);
  const paid = mountPrice(save, tier);

  save.hero.gold -= paid.gold;
  save.hero.gems -= paid.gems;
  if (paid.gold > 0) bump(save, 'goldSpent', paid.gold);

  const renewed = save.progress.mountTier === tier;
  const remaining = renewed ? Math.max(0, (mountExpiresAt(save) ?? nowMs) - nowMs) : 0;
  const until = nowMs + remaining + MOUNT_RENTAL_DAYS * 86_400_000;

  save.progress.mountTier = tier;
  save.progress.mountUntil = new Date(until).toISOString();
  bump(save, 'mountsBought');

  // Titles are kept, not swapped: a lapsed rental never takes back the day you
  // first managed to afford a mule.
  const titleId = grantTitle(save, mount.titleId) ? mount.titleId : null;
  return { mount, paid, titleId, until: save.progress.mountUntil, renewed };
}

export interface StableRow {
  mount: MountDef;
  price: MountPrice;
  /** currently in the stall */
  active: boolean;
  affordable: boolean;
  /** whole days left, when this is the active rental */
  daysLeft: number;
}

/** Every tier with its rental price and standing — the Stable list. */
export function stableRows(save: GameSave, nowMs: number): StableRow[] {
  const inStall = activeMountTier(save, nowMs);
  const rows: StableRow[] = [];
  for (let tier = 1; tier <= MAX_MOUNT_TIER; tier++) {
    const mount = mountForTier(tier);
    if (!mount) continue;
    rows.push({
      mount,
      price: mountPrice(save, tier),
      active: inStall === tier,
      affordable: canBuyMount(save, tier),
      daysLeft: inStall === tier ? mountDaysLeft(save, nowMs) : 0,
    });
  }
  return rows;
}
