import { describe, expect, it } from 'vitest';
import {
  arenaCooldownRemaining,
  canFight,
  fightArena,
  fightsLeft,
  getArenaOffers,
  honorOnLoss,
  honorOnWin,
  skipCooldown,
} from './arena';
import { ARENA_FIGHTS_PER_DAY, HONOR_FLOOR } from './constants';
import { createNewSave, deriveEmblem } from './newSave';
import { applyDailyReset } from './timePassage';
import type { GameSave } from './types';

const T0 = new Date(2026, 6, 28, 9, 0).getTime();
const MIN = 60_000;

function fresh(level = 10): GameSave {
  const save = createNewSave(
    {
      name: 'Bracket',
      classId: 'warrior',
      emblem: deriveEmblem('Bracket', 'warrior'),
      worldSeed: 'ab'.repeat(16),
    },
    T0,
  );
  save.hero.level = level;
  save.hero.attrsBought = { str: 30, dex: 10, int: 5, con: 25, lck: 10 };
  return save;
}

describe('honor math (capped place-swap, BALANCING §4.5)', () => {
  it('winning up leaps toward the loser but never past the cap; winning down pays the minimum', () => {
    expect(honorOnWin(100, 1100)).toBe(15); // leap 1005 → capped at max(15, 0.1% of 100)
    expect(honorOnWin(1000, 900)).toBe(5); // already ahead → HONOR_WIN_MIN
    expect(honorOnWin(100_000, 200_000)).toBe(100); // pct cap engages: 0.1% of 100k
    expect(honorOnLoss(1100, 100)).toBe(56); // losing down hurts: 6 + 5% of the gap
    expect(honorOnLoss(100, 1100)).toBe(6); // losing up is cheap but never free
  });
});

describe('arena', () => {
  it('offers three ranked opponents: below, par, above — stable until you fight', () => {
    const save = fresh();
    const a = getArenaOffers(save, T0);
    const b = getArenaOffers(save, T0 + 5 * MIN);
    expect(a.map((o) => o.bot.id)).toEqual(b.map((o) => o.bot.id));
    expect(a).toHaveLength(3);
    expect(a[2]!.bot.honor).toBeGreaterThanOrEqual(a[0]!.bot.honor); // "above" ≥ "below"
    for (const offer of a) expect(['safe', 'even', 'risky']).toContain(offer.stance);
  });

  it('a fight consumes a slot, starts the cooldown, moves honor and pays out', () => {
    const save = fresh();
    const honorBefore = save.hero.honor;
    const outcome = fightArena(save, 0, T0);
    expect(save.activities.arena.fightsToday).toBe(1);
    expect(arenaCooldownRemaining(save, T0)).toBeGreaterThan(0);
    expect(canFight(save, T0 + 11 * MIN)).toBe(true);
    expect(outcome.sparring).toBe(false);
    expect(outcome.heroCombatant.name).toBe('Bracket'); // playback needs both kits
    expect(outcome.opponentCombatant.name).toBe(outcome.opponent.name);
    if (outcome.won) {
      expect(save.hero.honor).toBeGreaterThan(honorBefore);
      expect(outcome.gold).toBeGreaterThan(0);
      expect(outcome.xp?.gained).toBeGreaterThan(0);
    } else {
      expect(save.hero.honor).toBeGreaterThanOrEqual(HONOR_FLOOR);
      expect(save.hero.honor).toBeLessThanOrEqual(honorBefore);
    }
  });

  it('cooldown blocks fighting; a gem skips it', () => {
    const save = fresh();
    fightArena(save, 0, T0);
    expect(() => fightArena(save, 0, T0 + MIN)).toThrow(/hourglass/);
    expect(() => skipCooldown(save)).toThrow(/gems/);
    save.hero.gems = 2;
    skipCooldown(save);
    expect(canFight(save, T0 + MIN)).toBe(true);
    expect(save.hero.gems).toBe(1);
  });

  it('after ten rewarded bouts everything becomes sparring: no honor, no gold, no slot use', () => {
    const save = fresh();
    save.hero.gems = 50;
    let clock = T0;
    for (let i = 0; i < ARENA_FIGHTS_PER_DAY; i++) {
      fightArena(save, 0, clock);
      clock += 11 * MIN;
    }
    expect(fightsLeft(save)).toBe(0);
    const honorBefore = save.hero.honor;
    const goldBefore = save.hero.gold;
    const spar = fightArena(save, 1, clock);
    expect(spar.sparring).toBe(true);
    expect(save.hero.honor).toBe(honorBefore);
    expect(save.hero.gold).toBe(goldBefore);
    expect(save.activities.arena.fightsToday).toBe(ARENA_FIGHTS_PER_DAY);

    applyDailyReset(save, clock + 24 * 60 * MIN);
    expect(fightsLeft(save)).toBe(ARENA_FIGHTS_PER_DAY);
  });

  it('first-time rank milestones pay gems exactly once', () => {
    const save = fresh(40);
    save.hero.attrsBought = { str: 400, dex: 150, int: 50, con: 300, lck: 150 };
    save.hero.honor = 100_000; // vault to rank 1
    const before = save.hero.gems;
    const outcome = fightArena(save, 0, T0);
    expect(outcome.newRank).toBe(1);
    expect(save.hero.gems - before).toBe(5 + 8 + 12 + 15 + 20 + 25 + 30 + 50);
    const again = fightArena(save, 0, T0 + 11 * MIN);
    expect(again.milestoneGems).toBe(0);
  });

  it('combat results are persisted-stream driven: refighting after reload replays identically', () => {
    const a = fresh();
    const b = fresh();
    const outA = fightArena(a, 1, T0);
    const outB = fightArena(b, 1, T0);
    expect(outA.result).toEqual(outB.result);
    expect(outA.honorDelta).toBe(outB.honorDelta);
  });
});
