/**
 * Mount validation (GAME_DESIGN.md §11.2, CONTENT_CATALOG.md §6.4).
 * The load-bearing assertion is the MOUNT_SPEED mirror: the content table
 * restates the engine constant, so this file is what stops the two drifting.
 */
import { describe, expect, it } from 'vitest';
import { MOUNT_SPEED } from '@/engine/constants';
import { hasKey } from '@/i18n';
import { mountSchema as sharedSchema } from './collectibles';
import {
  getMount,
  MAX_MOUNT_TIER,
  MOUNT_TITLE_IDS,
  MOUNTS,
  mountBlurbKey,
  mountForTier,
  mountNameKey,
  mountSchema,
  mountSpeed,
  nextMount,
  upgradeCostGems,
  upgradeCostGold,
} from './mounts';

/** Strict kebab-case: lowercase words joined by single hyphens. */
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('mounts (M7)', () => {
  it('stocks exactly four mounts with unique kebab-case ids', () => {
    expect(MOUNTS).toHaveLength(4);
    const ids = MOUNTS.map((m) => m.id);
    expect(new Set(ids).size).toBe(4);
    for (const id of ids) expect(id).toMatch(KEBAB);
    expect(ids).toEqual(['barley-pack-mule', 'dappled-courser', 'bastion-warhorse', 'ember-drake']);
  });

  it('validates every entry against the shared schema', () => {
    for (const mount of MOUNTS) expect(() => mountSchema.parse(mount)).not.toThrow();
    // the re-export is the one contract from collectibles.ts, not a copy
    expect(mountSchema).toBe(sharedSchema);
  });

  it('rejects malformed entries (schema is strict)', () => {
    expect(() => mountSchema.parse({ ...MOUNTS[0]!, id: 'Barley the Mule' })).toThrow();
    expect(() => mountSchema.parse({ ...MOUNTS[0]!, tier: 0 })).toThrow();
    expect(() => mountSchema.parse({ ...MOUNTS[0]!, tier: 5 })).toThrow();
    expect(() => mountSchema.parse({ ...MOUNTS[0]!, speed: 0 })).toThrow();
    expect(() => mountSchema.parse({ ...MOUNTS[0]!, saddle: 'leather' })).toThrow();
  });

  it('numbers tiers 1..4, unique and ascending in table order', () => {
    expect(MOUNTS.map((m) => m.tier)).toEqual([1, 2, 3, 4]);
    expect(new Set(MOUNTS.map((m) => m.tier)).size).toBe(4);
    expect(MAX_MOUNT_TIER).toBe(4);
    for (let i = 1; i < MOUNTS.length; i++) {
      expect(MOUNTS[i]!.tier).toBeGreaterThan(MOUNTS[i - 1]!.tier);
    }
  });

  it('mirrors MOUNT_SPEED exactly, tier by tier (BALANCING §2)', () => {
    expect(MOUNT_SPEED).toHaveLength(MAX_MOUNT_TIER + 1);
    for (const mount of MOUNTS) expect(mount.speed).toBe(MOUNT_SPEED[mount.tier]);
    expect(MOUNTS.map((m) => m.speed)).toEqual([0.1, 0.2, 0.3, 0.5]);
    // …and the accessor agrees for every tier, on foot included
    for (let tier = 0; tier <= MAX_MOUNT_TIER; tier++) {
      expect(mountSpeed(tier)).toBe(MOUNT_SPEED[tier]);
    }
    expect(mountSpeed(0)).toBe(0);
    expect(mountSpeed(99)).toBe(0);
  });

  it('prices three mounts in gold and exactly one in gems (the Drake at 60)', () => {
    const gold = MOUNTS.filter((m) => m.costGold !== undefined);
    const gems = MOUNTS.filter((m) => m.costGems !== undefined);
    expect(gold).toHaveLength(3);
    expect(gems).toHaveLength(1);
    expect(gems[0]!.id).toBe('ember-drake');
    expect(gems[0]!.costGems).toBe(60);
    expect(gems[0]!.costGold).toBeUndefined();
    // no mount ever charges both currencies
    for (const mount of MOUNTS) {
      expect(mount.costGold !== undefined || mount.costGems !== undefined).toBe(true);
      expect(mount.costGold !== undefined && mount.costGems !== undefined).toBe(false);
    }
  });

  it('quotes the canonical gold ladder, strictly ascending', () => {
    const gold = MOUNTS.filter((m) => m.costGold !== undefined).map((m) => m.costGold!);
    expect(gold).toEqual([5_000, 75_000, 1_200_000]);
    for (let i = 1; i < gold.length; i++) expect(gold[i]!).toBeGreaterThan(gold[i - 1]!);
  });

  it('looks mounts up by id and throws on unknown ones', () => {
    for (const mount of MOUNTS) expect(getMount(mount.id)).toBe(mount);
    expect(getMount('ember-drake').speed).toBe(0.5);
    expect(() => getMount('barley-pack-mule-deluxe')).toThrow(/Unknown mount/);
  });

  it('maps tiers to mounts and treats tier 0 as on foot', () => {
    expect(mountForTier(0)).toBeNull();
    expect(mountForTier(-1)).toBeNull();
    expect(mountForTier(5)).toBeNull();
    for (const mount of MOUNTS) expect(mountForTier(mount.tier)).toBe(mount);
  });

  it('walks the ladder one rung at a time and stops at the Drake', () => {
    expect(nextMount(0)?.id).toBe('barley-pack-mule');
    expect(nextMount(1)?.id).toBe('dappled-courser');
    expect(nextMount(2)?.id).toBe('bastion-warhorse');
    expect(nextMount(3)?.id).toBe('ember-drake');
    expect(nextMount(4)).toBeNull();
  });

  it('charges the difference in gold, never a negative amount', () => {
    expect(upgradeCostGold(0, 1)).toBe(5_000);
    expect(upgradeCostGold(1, 2)).toBe(70_000); // 75,000 − 5,000
    expect(upgradeCostGold(2, 3)).toBe(1_125_000); // 1,200,000 − 75,000
    expect(upgradeCostGold(0, 3)).toBe(1_200_000); // straight to the Warhorse
    expect(upgradeCostGold(1, 3)).toBe(1_195_000);
    // sidegrades and downgrades clamp at zero rather than paying the player back
    for (let from = 0; from <= MAX_MOUNT_TIER; from++) {
      for (let to = 0; to <= MAX_MOUNT_TIER; to++) {
        expect(upgradeCostGold(from, to)).toBeGreaterThanOrEqual(0);
        expect(upgradeCostGems(from, to)).toBeGreaterThanOrEqual(0);
      }
      expect(upgradeCostGold(from, from)).toBe(0);
      expect(upgradeCostGems(from, from)).toBe(0);
    }
    expect(upgradeCostGold(3, 2)).toBe(0);
  });

  it('never crosses the currencies: the Drake costs 60 gems from any tier', () => {
    for (let from = 0; from <= 3; from++) {
      expect(upgradeCostGems(from, 4)).toBe(60);
      expect(upgradeCostGold(from, 4)).toBe(0);
    }
    // …and owning the Drake discounts no horse
    expect(upgradeCostGold(4, 3)).toBe(1_200_000);
    expect(upgradeCostGold(4, 1)).toBe(5_000);
    expect(upgradeCostGems(4, 3)).toBe(0);
    // gold tiers never charge gems at all
    for (let to = 0; to <= 3; to++) expect(upgradeCostGems(0, to)).toBe(0);
  });

  it('rejects tiers the Stable cannot price', () => {
    expect(() => upgradeCostGold(0, 5)).toThrow(/Unknown mount tier/);
    expect(() => upgradeCostGold(-1, 1)).toThrow(/Unknown mount tier/);
    expect(() => upgradeCostGems(1.5, 4)).toThrow(/Unknown mount tier/);
  });

  it('carries four distinct cosmetic titles, one per mount', () => {
    expect(MOUNT_TITLE_IDS).toHaveLength(4);
    expect(new Set(MOUNT_TITLE_IDS).size).toBe(4);
    expect(MOUNT_TITLE_IDS).toEqual(MOUNTS.map((m) => m.titleId));
    for (const id of MOUNT_TITLE_IDS) {
      expect(id).toMatch(KEBAB);
      expect(hasKey(`title.${id}`)).toBe(true);
    }
  });

  it('resolves a name and a blurb for every mount, plus the on-foot state', () => {
    for (const mount of MOUNTS) {
      expect(mount.nameKey).toBe(mountNameKey(mount.id));
      expect(hasKey(mount.nameKey)).toBe(true);
      expect(hasKey(mountBlurbKey(mount.id))).toBe(true);
    }
    expect(hasKey('mount.none.name')).toBe(true);
    expect(hasKey('mount.none.blurb')).toBe(true);
  });

  it('keeps every i18n key distinct — 10 mount strings, no collisions', () => {
    const keys = [
      ...MOUNTS.flatMap((m) => [mountNameKey(m.id), mountBlurbKey(m.id)]),
      'mount.none.name',
      'mount.none.blurb',
    ];
    expect(keys).toHaveLength(10);
    expect(new Set(keys).size).toBe(10);
  });
});
