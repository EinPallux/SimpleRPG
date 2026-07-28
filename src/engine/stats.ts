/** Derived hero stats (BALANCING.md §3.1). Gear/potion/achievement bonuses join in M3/M6. */
import { getClass } from '@/content/classes';
import type { GameSave } from './types';
import { baseAttribute } from './newSave';

/** maxHP = CON_total × hpFactor(class) × (level + 1) */
export function heroMaxHp(save: GameSave): number {
  const cls = getClass(save.hero.classId);
  return Math.round(baseAttribute(save, 'con') * cls.hpFactor * (save.hero.level + 1));
}
