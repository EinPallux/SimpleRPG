/** XP application with level-ups and zone-frontier unlocks. Mutates the save draft. */
import { frontierZoneIndex } from '@/content/zones';
import type { GameSave } from './types';
import { xpToNext } from './xp';

export interface XpResult {
  gained: number;
  levelsGained: number;
  newLevel: number;
  zonesUnlocked: number;
}

export function applyXp(save: GameSave, amount: number): XpResult {
  if (amount < 0) throw new Error('xp amount must be >= 0');
  save.hero.xp += amount;
  let levels = 0;
  while (save.hero.xp >= xpToNext(save.hero.level)) {
    save.hero.xp -= xpToNext(save.hero.level);
    save.hero.level += 1;
    levels += 1;
  }
  const frontier = frontierZoneIndex(save.hero.level);
  if (frontier > save.progress.zonesUnlocked) save.progress.zonesUnlocked = frontier;
  return {
    gained: amount,
    levelsGained: levels,
    newLevel: save.hero.level,
    zonesUnlocked: save.progress.zonesUnlocked,
  };
}
