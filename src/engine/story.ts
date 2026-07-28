/**
 * "The Ballad of Brambleford" (GAME_DESIGN.md §12.1, content in
 * `content/story.ts`): 8 chapters × 5 steps.
 *
 * Chapters gate by LEVEL and advance INDEPENDENTLY; steps inside a chapter are
 * linear. That keeps a later chapter reachable when an earlier one is waiting
 * on a system that hasn't unlocked yet (chapter 5 needs pets — M7), instead of
 * stalling the whole questline behind one beat.
 *
 * Like quests, a step's completion is a pure read of the stat ledger — the
 * story can never desync from what the hero actually did.
 */
import { CHAPTERS, getStep, STORY_STEPS, stepsOfChapter } from '@/content/story';
import type { StoryStepDef } from '@/content/meta';
import { metricValue } from './metrics';
import { grantReward, type GrantedReward } from './rewards';
import type { GameSave } from './types';

/** Steps completed in a chapter (0..5). */
export function chapterProgress(save: GameSave, chapter: number): number {
  return save.progress.story[String(chapter)] ?? 0;
}

export function chapterUnlocked(save: GameSave, chapter: number): boolean {
  const def = CHAPTERS.find((c) => c.chapter === chapter);
  return def !== undefined && save.hero.level >= def.minLevel;
}

/** The step a chapter is currently working on, or null when it is finished. */
export function currentStep(save: GameSave, chapter: number): StoryStepDef | null {
  const done = chapterProgress(save, chapter);
  if (done >= 5) return null;
  return getStep(chapter, done + 1);
}

export function stepGoalProgress(save: GameSave, step: StoryStepDef): number {
  return metricValue(save, step.goal.metric);
}

export function stepComplete(save: GameSave, step: StoryStepDef): boolean {
  if (save.hero.level < step.minLevel) return false;
  return stepGoalProgress(save, step) >= step.goal.target;
}

/** The chapter the banner should show: the earliest unlocked, unfinished one. */
export function activeChapter(save: GameSave): number | null {
  const open = CHAPTERS.filter((c) => chapterUnlocked(save, c.chapter));
  const unfinished = open.find((c) => chapterProgress(save, c.chapter) < 5);
  // Everything unlocked is finished → show the last unlocked chapter's epilogue.
  return unfinished?.chapter ?? open[open.length - 1]?.chapter ?? null;
}

/** Every chapter that has a claimable step waiting right now. */
export function claimableChapters(save: GameSave): number[] {
  return CHAPTERS.filter((c) => {
    if (!chapterUnlocked(save, c.chapter)) return false;
    const step = currentStep(save, c.chapter);
    return step !== null && stepComplete(save, step);
  }).map((c) => c.chapter);
}

export interface StoryClaim {
  step: StoryStepDef;
  reward: GrantedReward;
  /** true when this claim finished the chapter */
  chapterComplete: boolean;
}

export function canClaimStep(save: GameSave, chapter: number): boolean {
  if (!chapterUnlocked(save, chapter)) return false;
  const step = currentStep(save, chapter);
  return step !== null && stepComplete(save, step);
}

/** Bank a finished step: pay it out and advance the chapter's pointer. */
export function claimStep(save: GameSave, chapter: number, nowMs: number): StoryClaim {
  if (!canClaimStep(save, chapter)) throw new Error(`Chapter ${chapter} has nothing to claim`);
  const step = currentStep(save, chapter)!;
  save.progress.story[String(chapter)] = chapterProgress(save, chapter) + 1;
  const reward = grantReward(save, step.reward, nowMs);
  return { step, reward, chapterComplete: chapterProgress(save, chapter) >= 5 };
}

/** Total steps done across the whole ballad (0..40) — the codex/README number. */
export function storyTotalSteps(save: GameSave): number {
  return CHAPTERS.reduce((sum, c) => sum + chapterProgress(save, c.chapter), 0);
}

export const TOTAL_STORY_STEPS = STORY_STEPS.length;
export { CHAPTERS, stepsOfChapter };
