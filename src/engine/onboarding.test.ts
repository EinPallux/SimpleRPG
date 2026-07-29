/**
 * The scripted first run (GAME_DESIGN.md §17): the sequence is data, its
 * completion is a pure read of the stat ledger, and skipping is free.
 *
 * The content assertions at the bottom are the real guard rails — a step whose
 * copy is missing, or a tour pointing at a screen the rail has never heard of,
 * would ship as an empty overlay in front of a brand new player.
 */
import { describe, expect, it } from 'vitest';
import type { StatKey } from '@/content/meta';
import {
  getOnboardingStep,
  onboardingBodyKey,
  onboardingStepSchema,
  onboardingTitleKey,
  tourKey,
  TOUR_SCREENS,
} from '@/content/onboarding';
import { hasKey } from '@/i18n';
import type { ScreenId } from '@/state/store';
import { NAV_GROUPS } from '@/ui/nav';
import { bump } from './ledger';
import { isStatKey } from './metrics';
import { createNewSave, deriveEmblem } from './newSave';
import {
  advanceOnboarding,
  currentOnboardingStep,
  markTourSeen,
  onboardingComplete,
  onboardingIndex,
  ONBOARDING_DONE,
  ONBOARDING_STEPS,
  skipOnboarding,
  stepSatisfied,
  tourDue,
} from './onboarding';
import type { GameSave } from './types';
import { STARTING_GEMS } from './constants';

const T0 = new Date(2026, 6, 28, 9, 0).getTime();

function fresh(): GameSave {
  return createNewSave(
    {
      name: 'Newcomer',
      classId: 'warrior',
      emblem: deriveEmblem('Newcomer', 'warrior'),
      worldSeed: 'bb'.repeat(16),
    },
    T0,
  );
}

/** Every metric step, narrowed so the goal's fields are readable. */
const METRIC_STEPS = ONBOARDING_STEPS.flatMap((step) =>
  step.goal.kind === 'metric' ? [{ step, goal: step.goal }] : [],
);

describe('the scripted sequence', () => {
  it('starts a brand new hero at the cold open', () => {
    const save = fresh();
    expect(onboardingIndex(save)).toBe(0);
    expect(onboardingComplete(save)).toBe(false);
    expect(currentOnboardingStep(save)?.id).toBe('cold-open');
  });

  it('finishes an acknowledge step only when the player says so', () => {
    const save = fresh();
    const step = currentOnboardingStep(save)!;
    expect(step.goal.kind).toBe('acknowledge');
    // No amount of adventuring finishes a step that only asks to be read.
    bump(save, 'missionsCompleted', 99);
    bump(save, 'arenaFights', 99);
    expect(stepSatisfied(save, step)).toBe(false);

    advanceOnboarding(save);
    expect(currentOnboardingStep(save)?.id).toBe('first-mission');
  });

  it('walks the whole sequence and then stops pointing', () => {
    const save = fresh();
    for (let i = 0; i < ONBOARDING_STEPS.length; i++) {
      expect(currentOnboardingStep(save)).toBe(getOnboardingStep(i));
      advanceOnboarding(save);
    }
    expect(onboardingComplete(save)).toBe(true);
    expect(currentOnboardingStep(save)).toBeNull();

    // Idempotent at the end: a stray acknowledge cannot walk past the town.
    advanceOnboarding(save);
    expect(onboardingIndex(save)).toBe(ONBOARDING_DONE);
  });

  it('reads the ledger for every metric goal', () => {
    expect(METRIC_STEPS.map(({ goal }) => goal.metric)).toEqual([
      'missionsCompleted',
      'attrsBought',
      'arenaFights',
    ]);
    for (const { step, goal } of METRIC_STEPS) {
      expect(isStatKey(goal.metric)).toBe(true);
      const save = fresh();
      expect(stepSatisfied(save, step)).toBe(false);
      bump(save, goal.metric as StatKey, goal.target - 1);
      expect(stepSatisfied(save, step)).toBe(false);
      bump(save, goal.metric as StatKey);
      expect(stepSatisfied(save, step)).toBe(true);
    }
  });

  it('a metric step counts the deed done wherever it happened', () => {
    // The first mission finished on the tavern screen counts even if the mark
    // was never on screen — the ledger is the only source of truth.
    const save = fresh();
    save.progress.onboarding.step = 1;
    bump(save, 'missionsCompleted');
    expect(stepSatisfied(save, currentOnboardingStep(save)!)).toBe(true);
  });

  it('"I have been here before" jumps to the end and is recorded as such', () => {
    const save = fresh();
    skipOnboarding(save);
    expect(save.progress.onboarding.step).toBe(ONBOARDING_DONE);
    expect(save.progress.onboarding.skipped).toBe(true);
    expect(currentOnboardingStep(save)).toBeNull();
    // Skipping grants nothing, because the tutorial withheld nothing (§17).
    expect(save.hero.gold).toBe(fresh().hero.gold);
    expect(save.hero.gems).toBe(STARTING_GEMS);
  });
});

describe('contextual tours', () => {
  it('stay quiet while the scripted sequence is still pointing', () => {
    const save = fresh();
    for (const screen of TOUR_SCREENS) expect(tourDue(save, screen)).toBe(false);
  });

  it('fire once per screen for a graduate, then never again', () => {
    const save = fresh();
    skipOnboarding(save);
    expect(tourDue(save, 'arena')).toBe(true);

    markTourSeen(save, 'arena');
    markTourSeen(save, 'arena'); // idempotent — no duplicate rows in the save
    expect(save.progress.toursSeen).toEqual(['arena']);
    expect(tourDue(save, 'arena')).toBe(false);
    expect(tourDue(save, 'forge')).toBe(true);
  });

  it('never fire for a screen that explains itself', () => {
    const save = fresh();
    skipOnboarding(save);
    expect(tourDue(save, 'tavern')).toBe(false);
    expect(tourDue(save, 'character')).toBe(false);
  });
});

describe('the sequence as content', () => {
  it('validates against its schema and carries both halves of its copy', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(() => onboardingStepSchema.parse(step)).not.toThrow();
      expect(hasKey(onboardingTitleKey(step.id))).toBe(true);
      expect(hasKey(onboardingBodyKey(step.id))).toBe(true);
      expect(step.nameKey).toBe(`ob.${step.id}`);
    }
  });

  it('has unique ids, ends where ONBOARDING_DONE says, and lands on real screens', () => {
    const ids = ONBOARDING_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ONBOARDING_DONE).toBe(ONBOARDING_STEPS.length);

    const screens = new Set<string>(NAV_GROUPS.flatMap((g) => g.entries.map((e) => e.screen)));
    for (const step of ONBOARDING_STEPS) expect(screens.has(step.screen)).toBe(true);
  });

  it('gives every toured screen a paragraph and a place in the rail', () => {
    const screens = new Set<ScreenId>(NAV_GROUPS.flatMap((g) => g.entries.map((e) => e.screen)));
    expect(new Set(TOUR_SCREENS).size).toBe(TOUR_SCREENS.length);
    for (const screen of TOUR_SCREENS) {
      expect(hasKey(tourKey(screen))).toBe(true);
      expect(screens.has(screen as ScreenId)).toBe(true);
    }
  });

  it('keeps the chrome the overlays render around', () => {
    for (const key of ['ob.step', 'ob.skip', 'ob.next', 'tour.title', 'tour.dismiss']) {
      expect(hasKey(key)).toBe(true);
    }
  });
});
