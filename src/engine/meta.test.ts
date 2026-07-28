/**
 * The meta layer's spine (GAME_DESIGN §12–13): the stat ledger, the metric
 * resolver, quest period-deltas, the Activity meter and the story's
 * independent chapters.
 */
import { describe, expect, it } from 'vitest';
import { getQuest } from '@/content/quests';
import { CHAPTERS, getStep } from '@/content/story';
import { fightArena } from './arena';
import { attemptFloor } from './dungeons';
import {
  activityTotal,
  canClaimActivityChest,
  canSwapDaily,
  claimActivityChest,
  claimQuest,
  ensureQuestBoard,
  questComplete,
  questProgress,
  swapDaily,
} from './quests';
import { bump, countPrefixed, flag, recordMonster } from './ledger';
import { metricValue } from './metrics';
import { createNewSave, deriveEmblem } from './newSave';
import { chapterProgress, chapterUnlocked, claimStep, currentStep, stepComplete } from './story';
import { applyDailyReset } from './timePassage';
import type { GameSave } from './types';

const T0 = new Date(2026, 6, 28, 9, 0).getTime();

function fresh(level = 20): GameSave {
  const save = createNewSave(
    {
      name: 'Ledger',
      classId: 'warrior',
      emblem: deriveEmblem('Ledger', 'warrior'),
      worldSeed: 'aa'.repeat(16),
    },
    T0,
  );
  save.hero.level = level;
  save.hero.attrsBought = { str: 300, dex: 120, int: 30, con: 240, lck: 120 };
  return save;
}

describe('the stat ledger', () => {
  it('counts, raises high-water marks and reads back set-like flags', () => {
    const save = fresh();
    bump(save, 'missionsCompleted', 3);
    bump(save, 'missionsCompleted');
    expect(save.stats.missionsCompleted).toBe(4);
    flag(save, 'localeVisited', 'pinewatch');
    flag(save, 'localeVisited', 'pinewatch'); // idempotent
    flag(save, 'localeVisited', 'crystal-ruins');
    expect(countPrefixed(save, 'localeVisited')).toBe(2);
  });

  it('tallies a real fight: crits, blocks, evades all land on the hero', () => {
    const save = fresh();
    const outcome = fightArena(save, 0, T0);
    const events = outcome.result.rounds.flatMap((r) => r.events);
    const heroCrits = events.filter((e) => e.attacker === 0 && e.outcome === 'crit').length;
    const foeBlocked = events.filter((e) => e.attacker === 1 && e.outcome === 'blocked').length;
    expect(save.stats.crits ?? 0).toBe(heroCrits);
    expect(save.stats.blocks ?? 0).toBe(foeBlocked);
    expect(save.stats.arenaFights).toBe(1);
  });

  it('records dungeon feats: an out-levelled boss counts as a giant slain', () => {
    const save = fresh(13);
    save.hero.attrsBought = { str: 900, dex: 300, int: 60, con: 700, lck: 300 };
    const outcome = attemptFloor(save, 'rat-cellars', T0);
    expect(outcome.won).toBe(true);
    expect(save.stats.dungeonFloors).toBe(1);
    // Floor 1 of D1 is ~L14 against a level-13 hero: not a giant, so no credit.
    expect(save.stats.bossesOutlevelled ?? 0).toBe(0);
  });

  it('a monster met is a monster remembered (bestiary + lifetime tally)', () => {
    const save = fresh();
    recordMonster(save, 'hedge-goblin', 4);
    recordMonster(save, 'hedge-goblin');
    expect(save.progress.codex.monstersSeen['hedge-goblin']).toBe(5);
    expect(save.stats.monstersSlain).toBe(5);
  });
});

describe('the metric resolver', () => {
  it('passes raw counters through and derives the rest', () => {
    const save = fresh(37);
    bump(save, 'arenaWins', 12);
    expect(metricValue(save, 'arenaWins')).toBe(12);
    expect(metricValue(save, 'level')).toBe(37);
    expect(metricValue(save, 'attrTotalBought')).toBe(300 + 120 + 30 + 240 + 120);
    save.progress.dungeonFloors['rat-cellars'] = 7;
    expect(metricValue(save, 'dungeonFloors:rat-cellars')).toBe(7);
    expect(metricValue(save, 'dungeonFloors:pale-court')).toBe(0);
    flag(save, 'localeVisited', 'pinewatch');
    expect(metricValue(save, 'expeditionLocalesVisited')).toBe(1);
  });

  it('story chapters only count when all five steps are done', () => {
    const save = fresh();
    save.progress.story['1'] = 5;
    save.progress.story['2'] = 3;
    expect(metricValue(save, 'storyChapter')).toBe(1);
    expect(metricValue(save, 'storyStep')).toBe(8);
  });
});

describe('quests', () => {
  it('rolls a stable, level-appropriate board and re-rolls only when empty', () => {
    const save = fresh(20);
    const board = ensureQuestBoard(save, 'daily');
    expect(board).toHaveLength(3);
    expect(ensureQuestBoard(save, 'daily').map((q) => q.id)).toEqual(board.map((q) => q.id));
    for (const quest of board) {
      expect(quest.cadence).toBe('daily');
      expect(quest.minLevel ?? 1).toBeLessThanOrEqual(20);
    }
    // A level-1 hero is never handed a dungeon or forge quest.
    const rookie = fresh(1);
    for (const quest of ensureQuestBoard(rookie, 'daily')) {
      expect(quest.minLevel ?? 1).toBeLessThanOrEqual(1);
    }
  });

  it('progress is a period delta, so pre-existing totals never pre-complete it', () => {
    const save = fresh();
    bump(save, 'missionsCompleted', 500); // a long career already behind us
    applyDailyReset(save, T0 + 86_400_000); // snapshot taken here
    const board = ensureQuestBoard(save, 'daily');
    for (const quest of board) expect(questProgress(save, quest)).toBe(0);

    const missionQuest = getQuest('daily-missions-6');
    save.daily.questIds = [missionQuest.id, ...board.slice(1).map((q) => q.id)];
    bump(save, 'missionsCompleted', 6);
    expect(questProgress(save, missionQuest)).toBe(6);
    expect(questComplete(save, missionQuest)).toBe(true);
  });

  it('claiming pays out once, fills the Activity meter and opens the chest', () => {
    const save = fresh();
    applyDailyReset(save, T0 + 86_400_000);
    const quest = getQuest('daily-missions-6');
    save.daily.questIds = [quest.id];
    bump(save, 'missionsCompleted', 6);

    const goldBefore = save.hero.gold;
    const claim = claimQuest(save, quest.id, T0);
    expect(claim.reward.gold).toBeGreaterThan(0);
    expect(save.hero.gold).toBeGreaterThan(goldBefore);
    expect(save.stats.questsCompleted).toBe(1);
    expect(() => claimQuest(save, quest.id, T0)).toThrow(/not claimable/);
    expect(activityTotal(save)).toBeGreaterThanOrEqual(quest.activity ?? 0);

    // Meter full → the chest opens exactly once.
    save.daily.activity = 100;
    expect(canClaimActivityChest(save)).toBe(true);
    const chest = claimActivityChest(save, T0);
    expect(chest.gold).toBeGreaterThan(0);
    expect(save.stats.dailyChestsOpened).toBe(1);
    expect(canClaimActivityChest(save)).toBe(false);
  });

  it('the core loop trickles into the meter on its own', () => {
    const save = fresh();
    applyDailyReset(save, T0 + 86_400_000);
    expect(activityTotal(save)).toBe(0);
    bump(save, 'missionsCompleted', 10);
    bump(save, 'expeditions', 2);
    expect(activityTotal(save)).toBeGreaterThan(0);
    expect(activityTotal(save)).toBeLessThanOrEqual(100);
  });

  it('one daily may be swapped, once, and never a claimed one', () => {
    const save = fresh(20);
    const board = ensureQuestBoard(save, 'daily');
    const target = board[0]!;
    expect(canSwapDaily(save, target.id)).toBe(true);
    const replacement = swapDaily(save, target.id);
    expect(save.daily.questIds).toContain(replacement.id);
    expect(save.daily.questIds).not.toContain(target.id);
    expect(canSwapDaily(save, save.daily.questIds[1]!)).toBe(false); // spent
  });

  it('a daily reset re-snapshots the ledger and clears the slate', () => {
    const save = fresh();
    ensureQuestBoard(save, 'daily');
    bump(save, 'missionsCompleted', 4);
    applyDailyReset(save, T0 + 86_400_000);
    expect(save.daily.questIds).toEqual([]);
    expect(save.daily.questsClaimed).toEqual([]);
    expect(save.daily.statsAt.missionsCompleted).toBe(4);
    expect(save.daily.activityChestClaimed).toBe(false);
    expect(save.daily.questSwapUsed).toBe(false);
  });
});

describe('the story', () => {
  it('chapters gate by level and advance independently', () => {
    const save = fresh(45);
    expect(chapterUnlocked(save, 1)).toBe(true);
    expect(chapterUnlocked(save, 6)).toBe(true);
    expect(chapterUnlocked(save, 7)).toBe(false); // L70
    // Chapter 5 stalling on pets does not block chapter 6.
    save.progress.story['5'] = 1;
    expect(currentStep(save, 6)?.chapter).toBe(6);
  });

  it('a completed step claims once, pays out and moves the chapter on', () => {
    const save = fresh(12);
    const step = getStep(1, 1);
    expect(step.chapter).toBe(1);
    // Chapter 1 step 1 is a narrative beat: arriving at the gate completes it.
    expect(stepComplete(save, step)).toBe(true);
    const claim = claimStep(save, 1, T0);
    expect(claim.step.step).toBe(1);
    expect(chapterProgress(save, 1)).toBe(1);
    expect(currentStep(save, 1)?.step).toBe(2);
  });

  it('finales hand over their chapter title', () => {
    const finale = getStep(1, 5);
    expect(finale.reward.titleId).toBe('newly-signed');
    for (const chapter of CHAPTERS) {
      expect(getStep(chapter.chapter, 5).reward.titleId).toBeTruthy();
    }
  });
});
