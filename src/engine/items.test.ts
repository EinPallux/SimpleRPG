import { describe, expect, it } from 'vitest';
import {
  dismantleYield,
  effectiveItemChance,
  generateItem,
  itemArmor,
  rollDrop,
  sellPrice,
  shopPrice,
  slotOf,
  weaponDamage,
} from './items';
import { Rng, seedState } from './rng';
import type { Rarity } from './types';

const rng = () => new Rng(seedState('item-tests', 'loot'));

describe('item generation', () => {
  it('is deterministic for a given stream state', () => {
    const a = generateItem({ ilvl: 20, rarity: 'epic', biasClass: 'warrior' }, rng());
    const b = generateItem({ ilvl: 20, rarity: 'epic', biasClass: 'warrior' }, rng());
    expect(a).toEqual(b);
  });

  it('respects rarity line counts and never duplicates a line type', () => {
    const r = rng();
    for (const [rarity, expected] of [
      ['common', 0],
      ['uncommon', 1],
      ['rare', 2],
      ['epic', 3],
    ] as [Rarity, number][]) {
      for (let i = 0; i < 50; i++) {
        const item = generateItem({ ilvl: 30, rarity, slot: 'chest' }, r);
        expect(item.lines).toHaveLength(expected);
        expect(new Set(item.lines.map((l) => l.attr)).size).toBe(item.lines.length);
      }
    }
  });

  it('jewelry trades armor for an extra bonus line', () => {
    const r = rng();
    const ring = generateItem({ ilvl: 30, rarity: 'rare', slot: 'ring' }, r);
    expect(ring.lines).toHaveLength(3); // 2 + jewelry bonus
    expect(itemArmor(ring)).toBe(0);
    expect(ring.classId).toBeNull();
  });

  it('derives weapon damage / armor / prices from the published formulas', () => {
    const r = rng();
    const weapon = generateItem(
      { ilvl: 20, rarity: 'common', slot: 'weapon', classId: 'warrior' },
      r,
    );
    const dmg = weaponDamage(weapon);
    expect(dmg.min).toBe(Math.round((3 + 2.2 * 20) * 0.85));
    expect(dmg.max).toBe(Math.round((3 + 2.2 * 20) * 1.15));

    const chest = generateItem(
      { ilvl: 20, rarity: 'common', slot: 'chest', classId: 'warrior' },
      r,
    );
    expect(itemArmor(chest)).toBe(Math.round(1.0 * 2.6 * 20 * 1.5)); // slot 1.0 × warrior 1.5

    expect(shopPrice(chest)).toBe(Math.round(Math.pow(20, 1.75) * 1 * 2.2));
    expect(sellPrice(chest)).toBe(Math.round(Math.pow(20, 1.75) * 1 * 0.2));
    expect(slotOf(chest)).toBe('chest');
  });

  it('upgrades add +2.5% per level', () => {
    const r = rng();
    const item = generateItem({ ilvl: 40, rarity: 'rare', slot: 'weapon', classId: 'scout' }, r);
    const base = weaponDamage(item).max;
    const upgraded = { ...item, upgrade: 20 };
    expect(weaponDamage(upgraded).max).toBeGreaterThan(base * 1.45);
    expect(weaponDamage(upgraded).max).toBeLessThan(base * 1.55);
  });

  it('dismantle yields follow the rarity table', () => {
    const r = rng();
    const epic = generateItem({ ilvl: 10, rarity: 'epic', slot: 'boots', classId: 'mage' }, r);
    expect(dismantleYield(epic)).toEqual({ scraps: 8, dust: 1 });
  });
});

describe('drops', () => {
  it('mission drops follow the §5.3 weights (10k rolls, ±2 pp)', () => {
    const r = rng();
    const counts: Record<string, number> = {};
    for (let i = 0; i < 10_000; i++) {
      const item = rollDrop('mission', 30, 'scout', r);
      counts[item.rarity] = (counts[item.rarity] ?? 0) + 1;
      expect(item.ilvl).toBeGreaterThanOrEqual(28);
      expect(item.ilvl).toBeLessThanOrEqual(32);
    }
    expect((counts.common ?? 0) / 10_000).toBeCloseTo(0.52, 1);
    expect((counts.epic ?? 0) / 10_000).toBeCloseTo(0.055, 1);
    expect(counts.set ?? 0).toBe(0); // sets never drop from generic tables
  });

  it("luck's item-chance nudge is small and capped", () => {
    expect(effectiveItemChance(0, 10)).toBeCloseTo(0.33, 5);
    expect(effectiveItemChance(100, 10)).toBeGreaterThan(0.33);
    expect(effectiveItemChance(1_000_000, 10)).toBeLessThanOrEqual(0.45);
  });
});
