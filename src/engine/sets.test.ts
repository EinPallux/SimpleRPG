import { describe, expect, it } from 'vitest';
import { getSet } from '@/content/sets';
import { heroToCombatant } from './combatants';
import { generateSetPiece, slotOf } from './items';
import { createNewSave, deriveEmblem } from './newSave';
import { Rng, seedState } from './rng';
import { equippedSets, ownedSetSlots, ownsFullSet, rollSetPiece, setAggregate } from './sets';
import { heroMaxHp, totalAttribute } from './stats';
import type { ClassId, EquipSlot, GameSave } from './types';

const T0 = new Date(2026, 6, 28, 9, 0).getTime();

function fresh(classId: ClassId = 'warrior'): GameSave {
  const save = createNewSave(
    { name: 'Setter', classId, emblem: deriveEmblem('Setter', classId), worldSeed: 'cd'.repeat(16) },
    T0,
  );
  save.hero.level = 25;
  save.hero.attrsBought = { str: 100, dex: 40, int: 10, con: 80, lck: 40 };
  return save;
}

function equipSet(save: GameSave, setId: string, slots?: readonly EquipSlot[]): void {
  const def = getSet(setId);
  const rng = new Rng(seedState('gear-rig', setId));
  for (const slot of slots ?? def.slots) {
    save.inventory.equipped[slot] = generateSetPiece(setId, slot, rng);
  }
}

describe('set aggregation', () => {
  it('counts pieces and gates tiers at 2 / 4 / full', () => {
    const save = fresh();
    equipSet(save, 'bulwark-boar', ['helmet', 'chest']);
    expect(equippedSets(save)).toEqual([{ def: getSet('bulwark-boar'), count: 2 }]);
    let agg = setAggregate(save);
    expect(agg.armorPct).toBeCloseTo(0.1); // 2-pc
    expect(agg.blockPP).toBe(0); // full bonus not yet
    expect(agg.effects).toHaveLength(0);

    equipSet(save, 'bulwark-boar'); // all four
    agg = setAggregate(save);
    expect(agg.blockPP).toBe(5);
    expect(agg.effects).toEqual([{ kind: 'healOnBlock', pctMaxHp: 0.02 }]);
  });

  it('feeds attribute, HP and armor bonuses into the derived hero', () => {
    const save = fresh();
    const strBefore = totalAttribute(save, 'str');
    const hpBefore = heroMaxHp(save);
    const armorBefore = heroToCombatant(save).armor;

    equipSet(save, 'ironroot-sentinel', ['helmet', 'chest']); // 2-pc: +8% STR
    expect(totalAttribute(save, 'str')).toBeGreaterThan(strBefore * 1.05);

    equipSet(save, 'tidebound-scholar', ['gloves', 'boots', 'weapon', 'helmet']); // overwrites → 4-pc: +12% HP
    // (helmet/gloves/boots/weapon are tidebound now; chest still ironroot → its 2pc lapses)
    expect(heroMaxHp(save)).toBeGreaterThan(hpBefore * 1.08);
    expect(heroToCombatant(save).armor).not.toBe(armorBefore); // gear changed underneath

    const bulwark = fresh();
    equipSet(bulwark, 'bulwark-boar', ['helmet', 'chest']);
    const bulwarkArmor = heroToCombatant(bulwark).armor;
    const bare = fresh();
    bare.inventory.equipped = { ...bulwark.inventory.equipped };
    // strip setIds → same pieces, no set bonus
    for (const [slot, item] of Object.entries(bare.inventory.equipped)) {
      if (item) {
        const rest = { ...item };
        delete rest.setId;
        bare.inventory.equipped[slot as EquipSlot] = rest;
      }
    }
    expect(bulwarkArmor).toBeGreaterThan(heroToCombatant(bare).armor);
  });

  it('maps full-set effects onto the combatant flags', () => {
    const scout = fresh('scout');
    equipSet(scout, 'eyes-silent-wood');
    const c = heroToCombatant(scout);
    expect(c.firstStrikeOverride).toBe(true);
    expect(c.firstStrikeDmgMult).toBeCloseTo(0.25);

    const assassin = fresh('assassin');
    equipSet(assassin, 'alleycats-guise');
    expect(heroToCombatant(assassin).strikeMult).toBeCloseTo(0.7); // up from 0.65

    const masque = fresh('assassin');
    equipSet(masque, 'masque-pale-king', ['helmet', 'chest', 'gloves', 'boots']); // 4-pc
    expect(heroToCombatant(masque).critCap).toBeCloseTo(0.65);
  });
});

describe('set piece rolls', () => {
  it('prefers slots the hero does not own, anywhere', () => {
    const save = fresh();
    const rng = new Rng(seedState('roll', 'test'));
    equipSet(save, 'bulwark-boar', ['helmet', 'chest']);
    save.inventory.backpack.push(generateSetPiece('bulwark-boar', 'gloves', rng));
    expect([...ownedSetSlots(save, 'bulwark-boar')].sort()).toEqual(['chest', 'gloves', 'helmet']);
    for (let i = 0; i < 5; i++) {
      expect(slotOf(rollSetPiece(save, 'bulwark-boar', rng))).toBe('boots');
    }
    save.inventory.backpack.push(generateSetPiece('bulwark-boar', 'boots', rng));
    expect(ownsFullSet(save, 'bulwark-boar')).toBe(true);
    // complete → any slot, but still a legal one
    const dupe = rollSetPiece(save, 'bulwark-boar', rng);
    expect(getSet('bulwark-boar').slots).toContain(slotOf(dupe));
    expect(dupe.rarity).toBe('set');
    expect(dupe.ilvl).toBe(20);
  });
});
