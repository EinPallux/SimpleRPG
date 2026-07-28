/**
 * Mounts (GAME_DESIGN.md §11.2, CONTENT_CATALOG.md §6.4): the Stable's four
 * animals, unlocked at L10. A mount does exactly one thing — it shortens every
 * mission by a flat fraction — so the whole system is a four-row price ladder
 * and a single number the engine multiplies into mission duration.
 *
 * Tier 1..4 mirrors `MOUNT_SPEED` in `engine/constants.ts` ([0, .1, .2, .3, .5],
 * index = tier, tier 0 = on foot). The speeds are restated here as data so the
 * content layer stays free of engine imports; `mounts.test.ts` pins the two
 * lists together, so a change to one without the other fails CI.
 *
 * The ladder is deliberately lopsided: tiers 1–3 are a gold sink that tracks
 * the early/mid economy (5k → 75k → 1.2M), and tier 4 is the Ember Drake at
 * **60 gems** — the first real gem decision in the game, played off against the
 * Wishing Well (BALANCING §6/§7, sim scenario `gem-strategies`). Gems are never
 * sold for money (invariant 1); they are earned, so the choice has to sting.
 *
 * Each mount also carries a tiny cosmetic title (§11.2). The ids live in
 * `MOUNT_TITLE_IDS` and are registered in `content/titles.ts`.
 *
 * i18n: `mount.{id}.name` + `mount.{id}.blurb` (Wilbur Hay runs the Stable),
 * plus `mount.none.*` for the on-foot state.
 */
import type { MountDef } from './collectibles';
import { mountSchema } from './collectibles';

export type { MountDef };
/** The one contract, re-exported so consumers never reach past this module. */
export { mountSchema };

/** Highest mount tier at v1.0 — tier 0 means "on foot". */
export const MAX_MOUNT_TIER = 4;

/**
 * The four mounts, cheapest first. `speed` is the fraction shaved off mission
 * duration, NOT a multiplier: the Drake's 0.5 means a mission takes half as
 * long. Nothing else about a mount is mechanical — no stats, no combat.
 */
export const MOUNTS: readonly MountDef[] = [
  {
    id: 'barley-pack-mule',
    tier: 1,
    speed: 0.1,
    costGold: 5_000,
    titleId: 'the-well-saddled',
    nameKey: 'mount.barley-pack-mule.name',
  },
  {
    id: 'dappled-courser',
    tier: 2,
    speed: 0.2,
    costGold: 75_000,
    titleId: 'the-punctual',
    nameKey: 'mount.dappled-courser.name',
  },
  {
    id: 'bastion-warhorse',
    tier: 3,
    speed: 0.3,
    costGold: 1_200_000,
    titleId: 'the-heavily-horsed',
    nameKey: 'mount.bastion-warhorse.name',
  },
  {
    id: 'ember-drake',
    tier: 4,
    speed: 0.5,
    costGems: 60,
    titleId: 'the-uninsurable',
    nameKey: 'mount.ember-drake.name',
  },
];

/** The cosmetic titles the Stable hands out, in tier order (§11.2). */
export const MOUNT_TITLE_IDS: readonly string[] = MOUNTS.map((m) => m.titleId);

export function getMount(id: string): MountDef {
  const def = MOUNTS.find((m) => m.id === id);
  if (!def) throw new Error(`Unknown mount: ${id}`);
  return def;
}

/**
 * The mount at a tier, or `null` for tier 0 (on foot) — and for any tier the
 * Stable does not stock, so a save from a future version degrades to walking
 * instead of crashing the character panel.
 */
export function mountForTier(tier: number): MountDef | null {
  return MOUNTS.find((m) => m.tier === tier) ?? null;
}

/** Mission-duration reduction as a fraction; 0 when on foot or unknown. */
export function mountSpeed(tier: number): number {
  return mountForTier(tier)?.speed ?? 0;
}

/** The next rung of the ladder, or `null` once the Drake is in the stall. */
export function nextMount(currentTier: number): MountDef | null {
  return mountForTier(currentTier + 1);
}

/** i18n key helpers — `mount.none.*` covers the on-foot state. */
export function mountNameKey(id: string): string {
  return `mount.${id}.name`;
}
export function mountBlurbKey(id: string): string {
  return `mount.${id}.blurb`;
}

function assertTier(tier: number): void {
  if (!Number.isInteger(tier) || tier < 0 || tier > MAX_MOUNT_TIER) {
    throw new Error(`Unknown mount tier: ${tier}`);
  }
}

/**
 * Upgrading pays the DIFFERENCE (§11.2) — but only *within one currency*.
 *
 * Tiers 1–3 are gold-only and tier 4 is gems-only, so the two ladders never
 * discount each other: buying the Drake costs its full 60 gems no matter how
 * much gold is already tied up in the Warhorse, and buying a horse costs full
 * gold even if the Drake is in the stall. The rule is simply
 * `max(0, price(to) − price(from))` evaluated per currency, with a missing
 * price counting as 0. That clamp also makes a sidegrade or a downgrade free
 * rather than negative — the Stable will not buy an animal back.
 */
export function upgradeCostGold(fromTier: number, toTier: number): number {
  return currencyDelta(fromTier, toTier, 'costGold');
}

/** Gem half of {@link upgradeCostGold}; only the Ember Drake charges gems. */
export function upgradeCostGems(fromTier: number, toTier: number): number {
  return currencyDelta(fromTier, toTier, 'costGems');
}

function currencyDelta(
  fromTier: number,
  toTier: number,
  currency: 'costGold' | 'costGems',
): number {
  assertTier(fromTier);
  assertTier(toTier);
  const target = mountForTier(toTier);
  const price = target?.[currency] ?? 0;
  if (price === 0) return 0; // the target does not charge in this currency
  const paid = mountForTier(fromTier)?.[currency] ?? 0;
  return Math.max(0, price - paid);
}
