/** Derived hero stats (BALANCING.md §3.1, §5.2, set tiers §4.6). */
import { getClass } from '@/content/classes';
import { CAP_CRIT_DMG_BONUS, CAP_GOLD_FIND, CAP_XP_BONUS } from './constants';
import { codexBonuses } from './codex';
import { auraTotal, collectionBonus } from './pets';
import { potionPercent } from './potions';
import { setAggregate } from './sets';
import type { AttributeId, GameSave, ItemInstance } from './types';
import { baseAttribute } from './newSave';

function equippedItems(save: GameSave): ItemInstance[] {
  return Object.values(save.inventory.equipped).filter((i): i is ItemInstance => Boolean(i));
}

/**
 * Attribute total:
 *   (class start + bought + gear lines) × elixir % × set % × menagerie %
 *
 * The menagerie bracket is the equipped pet's `attrPct` aura plus the
 * collection bonus (+0.5% per distinct pet owned, hard-capped at +8% —
 * GAME_DESIGN §11.1). It is its own multiplicative bracket rather than another
 * term inside the set bracket so the two never silently inflate each other, and
 * so BALANCING §6's "+8% all-attr (pet collection)" row is auditable as written.
 *
 * Expired potions are pruned by catch-up (≤30 s staleness by design;
 * TECHNICAL_ARCHITECTURE §6).
 */
export function totalAttribute(save: GameSave, attr: AttributeId): number {
  let total = baseAttribute(save, attr);
  for (const item of equippedItems(save)) {
    for (const line of item.lines) {
      if (line.attr === attr || line.attr === 'all') total += line.value;
    }
  }
  const setPct = setAggregate(save).attrPct[attr];
  const petPct = auraTotal(save, 'attrPct', attr) + collectionBonus(save);
  return Math.round(total * (1 + potionPercent(save, attr)) * (1 + setPct) * (1 + petPct));
}

/**
 * Percent bonuses from gear lines, set tiers, completed Codex pages and the
 * equipped pet, engine-capped (BALANCING §5.2/§6). Values are fractions.
 *
 * Pet auras sit INSIDE the same caps as everything else. A pet is a fifth
 * source of gold find, not an exemption from the ceiling on it — otherwise the
 * §6 economy audit stops meaning anything the moment the Menagerie opens.
 */
export function gearPercents(save: GameSave): { critDmg: number; goldFind: number; xp: number } {
  const sets = setAggregate(save);
  const codex = codexBonuses(save);
  let critDmg = sets.critDmgPct / 100 + auraTotal(save, 'critDmg');
  let goldFind = sets.goldPct + codex.goldFind + auraTotal(save, 'goldFind');
  let xp = sets.xpPct + codex.xp + auraTotal(save, 'xp');
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

/** maxHP = CON_total × hpFactor(class) × (level + 1), × set and pet HP bonuses. */
export function heroMaxHp(save: GameSave): number {
  const cls = getClass(save.hero.classId);
  const hpPct = setAggregate(save).hpPct + auraTotal(save, 'hpPct');
  return Math.round(
    totalAttribute(save, 'con') * cls.hpFactor * (save.hero.level + 1) * (1 + hpPct),
  );
}

/** Armour multiplier from sets and the equipped pet — combatants.ts applies it. */
export function armorMultiplier(save: GameSave): number {
  return 1 + setAggregate(save).armorPct + auraTotal(save, 'armorPct');
}

/** Extra evade from the equipped pet, as a fraction (the aura is in points). */
export function petEvade(save: GameSave): number {
  return auraTotal(save, 'evadePP') / 100;
}
