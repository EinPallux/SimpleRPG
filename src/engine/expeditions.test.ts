import { describe, expect, it } from 'vitest';
import { getSet } from '@/content/sets';
import {
  canStartExpedition,
  chestTier,
  ensureCards,
  expeditionsLeft,
  resolveCard,
  startExpedition,
} from './expeditions';
import { generateSetPiece } from './items';
import { createNewSave, deriveEmblem } from './newSave';
import { Rng, seedState } from './rng';
import type { GameSave } from './types';

const T0 = new Date(2026, 6, 28, 9, 0).getTime();

function fresh(): GameSave {
  const save = createNewSave(
    {
      name: 'Rover',
      classId: 'scout',
      emblem: deriveEmblem('Rover', 'scout'),
      worldSeed: '12'.repeat(16),
    },
    T0,
  );
  save.hero.level = 12;
  save.hero.attrsBought = { str: 40, dex: 300, int: 20, con: 200, lck: 100 };
  return save;
}

describe('expeditions', () => {
  it('embarking costs 25 vigor, respects the daily limit, forbids doubles', () => {
    const save = fresh();
    expect(expeditionsLeft(save)).toBe(2);
    startExpedition(save, 'castaway-cove');
    expect(save.daily.vigor).toBe(75);
    expect(save.daily.expeditions).toBe(1);
    expect(canStartExpedition(save)).toEqual({ ok: false, reason: 'active' });
    save.activities.expedition = null;
    startExpedition(save, 'pinewatch');
    save.activities.expedition = null;
    expect(canStartExpedition(save)).toEqual({ ok: false, reason: 'limit' });
    const broke = fresh();
    broke.daily.vigor = 10;
    expect(canStartExpedition(broke)).toEqual({ ok: false, reason: 'vigor' });
  });

  it('cards persist once rolled, and encounter 3 offers the mini-boss', () => {
    const save = fresh();
    startExpedition(save, 'crystal-ruins');
    const cards = ensureCards(save);
    expect(cards).toHaveLength(3);
    expect(ensureCards(save)).toEqual(cards); // no re-fishing
    save.activities.expedition!.step = 2;
    save.activities.expedition!.cards = null;
    const third = ensureCards(save);
    expect(third[2]).toEqual({ kind: 'miniboss' });
  });

  it('treasure, events and fights resolve with their heroism and payouts', () => {
    const save = fresh();
    startExpedition(save, 'watchmans-rest');
    const exp = save.activities.expedition!;

    exp.cards = [{ kind: 'treasure' }, { kind: 'treasure' }, { kind: 'treasure' }];
    const goldBefore = save.hero.gold;
    let out = resolveCard(save, 0);
    expect(out.heroismGained).toBe(4);
    expect(save.hero.gold).toBeGreaterThan(goldBefore);
    expect(exp.step).toBe(1);
    expect(exp.cards).toBeNull();

    exp.cards = [{ kind: 'event', eventIndex: 0 }, { kind: 'treasure' }, { kind: 'treasure' }];
    out = resolveCard(save, 0, 'bold'); // event 0 bold: xp swing
    expect(out.xp?.gained).toBeGreaterThan(0);
    expect(out.heroismGained).toBe(4);

    exp.cards = [{ kind: 'fight', foe: 'grunt' }, { kind: 'treasure' }, { kind: 'treasure' }];
    out = resolveCard(save, 0);
    expect(out.result).not.toBeNull();
    expect(out.won).toBe(true); // 300 dex scout vs an on-par grunt
    expect(out.heroismGained).toBe(8);
    expect(out.gold).toBeGreaterThan(0);
  });

  it('five picks open the chest, tiered by heroism, and end the run', () => {
    const save = fresh();
    startExpedition(save, 'castaway-cove');
    const exp = save.activities.expedition!;
    let chest = null;
    for (let step = 0; step < 5; step++) {
      exp.cards = [{ kind: 'treasure' }, { kind: 'treasure' }, { kind: 'treasure' }];
      chest = resolveCard(save, 0).chest;
    }
    // 5 × 4 heroism = 20 → Silver on the nose
    expect(chest?.tier).toBe('silver');
    expect(chest?.gold).toBeGreaterThan(0);
    expect(chest?.xp.gained).toBeGreaterThan(0);
    expect(chest?.item).not.toBeNull();
    expect(save.activities.expedition).toBeNull();
    expect(chestTier(19)).toBe('bronze');
    expect(chestTier(35)).toBe('gold');
  });

  it('the Twilight Wanderer set widens the day and salts the heroism', () => {
    const save = fresh();
    const rig = new Rng(seedState('rig', 'twilight'));
    for (const slot of getSet('twilight-wanderer').slots) {
      save.inventory.equipped[slot] = generateSetPiece('twilight-wanderer', slot, rig);
    }
    expect(expeditionsLeft(save)).toBe(3);
    const state = startExpedition(save, 'pinewatch');
    expect(state.heroism).toBe(6);
  });
});
