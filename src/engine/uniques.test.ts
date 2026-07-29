/**
 * The eight named legendaries (CONTENT_CATALOG.md §6.2).
 *
 * Two things here are contracts rather than implementation details, and both
 * were broken before M9: the achievement that promises "all 8" must count the
 * NAMED eight and not any legendary-rarity drop, and a drop must never hand
 * over one the hero already has — otherwise "all eight" is a lottery you can
 * lose to duplicates rather than a goal.
 */
import { describe, expect, it } from 'vitest';
import {
  UNIQUES,
  UNIQUE_COUNT,
  uniqueBlurbKey,
  uniqueNameKey,
  uniqueSchema,
  availableUniques,
} from '@/content/uniques';
import { hasKey } from '@/i18n';
import { generateUnique } from './items';
import { metricValue } from './metrics';
import { createNewSave, deriveEmblem } from './newSave';
import { Rng, seedState } from './rng';
import type { ClassId, GameSave } from './types';
import {
  ownedUniqueIds,
  ownsAllUniques,
  rollUnique,
  uniqueFlatAttributes,
  uniqueTotal,
} from './uniques';
import { heroShopPrice } from './shops';
import { generateItem, shopPrice } from './items';
import { totalAttribute } from './stats';
import { heroToCombatant } from './combatants';

const T0 = new Date(2026, 6, 28, 9, 0).getTime();

function hero(level = 40, classId: ClassId = 'warrior'): GameSave {
  const save = createNewSave(
    { name: 'Named', classId, emblem: deriveEmblem('Named', classId), worldSeed: 'c'.repeat(32) },
    T0,
  );
  save.hero.level = level;
  return save;
}

function rng(tag: string): Rng {
  return new Rng(seedState('uniques-test', tag));
}

describe('the content', () => {
  it('is exactly eight, uniquely identified, and fully written', () => {
    expect(UNIQUE_COUNT).toBe(8);
    expect(new Set(UNIQUES.map((u) => u.id)).size).toBe(8);
    for (const def of UNIQUES) {
      expect(() => uniqueSchema.parse(def)).not.toThrow();
      expect(hasKey(uniqueNameKey(def.id))).toBe(true);
      expect(hasKey(uniqueBlurbKey(def.id))).toBe(true);
    }
  });

  it('offers all eight to every class, so "all eight" is finishable', () => {
    // The bug this pins: the pool used to be filtered by class, and only five
    // uniques are classless. A warrior could reach six, a scout — who has no
    // unique cut for them at all — five, and the `named-things` achievement
    // asks for eight. Nobody could ever finish it.
    for (const classId of ['warrior', 'scout', 'mage', 'assassin'] as const) {
      const save = hero(99, classId);
      const seen = new Set<string>();
      for (let i = 0; i < 400; i++) {
        const id = rollUnique(save, rng(`${classId}-${i}`));
        if (id) seen.add(id);
      }
      expect(seen.size, `${classId} can be offered all ${UNIQUE_COUNT}`).toBe(UNIQUE_COUNT);
    }
  });
});

describe('the drop path', () => {
  it('never re-offers one already held, so eight is reachable', () => {
    const save = hero(99);
    const all = availableUniques(99).map((u) => u.id);

    // Hand over every one that is unlocked at this level.
    for (const id of all) {
      save.inventory.backpack.push(generateUnique(id, 60, rng(id)));
    }
    expect(ownedUniqueIds(save).size).toBe(all.length);

    // With nothing left to give, the roll declines rather than duplicating —
    // the caller then falls through to a generated legendary.
    for (let i = 0; i < 50; i++) {
      expect(rollUnique(save, rng(`decline-${i}`))).toBeNull();
    }
  });

  it('only ever names something the hero does not have', () => {
    const save = hero();
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const id = rollUnique(save, rng(`roll-${i}`));
      if (id) seen.add(id);
    }
    // Everything it offered is a real unique unlocked at this level…
    const open = new Set(availableUniques(40).map((u) => u.id));
    for (const id of seen) expect(open.has(id)).toBe(true);
    // …and over 200 rolls it does actually offer something.
    expect(seen.size).toBeGreaterThan(0);
  });

  it('generates a real legendary that carries its name', () => {
    const item = generateUnique('grandmas-battle-ladle', 60, rng('gen'));
    expect(item.uniqueId).toBe('grandmas-battle-ladle');
    expect(item.rarity).toBe('legendary');
    expect(item.classId).toBe('warrior');
    // The bespoke effect is a bonus ON TOP — it still rolls normal stat lines.
    expect(item.lines.length).toBeGreaterThan(0);
  });

  it('rolls at the level it replaced, so a unique is never a downgrade', () => {
    // The bug this pins: `minLevel` used to be the item level, so at level 120
    // the Ladle dropped as an ilvl-40 weapon — a "legendary" strictly worse than
    // the generated one it displaced, and worst for whoever rolled that row most.
    const ladle = generateUnique('grandmas-battle-ladle', 120, rng('deep'));
    const plain = generateItem({ ilvl: 120, rarity: 'legendary', slot: 'weapon' }, rng('deep'));
    expect(ladle.ilvl).toBe(120);
    expect(ladle.ilvl).toBeGreaterThanOrEqual(plain.ilvl);

    // …and `minLevel` is still a floor, so a low-level source cannot hand over a
    // piece weaker than the one the gate promised.
    expect(generateUnique('crown-of-the-understudy', 5, rng('early')).ilvl).toBe(55);
  });

  it('gates on minLevel, so the eight arrive across the climb', () => {
    const early = hero(30);
    const late = hero(80);
    const offered = (save: GameSave) => {
      const seen = new Set<string>();
      for (let i = 0; i < 300; i++) {
        const id = rollUnique(save, rng(`gate-${i}`));
        if (id) seen.add(id);
      }
      return seen;
    };
    // Only the Kettle (minLevel 30) is open at level 30.
    expect([...offered(early)]).toEqual(['kettle-of-endless-soup']);
    // By 80 every one of the eight is live.
    expect(offered(late).size).toBe(availableUniques(80).length);
  });
});

describe('the achievement tells the truth', () => {
  it('counts the NAMED eight, not any legendary-rarity drop', () => {
    const save = hero();
    // Three generic legendaries: impressive, but not the eight.
    for (let i = 0; i < 3; i++) {
      save.inventory.backpack.push(
        generateItem({ ilvl: 40, rarity: 'legendary' }, rng(`generic-${i}`)),
      );
    }
    expect(metricValue(save, 'legendariesOwned')).toBe(3);
    expect(metricValue(save, 'uniquesOwned')).toBe(0);

    save.inventory.backpack.push(generateUnique('gilded-iou', 60, rng('iou')));
    expect(metricValue(save, 'uniquesOwned')).toBe(1);
  });

  it('counts DISTINCT uniques — two Ladles are not two eighths', () => {
    const save = hero();
    save.inventory.backpack.push(generateUnique('gilded-iou', 60, rng('a')));
    save.inventory.backpack.push(generateUnique('gilded-iou', 60, rng('b')));
    expect(metricValue(save, 'uniquesOwned')).toBe(1);
    expect(ownsAllUniques(save)).toBe(false);
  });
});

describe('the effects actually reach the pipeline', () => {
  it('the Gilded IOU discounts the till', () => {
    const bare = hero();
    const item = generateItem({ ilvl: 30, rarity: 'rare', slot: 'chest' }, rng('shop'));
    const list = shopPrice(item);
    expect(heroShopPrice(bare, item)).toBe(list);

    const withIou = hero();
    withIou.inventory.equipped.amulet = generateUnique('gilded-iou', 60, rng('iou'));
    expect(heroShopPrice(withIou, item)).toBeLessThan(list);
    expect(uniqueTotal(withIou, 'shopDiscount')).toBeCloseTo(0.15, 5);
  });

  it('the Crown scales with HERO level, so it never retires', () => {
    const low = hero(20);
    const high = hero(80);
    const crown = () => generateUnique('crown-of-the-understudy', 60, rng('crown'));

    expect(uniqueFlatAttributes(low)).toBe(0);
    low.inventory.equipped.helmet = crown();
    high.inventory.equipped.helmet = crown();

    // +1 per 10 levels: 2 at L20, 8 at L80.
    expect(uniqueFlatAttributes(low)).toBe(2);
    expect(uniqueFlatAttributes(high)).toBe(8);
  });

  it('the Boots raise evade, and the Ladle reflects', () => {
    const bare = hero();
    const baseEvade = heroToCombatant(bare).evadeChance;

    const booted = hero();
    booted.inventory.equipped.boots = generateUnique('boots-of-somewhere-else', 60, rng('boots'));
    expect(heroToCombatant(booted).evadeChance).toBeGreaterThan(baseEvade);

    const armed = hero();
    expect(heroToCombatant(armed).reflectOnBlockPct ?? 0).toBe(0);
    armed.inventory.equipped.weapon = generateUnique('grandmas-battle-ladle', 60, rng('ladle'));
    expect(heroToCombatant(armed).reflectOnBlockPct).toBeCloseTo(0.08, 5);
  });

  it('a bagged unique does nothing — equipping is the point', () => {
    const save = hero();
    const before = totalAttribute(save, 'str');
    save.inventory.backpack.push(generateUnique('crown-of-the-understudy', 60, rng('bag')));
    expect(totalAttribute(save, 'str')).toBe(before);
    expect(uniqueFlatAttributes(save)).toBe(0);
  });
});
