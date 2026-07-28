import { describe, expect, it } from 'vitest';
import { WHEEL_SLOTS } from '@/content/wheel';
import { createNewSave, deriveEmblem } from './newSave';
import type { GameSave } from './types';
import { canSpinWheel, spinWheel, wheelSpinCost, wheelSpinsLeft } from './wheel';

const T0 = new Date(2026, 6, 28, 9, 0).getTime();

function fresh(seed = '34'.repeat(16)): GameSave {
  const save = createNewSave(
    { name: 'Spinner', classId: 'mage', emblem: deriveEmblem('Spinner', 'mage'), worldSeed: seed },
    T0,
  );
  save.hero.level = 10;
  save.hero.gold = 100_000;
  return save;
}

describe('wheel of destiny', () => {
  it('five spins a day: the first free, the rest on a rising tab', () => {
    const save = fresh();
    expect(wheelSpinsLeft(save)).toBe(5);
    expect(wheelSpinCost(save)).toBe(0);
    const costs: number[] = [];
    for (let i = 0; i < 5; i++) {
      costs.push(wheelSpinCost(save)!);
      spinWheel(save);
    }
    expect(costs[0]).toBe(0);
    for (let i = 2; i < 5; i++) expect(costs[i]!).toBeGreaterThan(costs[i - 1]!);
    expect(wheelSpinsLeft(save)).toBe(0);
    expect(wheelSpinCost(save)).toBeNull();
    expect(canSpinWheel(save)).toBe(false);
    expect(() => spinWheel(save)).toThrow(/No spins left/);
  });

  it('every outcome pays what its slot says (and the ledger balances)', () => {
    const save = fresh();
    for (let i = 0; i < 5; i++) {
      const before = {
        gold: save.hero.gold,
        scraps: save.hero.scraps,
        treats: save.hero.treats,
        dust: save.hero.dust,
        gems: save.hero.gems,
        bag: save.inventory.backpack.length,
      };
      const out = spinWheel(save);
      expect(WHEEL_SLOTS[out.slotIndex]!.kind).toBe(out.kind);
      expect(out.kind).not.toBe('mystery'); // mystery always resolves onward
      expect(save.hero.gold).toBe(before.gold - out.cost + out.gold + out.autoSoldGold);
      expect(save.hero.scraps).toBe(before.scraps + out.scraps);
      expect(save.hero.treats).toBe(before.treats + out.treats);
      expect(save.hero.dust).toBe(before.dust + out.dust);
      expect(save.hero.gems).toBe(before.gems + out.gems);
      if (out.items.length > 0 && out.autoSoldGold === 0) {
        expect(save.inventory.backpack.length).toBe(before.bag + out.items.length);
      }
      if (out.kind === 'salute') {
        expect(out.gold + out.scraps + out.treats + out.dust + out.gems).toBe(0);
        expect(out.items).toHaveLength(0);
      }
    }
  });

  it('is stream-persisted: identical saves spin identical fortunes', () => {
    const a = fresh();
    const b = fresh();
    for (let i = 0; i < 5; i++) {
      const outA = spinWheel(a);
      const outB = spinWheel(b);
      expect(outA).toEqual(outB);
    }
    // …and a different world spins a different story, eventually.
    const c = fresh('56'.repeat(16));
    const kindsA: string[] = [];
    const kindsC: string[] = [];
    const a2 = fresh();
    for (let i = 0; i < 5; i++) {
      kindsA.push(spinWheel(a2).kind);
      kindsC.push(spinWheel(c).kind);
    }
    expect(kindsA.join()).not.toBe(kindsC.join());
  });
});
