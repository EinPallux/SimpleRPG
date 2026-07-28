/**
 * Story questline validation (CONTENT_CATALOG.md §9, GAME_DESIGN.md §12.1):
 * shape, gates, i18n coverage, title/screen referential integrity.
 */
import { describe, expect, it } from 'vitest';
import { hasKey } from '@/i18n';
import { NAV_GROUPS } from '@/ui/nav';
import { TITLE_IDS } from './titles';
import {
  CHAPTERS,
  chapterGate,
  getStep,
  STORY_STEPS,
  stepBodyKey,
  stepDoneKey,
  stepsOfChapter,
  stepTitleKey,
  storySchema,
  storyStepSchema,
} from './story';

/** Every ScreenId, sourced from the nav registry (which covers all 17). */
const SCREEN_IDS = new Set<string>(NAV_GROUPS.flatMap((g) => g.entries.map((e) => e.screen)));

const CHAPTER_GATES = [1, 10, 20, 25, 35, 45, 70, 95];
const FINALE_TITLES = [
  'newly-signed',
  'cellar-cleaner',
  'well-dressed',
  'the-damp',
  'friend-of-beasts',
  'the-rootbreaker',
  'glass-climber',
  'pale-kings-guest',
];

describe('story steps (M6)', () => {
  it('has 40 steps with unique (chapter, step) coordinates', () => {
    expect(STORY_STEPS).toHaveLength(40);
    const coords = STORY_STEPS.map((s) => `${s.chapter}.${s.step}`);
    expect(new Set(coords).size).toBe(40);
  });

  it('validates every step against the shared schema', () => {
    for (const s of STORY_STEPS) expect(() => storyStepSchema.parse(s)).not.toThrow();
    // storySchema is the module's re-export of the same contract
    expect(storySchema).toBe(storyStepSchema);
  });

  it('covers chapters 1..8 with exactly five ordered steps each', () => {
    expect(CHAPTERS).toHaveLength(8);
    for (let c = 1; c <= 8; c++) {
      const steps = stepsOfChapter(c);
      expect(steps).toHaveLength(5);
      expect(steps.map((s) => s.step)).toEqual([1, 2, 3, 4, 5]);
      for (const s of steps) expect(s.chapter).toBe(c);
    }
    expect(new Set(STORY_STEPS.map((s) => s.chapter))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
  });

  it('gates chapters at 1/10/20/25/35/45/70/95, strictly ascending', () => {
    expect(CHAPTERS.map((c) => c.minLevel)).toEqual(CHAPTER_GATES);
    for (let c = 1; c <= 8; c++) {
      expect(chapterGate(c)).toBe(CHAPTER_GATES[c - 1]);
      // step 1 of a chapter always sits exactly on the gate
      expect(getStep(c, 1).minLevel).toBe(CHAPTER_GATES[c - 1]);
    }
    for (let c = 2; c <= 8; c++) expect(chapterGate(c)).toBeGreaterThan(chapterGate(c - 1));
  });

  it('never lowers minLevel inside a chapter, and never below the gate', () => {
    for (let c = 1; c <= 8; c++) {
      const steps = stepsOfChapter(c);
      for (const s of steps) expect(s.minLevel).toBeGreaterThanOrEqual(chapterGate(c));
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i]!.minLevel).toBeGreaterThanOrEqual(steps[i - 1]!.minLevel);
      }
    }
  });

  it('uses the canonical keyBase and resolves .title/.body/.done for all 40', () => {
    for (const s of STORY_STEPS) {
      expect(s.keyBase).toBe(`story.c${s.chapter}.s${s.step}`);
      expect(hasKey(stepTitleKey(s))).toBe(true);
      expect(hasKey(stepBodyKey(s))).toBe(true);
      expect(hasKey(stepDoneKey(s))).toBe(true);
    }
  });

  it('names every chapter in i18n', () => {
    for (const c of CHAPTERS) {
      expect(c.nameKey).toBe(`story.c${c.chapter}.name`);
      expect(hasKey(c.nameKey)).toBe(true);
    }
  });

  it('awards the right chapter title on step 5 — and only there', () => {
    for (let c = 1; c <= 8; c++) {
      const steps = stepsOfChapter(c);
      for (const s of steps.slice(0, 4)) expect(s.reward.titleId).toBeUndefined();
      const finale = getStep(c, 5);
      expect(finale.reward.titleId).toBe(FINALE_TITLES[c - 1]);
      expect(TITLE_IDS).toContain(finale.reward.titleId);
      expect(hasKey(`title.${finale.reward.titleId}`)).toBe(true);
    }
  });

  it('pays finale gem purses that rise 5 → 25', () => {
    const purses = CHAPTERS.map((c) => getStep(c.chapter, 5).reward.gems);
    expect(purses).toEqual([5, 8, 10, 12, 15, 18, 20, 25]);
  });

  it('keeps non-finale purses modest (BALANCING §2.3 multipliers)', () => {
    for (const s of STORY_STEPS) {
      if (s.step === 5) continue;
      expect(s.reward.gems ?? 0).toBeLessThanOrEqual(3);
      expect(s.reward.gold ?? 0).toBeLessThanOrEqual(2);
      expect(s.reward.xp ?? 0).toBeLessThanOrEqual(2);
    }
  });

  it('deep-links only to real screens', () => {
    for (const s of STORY_STEPS) expect(SCREEN_IDS.has(s.screen)).toBe(true);
  });

  it('targets a positive goal on a known metric namespace', () => {
    const dungeonIds = new Set(['rat-cellars', 'sunken-crypt', 'ironroot-hollows', 'obsidian-spire', 'pale-court']);
    for (const s of STORY_STEPS) {
      expect(s.goal.target).toBeGreaterThan(0);
      if (s.goal.metric.startsWith('dungeonFloors:')) {
        expect(dungeonIds.has(s.goal.metric.slice('dungeonFloors:'.length))).toBe(true);
        expect(s.goal.target).toBeLessThanOrEqual(10);
      }
    }
  });

  it('never asks for less of a lifetime metric than an earlier step did', () => {
    // Goals read lifetime ledger values, so a repeated metric must ascend
    // across the whole questline (chapters progress independently).
    const seen = new Map<string, number>();
    const ordered = [...STORY_STEPS].sort((a, b) => a.chapter - b.chapter || a.step - b.step);
    for (const s of ordered) {
      if (s.goal.metric === 'arenaBestRank') continue; // LOWER_IS_BETTER
      const prev = seen.get(s.goal.metric);
      if (prev !== undefined) expect(s.goal.target).toBeGreaterThanOrEqual(prev);
      seen.set(s.goal.metric, s.goal.target);
    }
  });

  it('throws on unknown coordinates', () => {
    expect(() => getStep(9, 1)).toThrow();
    expect(() => getStep(1, 6)).toThrow();
    expect(() => chapterGate(0)).toThrow();
  });
});
