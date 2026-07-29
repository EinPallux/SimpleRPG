import { describe, expect, it } from 'vitest';
import { allMinibossSlugs } from '@/content/expeditions';
import { getSet } from '@/content/sets';
import {
  canStartExpedition,
  chestTier,
  ensureCards,
  expeditionMiniboss,
  expeditionsLeft,
  resolveCard,
  startExpedition,
} from './expeditions';
import { generateSetPiece } from './items';
import { createNewSave, deriveEmblem } from './newSave';
import { Rng, seedState } from './rng';
import type { GameSave } from './types';

const T0 = new Date(2026, 6, 28, 9, 0).getTime();

function fresh(worldSeed = '12'.repeat(16)): GameSave {
  // The seed has to go in HERE: `createNewSave` pre-seeds every stream from it,
  // so assigning `save.worldSeed` afterwards changes nothing and every "different
  // world" would replay the same rolls.
  const save = createNewSave(
    {
      name: 'Rover',
      classId: 'scout',
      emblem: deriveEmblem('Rover', 'scout'),
      worldSeed,
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

describe('mini-boss reserves (CONTENT §5)', () => {
  const roster = new Set(allMinibossSlugs());

  it('draws a real mini-boss every run, and not always the locale regular', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const save = fresh(i.toString(16).padStart(32, '0'));
      const state = startExpedition(save, 'castaway-cove');
      const slug = expeditionMiniboss(state);
      expect(roster.has(slug)).toBe(true);
      seen.add(slug);
    }
    // The Cove's own Captain Flotsam still turns up most, but he is not the only
    // face the Cove has — that is the whole point of the reserves.
    expect(seen.has('captain-flotsam')).toBe(true);
    expect(seen.size).toBeGreaterThan(2);
  });

  it('holds the same face for the whole run — encounter 3 cannot swap mid-expedition', () => {
    const save = fresh();
    const state = startExpedition(save, 'crystal-ruins');
    const first = expeditionMiniboss(state);
    ensureCards(save);
    resolveCard(save, 0);
    expect(expeditionMiniboss(save.activities.expedition!)).toBe(first);
  });

  it('an expedition already in flight before M9 falls back to the locale regular', () => {
    // `minibossSlug` is optional precisely so a v7 save mid-run keeps working.
    const save = fresh();
    const state = startExpedition(save, 'watchmans-rest');
    delete state.minibossSlug;
    expect(expeditionMiniboss(state)).toBe('sergeant-nap');
  });
});
