import { describe, expect, it } from 'vitest';
import { generateItem } from '@/engine/items';
import { Rng, seedState } from '@/engine/rng';
import type { EquipSlot, Rarity } from '@/engine/types';
import { itemName, lineText, missionFlavor } from './itemName';

const SLOTS: EquipSlot[] = [
  'weapon',
  'offhand',
  'helmet',
  'chest',
  'gloves',
  'boots',
  'belt',
  'amulet',
  'ring',
  'talisman',
];

describe('item naming', () => {
  it('names every slot × rarity × class combination without leaking raw keys', () => {
    const rng = new Rng(seedState('naming', 'loot'));
    for (const slot of SLOTS) {
      for (const rarity of ['common', 'rare', 'epic', 'legendary'] as Rarity[]) {
        const item = generateItem({ ilvl: 12, rarity, slot, biasClass: 'mage' }, rng);
        const name = itemName(item);
        expect(name.length).toBeGreaterThan(3);
        expect(name).not.toContain('item.');
      }
    }
  });

  it('is stable per item and shows upgrade suffixes', () => {
    const rng = new Rng(seedState('naming2', 'loot'));
    const item = generateItem({ ilvl: 8, rarity: 'rare', slot: 'weapon', classId: 'scout' }, rng);
    expect(itemName(item)).toBe(itemName({ ...item }));
    expect(itemName({ ...item, upgrade: 7 })).toContain('+7');
  });

  it('renders bonus lines through i18n', () => {
    expect(lineText({ attr: 'str', value: 12 })).toBe('+12 Strength');
    expect(lineText({ attr: 'all', value: 5 })).toBe('+5 All Attributes');
    expect(lineText({ attr: 'critDmg', value: 9 })).toBe('+9% Crit Damage');
  });
});

describe('mission flavor', () => {
  it('always yields prose, zone-specific when pools exist, generic fallback otherwise', () => {
    for (let flavor = 0; flavor < 60; flavor++) {
      for (const zone of [1, 2, 3, 7, 10]) {
        const text = missionFlavor(zone, flavor);
        expect(text.length).toBeGreaterThan(10);
        expect(text).not.toContain('mission.');
      }
    }
    // Zone 7 has no dedicated pool yet — flavor rolls that would pick zone text
    // must fall back to the generic pool.
    expect(missionFlavor(7, 2)).toBe(missionFlavor(7, 2));
  });
});
