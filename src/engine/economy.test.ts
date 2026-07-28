import { describe, expect, it } from 'vitest';
import {
  attrCost,
  attrCostTotal,
  missionGold,
  missionXp,
  missionsPerLevel,
  patrolGoldPerHour,
  zoneMultiplier,
} from './economy';

describe('attribute costs (BALANCING §2.4)', () => {
  it('matches the published table', () => {
    expect(attrCost(10)).toBe(40);
    expect(attrCost(50)).toBe(2210);
    expect(attrCost(100)).toBe(12_500);
    expect(attrCost(200)).toBe(70_711);
    expect(attrCost(400)).toBe(400_000);
    expect(attrCost(800)).toBe(2_262_742);
    expect(attrCost(1449)).toBeLessThan(10_000_000);
    expect(attrCost(1450)).toBe(10_000_000); // the cap begins
    expect(attrCost(5000)).toBe(10_000_000);
  });

  it('cumulative cost is monotonic and steep', () => {
    expect(attrCostTotal(100)).toBeGreaterThan(300_000);
    expect(attrCostTotal(100)).toBeLessThan(420_000);
    expect(attrCostTotal(200)).toBeGreaterThan(4 * attrCostTotal(100));
  });
});

describe('mission economy (BALANCING §2.2–2.3)', () => {
  it('MPL matches the re-anchored curve (§10 changelog 2026-07-28)', () => {
    expect(missionsPerLevel(1)).toBeCloseTo(1.41, 2);
    expect(missionsPerLevel(50)).toBeCloseTo(32.01, 1);
    expect(missionsPerLevel(100)).toBeCloseTo(104.53, 1);
  });

  it('rewards scale with duration and stay integral', () => {
    const xp10 = missionXp(20, 10);
    const xp20 = missionXp(20, 20);
    expect(xp20).toBeGreaterThanOrEqual(xp10 * 2 - 1);
    expect(Number.isInteger(xp10)).toBe(true);
    expect(missionGold(20, 10)).toBe(Math.ceil(18 * Math.pow(20, 1.9)));
  });

  it('a level takes ~MPL missions worth of XP', () => {
    const L = 30;
    const perMission = missionXp(L, 10);
    const missionsNeeded = Math.ceil(100 * Math.pow(L, 2.4)) / perMission;
    expect(missionsNeeded).toBeGreaterThan(missionsPerLevel(L) * 0.95);
    expect(missionsNeeded).toBeLessThan(missionsPerLevel(L) * 1.05);
  });

  it('zone decay: −8%/zone below frontier, floored at ×0.60', () => {
    expect(zoneMultiplier(5, 5)).toBe(1);
    expect(zoneMultiplier(4, 5)).toBeCloseTo(0.92);
    expect(zoneMultiplier(1, 10)).toBe(0.6);
  });

  it('patrol pays 30% of the frontier mission rate per hour', () => {
    expect(patrolGoldPerHour(40)).toBeCloseTo(0.3 * missionGold(40, 10), 5);
  });
});
