/** Derived hero stats (BALANCING.md §3.1, §5.2, set tiers §4.6). */
import { getClass } from '@/content/classes';
import { CAP_CRIT_DMG_BONUS, CAP_GOLD_FIND, CAP_XP_BONUS } from './constants';
import { codexBonuses } from './codex';
import { potionPercent } from './potions';
import { setAggregate } from './sets';
import type { AttributeId, GameSave, ItemInstance } from './types';
import { baseAttribute } from './newSave';

function equippedItems(save: GameSave): ItemInstance[] {
  return Object.values(save.inventory.equipped).filter((i): i is ItemInstance => Boolean(i));
}

/**
 * Attribute total: (class start + bought + gear lines) × elixir % × set %.
 * Expired potions are pruned by catch-up (≤30 s staleness by design;
 * TECHNICAL_ARCHITECTURE §6). Achievements bonuses join in M6.
 */
export function totalAttribute(save: GameSave, attr: AttributeId): number {
  let total = baseAttribute(save, attr);
  for (const item of equippedItems(save)) {
    for (const line of item.lines) {
      if (line.attr === attr || line.attr === 'all') total += line.value;
    }
  }
  const setPct = setAggregate(save).attrPct[attr];
  return Math.round(total * (1 + potionPercent(save, attr)) * (1 + setPct));
}

/**
 * Percent bonuses from gear lines, set tiers and completed Codex pages,
 * engine-capped (BALANCING §5.2/§6). Values are fractions.
 */
export function gearPercents(save: GameSave): { critDmg: number; goldFind: number; xp: number } {
  const sets = setAggregate(save);
  const codex = codexBonuses(save);
  let critDmg = sets.critDmgPct / 100;
  let goldFind = sets.goldPct + codex.goldFind;
  let xp = sets.xpPct + codex.xp;
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

/** maxHP = CON_total × hpFactor(class) × (level + 1), × set HP bonus. */
export function heroMaxHp(save: GameSave): number {
  const cls = getClass(save.hero.classId);
  const hpPct = setAggregate(save).hpPct;
  return Math.round(
    totalAttribute(save, 'con') * cls.hpFactor * (save.hero.level + 1) * (1 + hpPct),
  );
}
