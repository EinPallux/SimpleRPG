/**
 * Full-set combat mechanics (BALANCING §4.6): each behavior exercised through
 * the real simulateCombat with rigged fighters — fixed rolls, forced chances —
 * so every assertion is deterministic.
 */
import { describe, expect, it } from 'vitest';
import { simulateCombat, type Combatant, type StrikeEvent } from './combat';
import { seedState } from './rng';

const SEED = seedState('combat-effects', 'fixture');

/** A plain brawler: fixed weapon roll, no crits, no defenses. */
function fighter(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: 'f',
    name: 'f',
    level: 10,
    mainAttr: 'str',
    attrs: { str: 50, dex: 0, int: 0, con: 50, lck: 0 },
    maxHp: 5000,
    armor: 0,
    weapon: { min: 20, max: 20 },
    blockChance: 0,
    evadeChance: 0,
    unblockable: false,
    strikes: 1,
    strikeMult: 1,
    dmgMult: 1,
    critCap: 0,
    critMult: 2,
    ...overrides,
  };
}

function allEvents(a: Combatant, b: Combatant): StrikeEvent[] {
  return simulateCombat(a, b, SEED).rounds.flatMap((r) => r.events);
}

describe('full-set combat mechanics', () => {
  it('firstStrikeOverride always opens, with the first-strike damage bonus', () => {
    const opener = fighter({ id: 'opener', firstStrikeOverride: true, firstStrikeDmgMult: 0.25 });
    const other = fighter({ id: 'other' });
    for (const seed of [SEED, seedState('combat-effects', 'alt')]) {
      const result = simulateCombat(other, opener, seed);
      expect(result.firstStriker).toBe(1);
    }
    // Same fighters, bonus off → the very first strike is exactly ×1.25 smaller.
    const withBonus = simulateCombat(opener, other, SEED);
    const noBonus = simulateCombat(
      fighter({ id: 'opener', firstStrikeOverride: true }),
      other,
      SEED,
    );
    const first = withBonus.rounds[0]!.events[0]!;
    const firstPlain = noBonus.rounds[0]!.events[0]!;
    expect(first.attacker).toBe(0);
    expect(first.damage).toBe(Math.round(firstPlain.damage * 1.25));
  });

  it('healOnBlock heals and reflectOnBlock bites back on every block', () => {
    const juggernaut = fighter({
      id: 'wall',
      blockChance: 1,
      healOnBlockPct: 0.02,
      reflectOnBlockPct: 0.3,
      weapon: { min: 1, max: 1 },
      attrs: { str: 0, dex: 0, int: 0, con: 50, lck: 0 },
      maxHp: 1000,
    });
    const attacker = fighter({ id: 'atk', maxHp: 400 });
    const result = simulateCombat(attacker, juggernaut, SEED);
    const blocks = result.rounds.flatMap((r) => r.events).filter((e) => e.outcome === 'blocked');
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block.heal).toBeGreaterThan(0);
      expect(block.reflect).toBeGreaterThan(0);
    }
    // The attacker dies to their own reflected strikes; the wall never drops.
    expect(result.winner).toBe(1);
    expect(result.hpRemaining[0]).toBe(0);
    expect(result.hpRemaining[1]).toBe(1000);
  });

  it('afterBlockNextHit arms a ×1.4 counter-punch', () => {
    // Attacker opens (override) → gets blocked → the blocker's reply is ×1.4.
    const blockerBuffed = fighter({ id: 'b', blockChance: 1, afterBlockNextHitMult: 1.4 });
    const blockerPlain = fighter({ id: 'b', blockChance: 1 });
    const opener = fighter({ id: 'a', firstStrikeOverride: true });
    const buffed = allEvents(opener, blockerBuffed).find((e) => e.attacker === 1)!;
    const plain = allEvents(opener, blockerPlain).find((e) => e.attacker === 1)!;
    expect(buffed.damage).toBe(Math.round(plain.damage * 1.4));
  });

  it('afterEvadeCrit turns the dodge into a guaranteed crit', () => {
    const dancer = fighter({ id: 'd', evadeChance: 1, afterEvadeCrit: true });
    const brawler = fighter({ id: 'a', firstStrikeOverride: true });
    const events = allEvents(brawler, dancer);
    // Every dancer strike after the first evade is a crit, with zero luck.
    const dancerStrikes = events.filter((e) => e.attacker === 1);
    expect(dancerStrikes.length).toBeGreaterThan(0);
    expect(dancerStrikes.every((e) => e.outcome === 'crit')).toBe(true);
  });

  it('everyNthStrike multiplies each nth landed strike', () => {
    const metronome = fighter({ id: 'm', everyNthStrike: { n: 2, mult: 1.6 } });
    const target = fighter({ id: 't', maxHp: 100_000 });
    const strikes = allEvents(metronome, target)
      .filter((e) => e.attacker === 0 && !e.dot)
      .slice(0, 4);
    expect(strikes[1]!.damage).toBeGreaterThan(strikes[0]!.damage * 1.4); // rage + ×1.6
    // 1st and 3rd are plain; 2nd and 4th carry the multiplier
    expect(strikes[3]!.damage).toBeGreaterThan(strikes[2]!.damage * 1.4);
  });

  it('enemyDrCap pierces a heavy-armor wall', () => {
    const tank = fighter({ id: 't', armor: 100_000, maxHp: 20_000 }); // DR would cap at 50%
    const piercer = fighter({ id: 'p', enemyDrCap: 0.35 });
    const plain = fighter({ id: 'p' });
    const pierced = allEvents(piercer, tank).find((e) => e.attacker === 0)!;
    const blunt = allEvents(plain, tank).find((e) => e.attacker === 0)!;
    expect(pierced.damage / blunt.damage).toBeCloseTo(0.65 / 0.5, 1);
  });

  it('poisonOnCrit ticks as dot events and can finish the job', () => {
    const venom = fighter({
      id: 'v',
      critCap: 1,
      attrs: { str: 50, dex: 0, int: 0, con: 50, lck: 100_000 },
      poisonOnCrit: { pct: 0.5, rounds: 2 },
    });
    const victim = fighter({ id: 'x', maxHp: 3000 });
    const result = simulateCombat(venom, victim, SEED);
    const dots = result.rounds.flatMap((r) => r.events).filter((e) => e.dot);
    expect(dots.length).toBeGreaterThan(0);
    for (const dot of dots) {
      expect(dot.attacker).toBe(0);
      expect(dot.damage).toBeGreaterThan(0);
    }
    // The playback invariant: every event's targetHpAfter chain stays consistent.
    let hp = victim.maxHp;
    for (const e of result.rounds.flatMap((r) => r.events)) {
      if (e.attacker === 0 && e.damage > 0) hp = Math.max(0, hp - e.damage);
      if (e.attacker === 0) expect(e.targetHpAfter).toBe(hp);
    }
  });

  it('doubleCritBonus doubles the second strike of a critting pair', () => {
    const pair = fighter({
      id: 'p',
      strikes: 2,
      strikeMult: 1,
      offhandWeapon: { min: 20, max: 20 },
      critCap: 1,
      attrs: { str: 50, dex: 0, int: 0, con: 50, lck: 100_000 },
      doubleCritBonusMult: 2,
    });
    const target = fighter({ id: 't', maxHp: 100_000 });
    const events = allEvents(pair, target).filter((e) => e.attacker === 0 && !e.dot);
    const [s1, s2] = [events[0]!, events[1]!];
    expect(s1.outcome).toBe('crit');
    expect(s2.outcome).toBe('crit');
    expect(s2.damage).toBe(s1.damage * 2);
  });
});
