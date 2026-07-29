/** Missions, patrol, vigor, xp application, and the time-passage engine. */
import { describe, expect, it } from 'vitest';
import { monstersOfZone } from '@/content/bestiary';
import { parseGameSave } from '@/persist/schema';
import { missionGold, missionXp } from './economy';
import { createNewSave, deriveEmblem } from './newSave';
import {
  acceptTavernOffer,
  canStartMission,
  claimMission,
  generateMissionOffers,
  getTavernOffers,
  isMissionComplete,
  missionClockSec,
  missionVigorCost,
  rerollTavernOffers,
  startMission,
  tavernRerollCost,
  type MissionOffer,
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

/**
 * A board offer of a chosen SIZE, priced the way the board would price it.
 *
 * Since B2 an offer's size and its vigor cost are two different numbers, so
 * `{...rolledOffer, durationMin: 20}` would produce something the game can
 * never hand out: a twenty-minute job still carrying a five-minute price tag.
 */
function offerOf(save: GameSave, durationMin: number, extra: Partial<MissionOffer> = {}) {
  return {
    ...generateMissionOffers(save)[0]!,
    durationMin,
    vigorCost: missionVigorCost(save, durationMin),
    ...extra,
  };
}

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

    save.hero.gems = 0; // creation now grants STARTING_GEMS
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
    const offer = offerOf(save, 10, { lucky: false });
    const vigorBefore = save.daily.vigor;
    startMission(save, offer, T0);
    expect(save.daily.vigor).toBe(vigorBefore - offer.vigorCost);
    expect(canStartMission(save, offer)).toBe(false); // one activity at a time
    // Read the clock off the mission rather than assuming size == minutes: the
    // early game runs compressed, and the price comes down with it.
    const runsFor = save.activities.mission!.durationSec * 1000;
    expect(isMissionComplete(save, T0 + runsFor - 1000)).toBe(false);
    expect(() => claimMission(save, T0 + runsFor - 1000)).toThrow();

    const rewards = claimMission(save, T0 + runsFor);
    // `rewards.gold` is the mission's own reward; the end-of-mission fight's
    // bonus is reported separately and only lands on a win.
    expect(rewards.gold).toBe(offer.gold);
    expect(save.hero.gold).toBe(offer.gold + (rewards.fight.won ? rewards.fight.bonusGold : 0));
    expect(save.activities.mission).toBeNull();
    expect(save.stats.missionsCompleted).toBe(1);
  });

  it('every mission ends in a fight, and losing it never costs the reward', () => {
    const save = fresh();
    const offer = offerOf(save, 10, { lucky: false });
    startMission(save, offer, T0);
    const rewards = claimMission(save, T0 + save.activities.mission!.durationSec * 1000);

    // A real bout against a real resident of the zone you were sent to.
    const residents = monstersOfZone(offer.zoneIndex).map((m) => m.id);
    expect(residents).toContain(rewards.fight.monsterId);
    expect(rewards.fight.result.rounds.length).toBeGreaterThan(0);
    // …and you met it, so the Codex remembers it either way.
    expect(save.progress.codex.monstersSeen[rewards.fight.monsterId] ?? 0).toBeGreaterThan(0);

    // The job was done, so the job is paid — win or lose.
    expect(rewards.gold).toBe(offer.gold);
    expect(rewards.fight.bonusGold).toBe(rewards.fight.won ? Math.round(offer.gold * 0.15) : 0);
  });

  it('a hopeless hero still gets paid — the fight is upside, never a toll', () => {
    // Strip the hero to nothing and send them at a zone-10 monster: they lose
    // the scrap, and the mission's gold and XP arrive in full regardless.
    const save = fresh();
    save.hero.level = 1;
    save.hero.attrsBought = { str: 0, dex: 0, int: 0, con: 0, lck: 0 };
    save.progress.zonePinned = null;
    const offer = offerOf(save, 5, { gold: 500, xp: 400 });
    startMission(save, offer, T0);
    const goldBefore = save.hero.gold;
    const rewards = claimMission(save, T0 + save.activities.mission!.durationSec * 1000);

    expect(rewards.gold).toBe(500);
    expect(save.hero.gold).toBeGreaterThanOrEqual(goldBefore + 500);
    expect(rewards.xp.gained).toBeGreaterThanOrEqual(400);
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
    save.hero.gems = 0; // creation now grants STARTING_GEMS
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
      const offer = offerOf(save, 5);
      startMission(save, offer, T0 + i * 10 * MIN);
      const rewards = claimMission(save, T0 + i * 10 * MIN + 5 * MIN);
      total += rewards.autoSoldGold;
      if (rewards.item) expect(rewards.autoSoldGold).toBeGreaterThan(0);
    }
    expect(save.inventory.backpack).toHaveLength(0);
  });

  it('mounts shorten the clock but never the vigor cost', () => {
    const save = fresh();
    save.hero.level = 30; // past the fast-clock band, so size == minutes
    save.stats.missionsCompleted = 5; // past the tutorial's fixed first errand
    save.progress.mountTier = 4; // Ember Drake −50%
    const offer = offerOf(save, 20);
    startMission(save, offer, T0);
    expect(save.activities.mission?.durationSec).toBe(10 * 60);
    expect(save.daily.vigor).toBe(100 - 20);
  });
});

/**
 * The early game runs on a compressed clock (B1), and since B2 the price is
 * compressed with it: **one vigor per minute, at every level**. The property
 * that keeps the anti-rush contract intact is no longer "the cost doesn't move"
 * — it is that INCOME PER VIGOR doesn't move. An early mission is a small
 * mission, not a big one on sale.
 */
describe('the early-game clock', () => {
  it('the very first errand is always 30 seconds, and costs half a vigor', () => {
    const save = fresh();
    const offer = offerOf(save, 20);
    startMission(save, offer, T0);
    expect(save.activities.mission?.durationSec).toBe(30);
    expect(offer.vigorCost).toBe(0.5);
    expect(save.daily.vigor).toBe(100 - 0.5);
    expect(save.activities.mission?.payload.xp).toBe(offer.xp);
  });

  it('levels 1–10 run 30 s to 2 min, and every band costs its own minutes', () => {
    const save = fresh();
    save.stats.missionsCompleted = 1; // past the tutorial clamp
    for (const [size, seconds, vigor] of [
      [5, 30, 0.5],
      [10, 60, 1],
      [15, 90, 1.5],
      [20, 120, 2],
    ] as const) {
      expect(missionClockSec(save, size)).toBe(seconds);
      expect(missionVigorCost(save, size)).toBe(vigor);
      expect(seconds).toBeGreaterThanOrEqual(30);
      expect(seconds).toBeLessThanOrEqual(120);
    }
  });

  it('past level 10 the clock is the size again, in real minutes and real vigor', () => {
    const save = fresh();
    save.stats.missionsCompleted = 1;
    save.hero.level = 11;
    expect(missionClockSec(save, 20)).toBe(20 * 60);
    expect(missionClockSec(save, 5)).toBe(5 * 60);
    expect(missionVigorCost(save, 20)).toBe(20);
    expect(missionVigorCost(save, 5)).toBe(5);
  });

  it('income per vigor is the same on both sides of the band', () => {
    // The anti-rush property, restated for B2. The early hero pays a tenth of
    // the price and is paid a tenth of the reward, so a day's vigor buys
    // exactly as much progress at level 3 as it does at level 30 — it just
    // arrives in more, smaller pieces. If this ever drifts, the compressed
    // clock has become a discount and §8.2's ceilings are meaningless.
    const early = fresh();
    early.stats.missionsCompleted = 1;
    const late = fresh();
    late.stats.missionsCompleted = 1;
    late.hero.level = 11;

    const earlyOffer = generateMissionOffers(early)[0]!;
    const lateOffer = generateMissionOffers(late)[0]!;
    expect(earlyOffer.durationMin).toBe(lateOffer.durationMin); // same rng, same rung
    expect(earlyOffer.vigorCost).toBeLessThan(lateOffer.vigorCost);

    // Both are priced by the SAME rate card — `missionGold(level, vigor)` — so
    // the compression cannot be a discount. Both heroes sit on their zone's
    // frontier, so the zone multiplier is 1 for each.
    for (const [save, offer] of [
      [early, earlyOffer],
      [late, lateOffer],
    ] as const) {
      const boost = offer.lucky ? 2 : 1;
      expect(offer.gold).toBe(Math.ceil(missionGold(save.hero.level, offer.vigorCost) * boost));
      expect(offer.xp).toBe(Math.ceil(missionXp(save.hero.level, offer.vigorCost) * boost));
    }

    startMission(early, earlyOffer, T0);
    startMission(late, lateOffer, T0);
    expect(early.activities.mission!.durationSec).toBeLessThan(
      late.activities.mission!.durationSec,
    );
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
    const offer = offerOf(save, 20);
    startMission(save, offer, T0);
    claimMission(save, T0 + 20 * MIN);
    save.daily.vigor = 0;
    startPatrol(save, T0 + 21 * MIN);
    applyTimePassage(save, T0 + 3 * 24 * HOUR);
    expect(() => parseGameSave(JSON.parse(JSON.stringify(save)))).not.toThrow();
  });
});

/**
 * The long-absence cases (M9 QA sweep). The scenario that matters is not a
 * cheater — it is somebody who put the game down in July and opens it again in
 * March, and whose first impression is whatever this function does.
 */
describe('clock jumps and long absences', () => {
  const YEAR = 365 * 24 * HOUR;

  it('a year away lands on the right day, week and month without stalling', () => {
    const save = fresh();
    const back = T0 + YEAR;
    const result = applyTimePassage(save, back);
    expect(result.frozen).toBe(false);
    expect(result.daysCrossed).toBe(365);
    expect(result.weeksCrossed).toBe(52);
    expect(result.monthsCrossed).toBe(12);
    expect(save.daily.dayKey).toBe('2027-07-28');
    expect(save.monthly.monthKey).toBe('2027-07');
    expect(save.lastSeenAt).toBe(new Date(back).toISOString());
    expect(() => parseGameSave(JSON.parse(JSON.stringify(save)))).not.toThrow();
  });

  it('per-day allowances do NOT stack — a year away buys exactly one day', () => {
    // This is the property that makes forward jumps pointless to farm: every
    // reset ASSIGNS the day's allowance rather than adding to it, so 365
    // crossed midnights and one crossed midnight leave the same hero.
    const long = fresh();
    long.daily.vigor = 0;
    long.daily.wheelSpins = 5;
    long.daily.freeTossUsed = true;
    long.daily.aleUsed = 3;
    applyTimePassage(long, T0 + YEAR);

    const short = fresh();
    short.daily.vigor = 0;
    short.daily.wheelSpins = 5;
    short.daily.freeTossUsed = true;
    short.daily.aleUsed = 3;
    applyTimePassage(short, T0 + 25 * HOUR);

    expect(long.daily.vigor).toBe(short.daily.vigor);
    expect(long.daily.wheelSpins).toBe(0);
    expect(long.daily.freeTossUsed).toBe(false);
    expect(long.daily.aleUsed).toBe(0);
    expect(long.hero.gems).toBe(short.hero.gems);
  });

  it('patrol banks its 8-hour cap once, not a year of gold', () => {
    const save = fresh();
    save.daily.vigor = 0;
    startPatrol(save, T0);
    const year = applyTimePassage(save, T0 + YEAR);

    const capped = fresh();
    capped.daily.vigor = 0;
    startPatrol(capped, T0);
    // First midnight is 15h after T0 (09:00 → 00:00), past the 8h cap already.
    const oneNight = applyTimePassage(capped, T0 + 25 * HOUR);

    expect(year.patrolGoldBanked).toBe(oneNight.patrolGoldBanked);
    expect(save.activities.patrol).toBeNull(); // a patrol never spans days
  });

  it('the calendar advances one month, however long you were gone', () => {
    const save = fresh();
    save.calendar.claimedDays = [1, 2, 3];
    applyTimePassage(save, T0 + YEAR);
    expect(save.calendar.monthKey).toBe('2027-07');
    expect(save.calendar.claimedDays).toEqual([]);
  });

  it('a backwards jump freezes and then thaws once wall time catches up', () => {
    const save = fresh();
    applyTimePassage(save, T0 + 25 * HOUR); // now lastSeen = T0 + 25h
    const seen = save.lastSeenAt;

    // Device clock yanked back a week: nothing accrues, nothing is taken away.
    expect(applyTimePassage(save, T0).frozen).toBe(true);
    expect(save.lastSeenAt).toBe(seen); // high-water mark survives

    // Wall time passes the mark again → normal service, no penalty owed.
    const thawed = applyTimePassage(save, T0 + 49 * HOUR);
    expect(thawed.frozen).toBe(false);
    expect(thawed.daysCrossed).toBe(1);
  });
});
