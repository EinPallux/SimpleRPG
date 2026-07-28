/**
 * Quest pool validation (GAME_DESIGN §12.2): volumes, schema, i18n coverage,
 * the activity budget that makes the Daily Chest reachable, and the invariant
 * that every metric is a cumulative counter (quests measure a period delta,
 * so a metric that can go down or sideways would break progress).
 */
import { describe, expect, it } from 'vitest';
import { hasKey } from '@/i18n';
import { STAT_KEYS, type StatKey } from './meta';
import {
  ALL_QUESTS,
  DAILY_QUESTS,
  MONTHLY_QUESTS,
  WEEKLY_QUESTS,
  getQuest,
  questSchema,
  questsForLevel,
  questsOfCadence,
  worstCaseDailyActivity,
} from './quests';

const statKeys = new Set<string>(STAT_KEYS);

describe('quest pools', () => {
  it('hold the canonical volumes: 24 daily, 12 weekly, 6 monthly', () => {
    expect(DAILY_QUESTS).toHaveLength(24);
    expect(WEEKLY_QUESTS).toHaveLength(12);
    expect(MONTHLY_QUESTS).toHaveLength(6);
    expect(ALL_QUESTS).toHaveLength(42);
  });

  it('use ids that are unique across every cadence', () => {
    const ids = ALL_QUESTS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('validate against questSchema', () => {
    for (const quest of ALL_QUESTS) expect(() => questSchema.parse(quest)).not.toThrow();
  });

  it('carry the cadence of the pool they live in', () => {
    for (const cadence of ['daily', 'weekly', 'monthly'] as const) {
      for (const quest of questsOfCadence(cadence)) expect(quest.cadence).toBe(cadence);
    }
  });

  it('resolve every nameKey in the catalog under quest.{id}', () => {
    for (const quest of ALL_QUESTS) {
      expect(quest.nameKey).toBe(`quest.${quest.id}`);
      expect(hasKey(quest.nameKey)).toBe(true);
    }
  });

  it('only measure cumulative counters from the stat ledger', () => {
    for (const quest of ALL_QUESTS) {
      expect(statKeys.has(quest.metric)).toBe(true);
      // narrowing here is the point: the metric must be assignable to StatKey
      const key: StatKey = quest.metric as StatKey;
      expect(STAT_KEYS).toContain(key);
    }
  });

  it('ask for positive, whole-number targets', () => {
    for (const quest of ALL_QUESTS) {
      expect(quest.target).toBeGreaterThan(0);
      expect(Number.isInteger(quest.target)).toBe(true);
    }
  });
});

describe('dailies and the activity meter', () => {
  it('every daily pays activity points', () => {
    for (const quest of DAILY_QUESTS) {
      expect(quest.activity).toBeGreaterThan(0);
      expect(quest.activity).toBeLessThanOrEqual(40);
    }
  });

  it('the three stingiest dailies still fill the meter to ~100', () => {
    // Worst-possible board: core-loop actions top up the last sliver.
    expect(worstCaseDailyActivity()).toBeGreaterThanOrEqual(90);
  });

  it('pays small, immediate rewards and never gems in bulk', () => {
    for (const quest of DAILY_QUESTS) {
      expect(quest.reward.gems ?? 0).toBeLessThanOrEqual(1);
      expect(quest.reward.setPiece).toBeUndefined();
      if (quest.reward.gold !== undefined) {
        expect(quest.reward.gold).toBeGreaterThanOrEqual(1.5);
        expect(quest.reward.gold).toBeLessThanOrEqual(4);
      }
    }
  });
});

describe('weeklies and monthlies', () => {
  it('every weekly pays exactly the 3-gem headline plus materials', () => {
    for (const quest of WEEKLY_QUESTS) {
      expect(quest.reward.gems).toBe(3);
      expect(quest.reward.scraps ?? 0).toBeGreaterThanOrEqual(20);
      expect(quest.reward.scraps ?? 0).toBeLessThanOrEqual(40);
      expect(quest.reward.dust ?? 0).toBeGreaterThanOrEqual(2);
      expect(quest.activity).toBeUndefined();
    }
  });

  it('every monthly pays 15–20 gems', () => {
    for (const quest of MONTHLY_QUESTS) {
      expect(quest.reward.gems ?? 0).toBeGreaterThanOrEqual(15);
      expect(quest.reward.gems ?? 0).toBeLessThanOrEqual(20);
      expect(quest.activity).toBeUndefined();
    }
  });

  it('the two biggest monthlies drop a set piece and exactly one grants a frame', () => {
    expect(MONTHLY_QUESTS.filter((q) => q.reward.setPiece).length).toBe(2);
    expect(MONTHLY_QUESTS.filter((q) => q.reward.frameId).length).toBe(1);
  });

  it('monthly targets outscale their weekly counterparts on the same metric', () => {
    for (const monthly of MONTHLY_QUESTS) {
      const weekly = WEEKLY_QUESTS.find((w) => w.metric === monthly.metric);
      if (weekly) expect(monthly.target).toBeGreaterThan(weekly.target);
    }
  });
});

describe('level gating (§12.2: boards stay achievable)', () => {
  it('gates the systems a fresh hero has not unlocked yet', () => {
    const gate = (id: string) => getQuest(id).minLevel;
    expect(gate('daily-dungeon-floor-1')).toBe(12);
    expect(gate('daily-expedition-1')).toBe(8);
    expect(gate('daily-forge-2')).toBe(15);
    expect(gate('daily-shop-2')).toBe(10);
    expect(gate('daily-elixir-1')).toBe(12);
    expect(gate('daily-wheel-3')).toBe(5);
    expect(gate('daily-arena-wins-3')).toBe(5);
  });

  it('leaves a level-6 hero (quest unlock) enough dailies for a board of three', () => {
    const board = questsForLevel('daily', 6);
    expect(board.length).toBeGreaterThanOrEqual(3);
    for (const quest of board) expect(quest.minLevel ?? 1).toBeLessThanOrEqual(6);
  });

  it('opens the full pool by the time the last gate clears', () => {
    expect(questsForLevel('daily', 15)).toHaveLength(24);
    expect(questsForLevel('weekly', 15)).toHaveLength(12);
    expect(questsForLevel('monthly', 15)).toHaveLength(6);
  });
});

describe('getQuest', () => {
  it('returns the definition by id', () => {
    expect(getQuest('weekly-arena-wins-25').target).toBe(25);
  });

  it('throws on an unknown id', () => {
    expect(() => getQuest('daily-nap-forever')).toThrow(/Unknown quest/);
  });
});
