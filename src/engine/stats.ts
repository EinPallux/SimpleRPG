/** Derived hero stats (BALANCING.md §3.1, §5.2). */
import { getClass } from '@/content/classes';
import { CAP_CRIT_DMG_BONUS, CAP_GOLD_FIND, CAP_XP_BONUS } from './constants';
import type { AttributeId, GameSave, ItemInstance } from './types';
import { baseAttribute } from './newSave';

function equippedItems(save: GameSave): ItemInstance[] {
  return Object.values(save.inventory.equipped).filter((i): i is ItemInstance => Boolean(i));
}

/** Attribute total: class start + bought + gear lines (+achievements from M6). */
export function totalAttribute(save: GameSave, attr: AttributeId): number {
  let total = baseAttribute(save, attr);
  for (const item of equippedItems(save)) {
    for (const line of item.lines) {
      if (line.attr === attr || line.attr === 'all') total += line.value;
    }
  }
  return total;
}

/** Percent bonuses from gear, engine-capped (BALANCING §5.2). Values are fractions. */
export function gearPercents(save: GameSave): { critDmg: number; goldFind: number; xp: number } {
  let critDmg = 0;
  let goldFind = 0;
  let xp = 0;
  for (const item of equippedItems(save)) {
    for (const line of item.lines) {
      if (line.attr === 'critDmg') critDmg += line.value / 100;
      else if (line.attr === 'goldFind') goldFind += line.value / 100;
      else if (line.attr === 'xp') xp += line.value / 100;
    }
  }
  return {
    critDmg: Math.min(CAP_CRIT_DMG_BONUS, critDmg),
    goldFind: Math.min(CAP_GOLD_FIND, goldFind),
    xp: Math.min(CAP_XP_BONUS, xp),
  };
}

/** maxHP = CON_total × hpFactor(class) × (level + 1) */
export function heroMaxHp(save: GameSave): number {
  const cls = getClass(save.hero.classId);
  return Math.round(totalAttribute(save, 'con') * cls.hpFactor * (save.hero.level + 1));
}
