/**
 * Achievement board validation (GAME_DESIGN §13, CONTENT §10): the 70-entry
 * volume and its per-category split, schema conformance, ascending tiers,
 * i18n coverage for both the name and the description, and the title hand-outs
 * cross-checked against `content/titles.ts`.
 */
import { describe, expect, it } from 'vitest';
import { hasKey } from '@/i18n';
import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_BY_CATEGORY,
  ACHIEVEMENT_CATEGORIES,
  TOTAL_TIERS,
  achievementDescKey,
  achievementNameKey,
  achievementSchema,
  achievementsOfCategory,
  getAchievement,
} from './achievements';
import { STAT_KEYS, type AchievementCategory } from './meta';
import { TITLE_IDS } from './titles';

/** CONTENT §10 — the split is a product requirement, not an accident. */
const CATEGORY_COUNTS: Record<AchievementCategory, number> = {
  progression: 12,
  combat: 14,
  collection: 12,
  economy: 10,
  exploration: 10,
  mastery: 8,
  secrets: 4,
};

/** Derived metrics the resolver owns (meta.ts `MetricId`); the rest are ledger keys. */
const DERIVED_METRICS = new Set<string>([
  'level',
  'zonesUnlocked',
  'storyChapter',
  'setsCompleted',
  'legendariesOwned',
  'petsOwned',
  'framesOwned',
  'mountTier',
  'codexPct',
  'bestiaryPct',
  'armoryPct',
  'bestZoneBestiaryPct',
  'attrTotalBought',
  'achievementTiers',
  'expeditionLocalesVisited',
]);

const statKeys = new Set<string>(STAT_KEYS);

describe('the achievement board', () => {
  it('holds exactly 70 achievements', () => {
    expect(ACHIEVEMENTS).toHaveLength(70);
  });

  it('splits 12/14/12/10/10/8/4 across the seven categories', () => {
    for (const category of ACHIEVEMENT_CATEGORIES) {
      expect(achievementsOfCategory(category)).toHaveLength(CATEGORY_COUNTS[category]);
    }
    const total = ACHIEVEMENT_CATEGORIES.reduce(
      (sum, category) => sum + CATEGORY_COUNTS[category],
      0,
    );
    expect(total).toBe(ACHIEVEMENTS.length);
  });

  it('uses unique ids', () => {
    const ids = ACHIEVEMENTS.map((achievement) => achievement.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('validates every entry against achievementSchema', () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(() => achievementSchema.parse(achievement)).not.toThrow();
    }
  });

  it('buckets every achievement under its own category', () => {
    for (const category of ACHIEVEMENT_CATEGORIES) {
      for (const achievement of ACHIEVEMENTS_BY_CATEGORY[category]) {
        expect(achievement.category).toBe(category);
      }
    }
    const bucketed = ACHIEVEMENT_CATEGORIES.flatMap((c) => ACHIEVEMENTS_BY_CATEGORY[c].length);
    expect(bucketed.reduce((sum, n) => sum + n, 0)).toBe(ACHIEVEMENTS.length);
  });

  it('measures a metric the engine can resolve — a ledger key or a derived id', () => {
    for (const achievement of ACHIEVEMENTS) {
      const known = statKeys.has(achievement.metric) || DERIVED_METRICS.has(achievement.metric);
      expect(known, `${achievement.id} measures ${achievement.metric}`).toBe(true);
    }
  });
});

describe('tiers', () => {
  it('are 1–3 whole, positive thresholds in strictly ascending order', () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.tiers.length).toBeGreaterThanOrEqual(1);
      expect(achievement.tiers.length).toBeLessThanOrEqual(3);
      for (const tier of achievement.tiers) {
        expect(Number.isInteger(tier)).toBe(true);
        expect(tier).toBeGreaterThan(0);
      }
      for (let i = 1; i < achievement.tiers.length; i += 1) {
        const previous = achievement.tiers[i - 1] ?? 0;
        const current = achievement.tiers[i] ?? 0;
        expect(current, `${achievement.id} tier ${i} must exceed tier ${i - 1}`).toBeGreaterThan(
          previous,
        );
      }
    }
  });

  it('sums to TOTAL_TIERS (the +3-all-attributes summary line)', () => {
    const sum = ACHIEVEMENTS.reduce((total, a) => total + a.tiers.length, 0);
    expect(TOTAL_TIERS).toBe(sum);
    expect(TOTAL_TIERS).toBe(146);
  });

  it('keeps the self-referential trophy achievement reachable', () => {
    const shelf = getAchievement('shelf-life');
    expect(shelf.metric).toBe('achievementTiers');
    expect(Math.max(...shelf.tiers)).toBeLessThanOrEqual(TOTAL_TIERS);
  });

  it('carries the canonical CONTENT §10 thresholds', () => {
    expect(getAchievement('growth-spurt').tiers).toEqual([10, 25, 50]);
    expect(getAchievement('triple-digits').tiers).toEqual([75, 100, 125]);
    expect(getAchievement('fold-marks').tiers).toEqual([3, 6, 10]);
    expect(getAchievement('chapter-and-verse').tiers).toEqual([2, 5, 8]);
    expect(getAchievement('regular-in-the-sand').tiers).toEqual([10, 100, 1000]);
    expect(getAchievement('on-a-tear').tiers).toEqual([5, 10]);
    expect(getAchievement('seam-finder').tiers).toEqual([100, 1000, 10_000]);
    expect(getAchievement('stairwell-enthusiast').tiers).toEqual([5, 25, 50]);
    expect(getAchievement('matching-finally').tiers).toEqual([1, 5, 14]);
    expect(getAchievement('small-committee').tiers).toEqual([4, 10, 16]);
    expect(getAchievement('named-things').tiers).toEqual([1, 4, 8]);
    expect(getAchievement('framed').tiers).toEqual([3, 12]);
    expect(getAchievement('gold-fever').tiers).toEqual([100_000, 10_000_000, 1_000_000_000]);
    expect(getAchievement('self-improvement-budget').tiers).toEqual([100, 1000, 5000]);
    expect(getAchievement('anvils-favourite').tiers).toEqual([20]);
    expect(getAchievement('boots-on-the-board').tiers).toEqual([50, 500, 2500]);
    expect(getAchievement('out-of-office').tiers).toEqual([10, 100]);
    // patrol ticks are 30 minutes each: 100 h and 1,000 h
    expect(getAchievement('night-shift').tiers).toEqual([200, 2000]);
    expect(getAchievement('all-four-corners').tiers).toEqual([4]); // content/expeditions LOCALES
    expect(getAchievement('twenty-eight-for-twenty-eight').tiers).toEqual([28]);
    expect(getAchievement('meter-pegged').tiers).toEqual([100]);
    expect(getAchievement('fifty-wishes').tiers).toEqual([50]);
    expect(getAchievement('the-cat-decides').tiers).toEqual([30]);
    expect(getAchievement('read-the-whole-thing').tiers).toEqual([80]); // 80 bestiary lore entries
  });
});

describe('i18n', () => {
  it('keys every achievement under achv.{id}', () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.nameKey).toBe(`achv.${achievement.id}`);
    }
  });

  it('resolves a name and a description for all 70', () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(hasKey(achievementNameKey(achievement.id)), `${achievement.id}.name`).toBe(true);
      expect(hasKey(achievementDescKey(achievement.id)), `${achievement.id}.desc`).toBe(true);
    }
  });
});

describe('rewards', () => {
  it('pays gems on every final tier, scaled 3–25 (§13: gold tiers pay gems)', () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.gems, `${achievement.id} pays gems`).toBeDefined();
      const gems = achievement.gems ?? 0;
      expect(Number.isInteger(gems)).toBe(true);
      expect(gems).toBeGreaterThanOrEqual(3);
      expect(gems).toBeLessThanOrEqual(25);
    }
  });

  /**
   * Signature feats pay well, but a ONE-OFF feat's real reward is its title —
   * a purse bankable on day two would otherwise fund the §6 ale ceiling before
   * the economy has started (BALANCING §10, 2026-07-28 M6 gem re-anchor).
   */
  it('pays the signature (titled) feats well, with single-event feats capped', () => {
    for (const achievement of ACHIEVEMENTS.filter((a) => a.titleId)) {
      const gems = achievement.gems ?? 0;
      const singleEvent = achievement.tiers.length === 1 && achievement.tiers[0] === 1;
      if (singleEvent) expect(gems, `${achievement.id}`).toBeLessThanOrEqual(5);
      else expect(gems, `${achievement.id}`).toBeGreaterThanOrEqual(8);
    }
  });

  it('hands out only titles that exist in content/titles.ts', () => {
    const titleIds = new Set(TITLE_IDS);
    for (const achievement of ACHIEVEMENTS) {
      if (!achievement.titleId) continue;
      expect(titleIds.has(achievement.titleId), `${achievement.id} → ${achievement.titleId}`).toBe(
        true,
      );
    }
  });

  it('awards each title at most once', () => {
    const awarded = ACHIEVEMENTS.flatMap((a) => (a.titleId ? [a.titleId] : []));
    expect(new Set(awarded).size).toBe(awarded.length);
  });

  it('attaches the canonical titles to the canonical feats', () => {
    const expected: Record<string, string> = {
      'not-a-scratch': 'the-unbroken',
      'one-point-of-dignity': 'the-underdog',
      'every-last-page': 'the-completionist',
      'matching-finally': 'the-collector',
      'gold-fever': 'the-affluent',
      'you-sold-what': 'the-regretful',
      'boots-on-the-board': 'the-persistent',
      'out-of-office': 'the-wayfarer',
      'night-shift': 'the-vigilant',
      'local-expert': 'beast-knower',
      'the-wheel-is-honest': 'the-fortunate',
      'punching-upward': 'giant-slayer',
      'ten-of-ten-thirty-times': 'the-relentless',
      'twenty-eight-for-twenty-eight': 'the-devout',
      'meter-pegged': 'the-patient',
      'fifty-wishes': 'wishful-thinker',
      'rematch-denied': 'the-humbled',
      'the-cat-decides': 'cat-person',
      'read-the-whole-thing': 'the-scholar',
    };
    for (const [id, titleId] of Object.entries(expected)) {
      expect(getAchievement(id).titleId, id).toBe(titleId);
    }
    // …and nothing else hands out a title.
    const titled = ACHIEVEMENTS.filter((a) => a.titleId).map((a) => a.id).sort();
    expect(titled).toEqual(Object.keys(expected).sort());
  });
});

describe('getAchievement', () => {
  it('returns the definition by id', () => {
    expect(getAchievement('gold-fever').category).toBe('economy');
  });

  it('throws on an unknown id', () => {
    expect(() => getAchievement('become-the-innkeeper')).toThrow(/Unknown achievement/);
  });
});
