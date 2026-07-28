/**
 * The scripted first run (GAME_DESIGN.md §17), engine side.
 *
 * Like quests and the story, a step's completion is a pure read of the stat
 * ledger — so the tutorial can never desync from what the player actually did,
 * and closing the tab mid-step loses nothing.
 *
 * The design rule this module exists to enforce: **skipping is free**. §17
 * promises the veteran's door "grants identical rewards instantly", which means
 * the tutorial must never be the source of a reward. It isn't: every beat asks
 * the player to use a system that pays them normally. `skipOnboarding` therefore
 * has nothing to grant — it only stops pointing.
 */
import {
  getOnboardingStep,
  hasTour,
  ONBOARDING_DONE,
  ONBOARDING_STEPS,
  type OnboardingStep,
} from '@/content/onboarding';
import { metricValue } from './metrics';
import type { MetricId } from '@/content/meta';
import type { GameSave } from './types';

export { ONBOARDING_DONE, ONBOARDING_STEPS };

export function onboardingIndex(save: GameSave): number {
  return save.progress.onboarding.step;
}

export function onboardingComplete(save: GameSave): boolean {
  return onboardingIndex(save) >= ONBOARDING_DONE;
}

/** The step being pointed at right now, or null once the town is open. */
export function currentOnboardingStep(save: GameSave): OnboardingStep | null {
  if (onboardingComplete(save)) return null;
  return getOnboardingStep(onboardingIndex(save));
}

/**
 * Has the player satisfied the current step? `acknowledge` steps are finished
 * by the button, so they are never "already satisfied" — everything else is a
 * ledger read.
 */
export function stepSatisfied(save: GameSave, step: OnboardingStep): boolean {
  if (step.goal.kind === 'acknowledge') return false;
  return metricValue(save, step.goal.metric as MetricId) >= step.goal.target;
}

/** Advance past the current step. Idempotent at the end of the sequence. */
export function advanceOnboarding(save: GameSave): void {
  if (onboardingComplete(save)) return;
  save.progress.onboarding.step += 1;
}

/**
 * "I've been here before." Jumps to the end and records that it happened, so
 * the Codex/achievement layer can tell a veteran from a graduate. Grants
 * nothing, because the tutorial never withheld anything (see the module note).
 */
export function skipOnboarding(save: GameSave): void {
  save.progress.onboarding.step = ONBOARDING_DONE;
  save.progress.onboarding.skipped = true;
}

// ---------------------------------------------------------------------------
// Contextual tours
// ---------------------------------------------------------------------------

/**
 * Should this screen show its 15-second tour? Only once per hero, only for
 * screens that have something to say, and never while the scripted sequence is
 * still running — one pointing finger at a time.
 */
export function tourDue(save: GameSave, screen: string): boolean {
  if (!hasTour(screen)) return false;
  if (!onboardingComplete(save)) return false;
  return !save.progress.toursSeen.includes(screen);
}

export function markTourSeen(save: GameSave, screen: string): void {
  if (!save.progress.toursSeen.includes(screen)) save.progress.toursSeen.push(screen);
}
