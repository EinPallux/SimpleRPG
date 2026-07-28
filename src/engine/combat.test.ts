import { describe, expect, it } from 'vitest';
import { simulateCombat, type Combatant } from './combat';
import { archetypeCombatant, classSignature, heroToCombatant } from './combatants';
import { createNewSave, deriveEmblem } from './newSave';
import { Rng, seedState, type RngState } from './rng';

const SEED: RngState = [111, 222, 333, 444];

/** The BALANCING §3.3 fixture pair, hand-built to the documented numbers. */
function fixtureWarrior(): Combatant {
  return {
    id: 'w',
    name: 'Fixture Warrior',
    level: 20,
    mainAttr: 'str',
    attrs: { str: 80, dex: 40, int: 30, con: 60, lck: 30 },
    maxHp: 6300,
    armor: 350,
    weapon: { min: 40, max: 56 },
    blockChance: 0.25,
    evadeChance: 0,
    unblockable: false,
    strikes: 1,
    strikeMult: 1,
    dmgMult: 1,
    critCap: 0.5,
    critMult: 2,
  };
}

function fixtureGrunt(): Combatant {
  return {
    id: 'g',
    name: 'Fixture Grunt',
    level: 20,
    mainAttr: 'dex',
    attrs: { str: 40, dex: 70, int: 25, con: 50, lck: 20 },
    maxHp: 4150,
    armor: 200,
    weapon: { min: 34, max: 46 },
    blockChance: 0,
    evadeChance: 0,
    unblockable: false,
    strikes: 1,
    strikeMult: 1,
    dmgMult: 1,
    critCap: 0.5,
    critMult: 2,
  };
}

describe('simulateCombat', () => {
  it('is fully deterministic for a given seed', () => {
    const a = simulateCombat(fixtureWarrior(), fixtureGrunt(), SEED);
    const b = simulateCombat(fixtureWarrior(), fixtureGrunt(), SEED);
    expect(a).toEqual(b);
    expect(a.rounds.length).toBeGreaterThan(0);
  });

  it('does not mutate the caller-provided seed', () => {
    const seed: RngState = [1, 2, 3, 4];
    simulateCombat(fixtureWarrior(), fixtureGrunt(), seed);
    expect(seed).toEqual([1, 2, 3, 4]);
  });

  it('BALANCING §3.3 fixture: round-1 non-crit hit averages ≈252 (±3%)', () => {
    // avg weapon 48 × mult 7.0 (effMain 80−20=60) × rage 1.0 × (1−DR .25) = 252
    const rig = new Rng(seedState('avg-check', 'combat'));
    let sum = 0;
    let count = 0;
    for (let i = 0; i < 4000; i++) {
      const result = simulateCombat(fixtureWarrior(), fixtureGrunt(), rig.deriveSeed());
      const first = result.rounds[0]!.events.find(
        (e) => e.attacker === (result.firstStriker === 0 ? 0 : 1) && e.outcome === 'hit',
      );
      const warriorHit = result.rounds[0]!.events.find(
        (e) => e.attacker === 0 && e.outcome === 'hit',
      );
      if (warriorHit) {
        sum += warriorHit.damage;
        count++;
      }
      void first;
    }
    const avg = sum / count;
    expect(avg).toBeGreaterThan(252 * 0.97);
    expect(avg).toBeLessThan(252 * 1.03);
  });

  it('the on-par warrior beats the 0.85× grunt comfortably and within ~13 rounds', () => {
    const rig = new Rng(seedState('winrate', 'combat'));
    let wins = 0;
    let totalRounds = 0;
    const N = 500;
    for (let i = 0; i < N; i++) {
      const r = simulateCombat(fixtureWarrior(), fixtureGrunt(), rig.deriveSeed());
      if (r.winner === 0) wins++;
      totalRounds += r.rounds.length;
    }
    expect(wins / N).toBeGreaterThan(0.95);
    expect(totalRounds / N).toBeGreaterThan(6);
    expect(totalRounds / N).toBeLessThan(16);
  });

  it('always terminates, even between two unkillable turtles (round cap → initiator loses)', () => {
    const turtle = (id: string): Combatant => ({
      ...fixtureWarrior(),
      id,
      attrs: { str: 1, dex: 1, int: 1, con: 1, lck: 1 },
      weapon: { min: 1, max: 1 },
      maxHp: 10_000_000,
      armor: 100_000,
    });
    const result = simulateCombat(turtle('a'), turtle('b'), SEED);
    expect(result.rounds.length).toBeLessThanOrEqual(100);
    expect(result.tieBreak).toBe(true);
    expect(result.winner).toBe(1);
  });

  it('mage attacks are never blocked or evaded', () => {
    const rig = new Rng(seedState('mage-check', 'combat'));
    const mage: Combatant = {
      ...fixtureWarrior(),
      id: 'mage',
      unblockable: true,
      dmgMult: 1.9,
    };
    const dodgy: Combatant = {
      ...fixtureGrunt(),
      id: 'dodgy',
      blockChance: 0.9,
      evadeChance: 0.9,
      maxHp: 100_000,
    };
    for (let i = 0; i < 30; i++) {
      const result = simulateCombat(mage, dodgy, rig.deriveSeed());
      for (const round of result.rounds) {
        for (const e of round.events) {
          if (e.attacker === 0) expect(['hit', 'crit']).toContain(e.outcome);
        }
      }
    }
  });

  it('assassins strike twice per round at reduced power', () => {
    const asn: Combatant = {
      ...fixtureWarrior(),
      id: 'asn',
      strikes: 2,
      strikeMult: 0.65,
      offhandWeapon: { min: 10, max: 12 },
    };
    const result = simulateCombat(asn, { ...fixtureGrunt(), maxHp: 500_000 }, SEED);
    const firstRoundAsn = result.rounds[0]!.events.filter((e) => e.attacker === 0);
    expect(firstRoundAsn).toHaveLength(2);
  });

  it('rage makes late rounds hit harder than early ones', () => {
    const tank: Combatant = { ...fixtureGrunt(), maxHp: 400_000, blockChance: 0, evadeChance: 0 };
    const result = simulateCombat(
      { ...fixtureWarrior(), attrs: { ...fixtureWarrior().attrs, lck: 0 } },
      tank,
      SEED,
    );
    const hitsIn = (round: number) =>
      result.rounds[round]!.events.filter((e) => e.attacker === 0 && e.outcome === 'hit');
    const early = hitsIn(0)[0]?.damage ?? 0;
    const late = hitsIn(result.rounds.length - 1)[0]?.damage ?? 0;
    expect(late).toBeGreaterThan(early * 1.5);
  });
});

describe('combatant builders', () => {
  it('class signatures carry the BALANCING §3.2 constants', () => {
    expect(classSignature('warrior').blockChance).toBe(0.25);
    expect(classSignature('scout').evadeChance).toBe(0.35);
    expect(classSignature('scout').critMult).toBe(2.5);
    expect(classSignature('mage').unblockable).toBe(true);
    expect(classSignature('mage').dmgMult).toBe(1.9);
    expect(classSignature('assassin').strikes).toBe(2);
    expect(classSignature('assassin').critCap).toBe(0.6);
  });

  it('builds a fighting hero from a fresh save (unarmed but functional)', () => {
    const save = createNewSave(
      {
        name: 'Fresh',
        classId: 'warrior',
        emblem: deriveEmblem('Fresh', 'warrior'),
        worldSeed: 'c'.repeat(32),
      },
      new Date(2026, 6, 28).getTime(),
    );
    const hero = heroToCombatant(save);
    expect(hero.maxHp).toBe(12 * 5 * 2); // CON 12 × factor 5 × (L1+1)
    expect(hero.weapon.max).toBeGreaterThanOrEqual(hero.weapon.min);
    expect(hero.blockChance).toBe(0.25);
  });

  it('archetype enemies scale off par with template multipliers', () => {
    const grunt = archetypeCombatant('grunt', 20);
    const brute = archetypeCombatant('brute', 20);
    const caster = archetypeCombatant('caster', 20);
    expect(brute.maxHp).toBeGreaterThan(grunt.maxHp);
    expect(caster.unblockable).toBe(true);
    expect(brute.brute).toBe(true);
    expect(grunt.attrs.str).toBeGreaterThan(0);
  });
});
