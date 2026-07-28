/** Missions, patrol, vigor, xp application, and the time-passage engine. */
import { describe, expect, it } from 'vitest';
import { parseGameSave } from '@/persist/schema';
import { createNewSave, deriveEmblem } from './newSave';
import {
  acceptTavernOffer,
  canStartMission,
  claimMission,
  generateMissionOffers,
  getTavernOffers,
  isMissionComplete,
  rerollTavernOffers,
  startMission,
  tavernRerollCost,
} from './missions';
import { canStartPatrol, collectPatrol, startPatrol } from './patrol';
import { applyTimePassage } from './timePassage';
import type { GameSave } from './types';
import { buyAle, claimSecondWind } from './vigor';
import { applyXp } from './xpGain';
import { xpToNext } from './xp';

const T0 = new Date(2026, 6, 28, 9, 0).getTime(); // local Tue 2026-07-28 09:00

function fresh(name = 'Testa'): GameSave {
  return createNewSave(
    { name, classId: 'scout', emblem: deriveEmblem(name, 'scout'), worldSeed: 'd'.repeat(32) },
    T0,
  );
}

const HOUR = 3_600_000;
const MIN = 60_000;

describe('xp application', () => {
  it('levels up across multiple thresholds and unlocks zone frontiers', () => {
    const save = fresh();
    const toLevel8 = Array.from({ length: 7 }, (_, i) => xpToNext(i + 1)).reduce((a, b) => a + b);
    const result = applyXp(save, toLevel8);
    expect(result.newLevel).toBe(8);
    expect(save.progress.zonesUnlocked).toBe(2); // Millhaven at L8
  });
});

describe('vigor', () => {
  it('second wind is once per day, ale needs gems and respects the cap', () => {
    const save = fresh();
    claimSecondWind(save);
    expect(save.daily.vigor).toBe(150);
    expect(() => claimSecondWind(save)).toThrow();

    expect(() => buyAle(save)).toThrow(); // no gems
    save.hero.gems = 20;
    for (let i = 0; i < 5; i++) buyAle(save);
    expect(save.daily.vigor).toBe(250);
    expect(save.hero.gems).toBe(10);
    expect(() => buyAle(save)).toThrow(); // daily cap
  });
});

describe('missions', () => {
  it('offers are deterministic per stream state and priced by the economy', () => {
    const a = generateMissionOffers(fresh());
    const b = generateMissionOffers(fresh());
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    for (const offer of a) {
      expect([5, 10, 15, 20]).toContain(offer.durationMin);
      expect(offer.zoneIndex).toBe(1);
      expect(offer.xp).toBeGreaterThan(0);
    }
  });

  it('start spends vigor up front; claim pays xp/gold and clears the slot', () => {
    const save = fresh();
    const offer = { ...generateMissionOffers(save)[0]!, durationMin: 10, lucky: false };
    const vigorBefore = save.daily.vigor;
    startMission(save, offer, T0);
    expect(save.daily.vigor).toBe(vigorBefore - 10);
    expect(canStartMission(save, offer)).toBe(false); // one activity at a time
    expect(isMissionComplete(save, T0 + 9 * MIN)).toBe(false);
    expect(() => claimMission(save, T0 + 9 * MIN)).toThrow();

    const rewards = claimMission(save, T0 + 10 * MIN);
    expect(rewards.gold).toBe(offer.gold);
    expect(save.hero.gold).toBe(offer.gold);
    expect(save.activities.mission).toBeNull();
    expect(save.stats.missionsCompleted).toBe(1);
  });

  it('the tavern board persists until accepted — no offer-fishing', () => {
    const save = fresh();
    const board = getTavernOffers(save);
    expect(getTavernOffers(save)).toBe(save.activities.tavernOffers);
    expect(getTavernOffers(save)).toEqual(board); // stable across reads
    save.progress.zonePinned = 1; // pin toggling must NOT reroll the board
    expect(getTavernOffers(save)).toEqual(board);

    acceptTavernOffer(save, 0, T0);
    expect(save.activities.tavernOffers).toBeNull(); // board clears on accept
    expect(save.activities.mission?.payload.durationMin).toBe(board[0]!.durationMin);
  });

  it('rerolling is free once per day, then costs a gem', () => {
    const save = fresh();
    const first = getTavernOffers(save);
    expect(tavernRerollCost(save)).toBe(0);
    const second = rerollTavernOffers(save);
    expect(second).not.toEqual(first);
    expect(tavernRerollCost(save)).toBe(1);
    expect(() => rerollTavernOffers(save)).toThrow(); // no gems yet
    save.hero.gems = 3;
    rerollTavernOffers(save);
    expect(save.hero.gems).toBe(2);
  });

  it('claiming with a full backpack auto-sells the drop for gold', () => {
    const save = fresh();
    save.inventory.capacity = 0; // force the overflow path
    let total = 0;
    for (let i = 0; i < 30 && total === 0; i++) {
      const offer = { ...generateMissionOffers(save)[0]!, durationMin: 5 };
      startMission(save, offer, T0 + i * 10 * MIN);
      const rewards = claimMission(save, T0 + i * 10 * MIN + 5 * MIN);
      total += rewards.autoSoldGold;
      if (rewards.item) expect(rewards.autoSoldGold).toBeGreaterThan(0);
    }
    expect(save.inventory.backpack).toHaveLength(0);
  });

  it('mounts shorten the clock but never the vigor cost', () => {
    const save = fresh();
    save.progress.mountTier = 4; // Ember Drake −50%
    const offer = { ...generateMissionOffers(save)[0]!, durationMin: 20 };
    startMission(save, offer, T0);
    expect(save.activities.mission?.durationSec).toBe(10 * 60);
    expect(save.daily.vigor).toBe(100 - 20);
  });
});

describe('patrol', () => {
  it('only hires the exhausted, ticks half-hourly, caps at 8h uncollected', () => {
    const save = fresh();
    expect(canStartPatrol(save)).toBe(false); // vigor full
    save.daily.vigor = 3;
    startPatrol(save, T0);

    expect(collectPatrol(save, T0 + 29 * MIN).ticks).toBe(0); // partial tick pending
    const one = collectPatrol(save, T0 + 31 * MIN);
    expect(one.ticks).toBe(1);
    expect(one.gold).toBeGreaterThan(0);

    // 12h later, but only 8h of accrual counts
    const capped = collectPatrol(save, T0 + 31 * MIN + 12 * HOUR);
    expect(capped.ticks).toBe(16);
  });
});

describe('time passage (offline catch-up + resets + tamper guard)', () => {
  it('applies daily resets for each crossed midnight and banks the patrol', () => {
    const save = fresh();
    save.daily.vigor = 2;
    save.daily.secondWindUsed = true;
    startPatrol(save, T0);

    // Return two days later at 07:00
    const later = T0 + 46 * HOUR;
    const result = applyTimePassage(save, later);
    expect(result.frozen).toBe(false);
    expect(result.daysCrossed).toBe(2);
    expect(result.patrolGoldBanked).toBeGreaterThan(0);
    expect(save.activities.patrol).toBeNull();
    expect(save.daily.vigor).toBe(100);
    expect(save.daily.secondWindUsed).toBe(false);
    expect(save.daily.dayKey).toBe('2026-07-30');
    expect(save.lastSeenAt).toBe(new Date(later).toISOString());
  });

  it('rolls weekly on Monday and monthly on the 1st', () => {
    const save = fresh(); // Tue 2026-07-28
    const nextMonday = new Date(2026, 7, 3, 8, 0).getTime(); // Mon 2026-08-03
    const result = applyTimePassage(save, nextMonday);
    expect(result.daysCrossed).toBe(6);
    expect(result.weeksCrossed).toBe(1);
    expect(result.monthsCrossed).toBe(1); // crossed 2026-08-01
    expect(save.weekly.weekKey).toBe('2026-W32');
    expect(save.monthly.monthKey).toBe('2026-08');
    expect(save.calendar.claimedDays).toEqual([]);
  });

  it('freezes instead of processing when the clock runs backwards', () => {
    const save = fresh();
    const result = applyTimePassage(save, T0 - HOUR);
    expect(result.frozen).toBe(true);
    expect(save.daily.dayKey).toBe('2026-07-28'); // untouched
    expect(save.lastSeenAt).toBe(new Date(T0).toISOString()); // high-water mark kept

    // Small backwards jitter within grace is tolerated silently
    expect(applyTimePassage(save, T0 - 5 * MIN).frozen).toBe(false);
  });

  it('produces schema-valid saves throughout a mission→patrol→multi-day cycle', () => {
    const save = fresh();
    const offer = { ...generateMissionOffers(save)[0]!, durationMin: 20 };
    startMission(save, offer, T0);
    claimMission(save, T0 + 20 * MIN);
    save.daily.vigor = 0;
    startPatrol(save, T0 + 21 * MIN);
    applyTimePassage(save, T0 + 3 * 24 * HOUR);
    expect(() => parseGameSave(JSON.parse(JSON.stringify(save)))).not.toThrow();
  });
});
