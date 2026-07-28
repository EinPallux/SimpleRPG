import { describe, expect, it } from 'vitest';
import { getStream, initialRngState, Rng, seedState, type RngState } from './rng';

describe('seeded rng streams', () => {
  it('is deterministic: same seed → same sequence, every time', () => {
    const a = new Rng(seedState('world-1', 'loot'));
    const b = new Rng(seedState('world-1', 'loot'));
    const seqA = Array.from({ length: 50 }, () => a.nextUint32());
    const seqB = Array.from({ length: 50 }, () => b.nextUint32());
    expect(seqA).toEqual(seqB);
  });

  it('streams are independent of each other', () => {
    const loot = new Rng(seedState('world-1', 'loot'));
    const combat = new Rng(seedState('world-1', 'combat'));
    expect(Array.from({ length: 10 }, () => loot.nextUint32())).not.toEqual(
      Array.from({ length: 10 }, () => combat.nextUint32()),
    );
  });

  it('serialized state resumes mid-sequence (save-scum resistance)', () => {
    const state = seedState('world-2', 'gacha');
    const rng = new Rng(state);
    rng.nextUint32();
    rng.nextUint32();
    const snapshot = [...state] as RngState; // as persisted in a save
    const expected = new Rng([...snapshot] as RngState).nextUint32();
    expect(rng.nextUint32()).toBe(expected);
  });

  it('produces sane uniform helpers', () => {
    const rng = new Rng(seedState('world-3', 'wheel'));
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
    const rng2 = new Rng(seedState('world-3', 'missions'));
    let heads = 0;
    for (let i = 0; i < 10_000; i++) if (rng2.chance(0.3)) heads++;
    expect(heads / 10_000).toBeGreaterThan(0.27);
    expect(heads / 10_000).toBeLessThan(0.33);
  });

  it('weighted picks follow their weights roughly', () => {
    const rng = new Rng(seedState('world-4', 'loot'));
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 10_000; i++) {
      counts[
        rng.weighted([
          ['a', 90],
          ['b', 10],
        ] as const)
      ]++;
    }
    expect(counts.a / 10_000).toBeGreaterThan(0.87);
    expect(counts.b).toBeGreaterThan(0);
  });

  it('getStream lazy-initializes missing streams and mutates the bag in place', () => {
    const bag: Parameters<typeof getStream>[0] = {};
    const rng = getStream(bag, 'world-5', 'combat');
    expect(bag.combat).toBeDefined();
    const before = [...bag.combat!];
    rng.nextUint32();
    expect(bag.combat).not.toEqual(before); // state advanced in the bag itself
  });

  it('initialRngState covers every stream', () => {
    const bag = initialRngState('world-6');
    expect(Object.keys(bag).sort()).toEqual(
      ['botworld', 'combat', 'cosmetic', 'gacha', 'loot', 'missions', 'wheel'].sort(),
    );
  });
});
