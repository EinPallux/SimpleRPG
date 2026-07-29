/** Builders that turn heroes and enemy archetypes into combat-ready fighters. */
import { getClass } from '@/content/classes';
import {
  ARCHETYPE_TEMPLATES,
  ASSASSIN_STRIKES,
  ASSASSIN_STRIKE_MULT,
  BLOCK_WARRIOR,
  CAP_BLOCK,
  CAP_CRIT_DMG_BONUS,
  CAP_EVADE,
  CRIT_CAP,
  CRIT_CAP_ASSASSIN,
  CRIT_MULT,
  CRIT_MULT_SCOUT,
  EVADE_ASSASSIN,
  EVADE_SCOUT,
  MAGE_DMG_MULT,
  UNARMED_DAMAGE,
  type ArchetypeId,
} from './constants';
import type { Combatant } from './combat';
import { itemArmor, weaponDamage } from './items';
import { parArmor, parCon, parMainAttr, parOffAttr } from './par';
import { setAggregate } from './sets';
import {
  armorMultiplier,
  gearPercents,
  heroMaxHp,
  petEvade,
  totalAttribute,
  uniqueEvade,
} from './stats';
import { hasUniqueFlag, uniqueTotal } from './uniques';
import type { ClassId, GameSave } from './types';

interface ClassSignature {
  blockChance: number;
  evadeChance: number;
  unblockable: boolean;
  strikes: number;
  strikeMult: number;
  dmgMult: number;
  critCap: number;
  critMult: number;
}

export function classSignature(classId: ClassId): ClassSignature {
  switch (classId) {
    case 'warrior':
      return {
        blockChance: BLOCK_WARRIOR,
        evadeChance: 0,
        unblockable: false,
        strikes: 1,
        strikeMult: 1,
        dmgMult: 1,
        critCap: CRIT_CAP,
        critMult: CRIT_MULT,
      };
    case 'scout':
      return {
        blockChance: 0,
        evadeChance: EVADE_SCOUT,
        unblockable: false,
        strikes: 1,
        strikeMult: 1,
        dmgMult: 1,
        critCap: CRIT_CAP,
        critMult: CRIT_MULT_SCOUT,
      };
    case 'mage':
      return {
        blockChance: 0,
        evadeChance: 0,
        unblockable: true,
        strikes: 1,
        strikeMult: 1,
        dmgMult: MAGE_DMG_MULT,
        critCap: CRIT_CAP,
        critMult: CRIT_MULT,
      };
    case 'assassin':
      return {
        blockChance: 0,
        evadeChance: EVADE_ASSASSIN,
        unblockable: false,
        strikes: ASSASSIN_STRIKES,
        strikeMult: ASSASSIN_STRIKE_MULT,
        dmgMult: 1,
        critCap: CRIT_CAP_ASSASSIN,
        critMult: CRIT_MULT,
      };
  }
}

function unarmed(level: number): { min: number; max: number } {
  return { min: UNARMED_DAMAGE[0], max: UNARMED_DAMAGE[1] + Math.floor(level / 3) };
}

/** Scale a damage range by a fraction, keeping min ≤ max and both ≥ 1. */
function scaleWeapon(
  weapon: { min: number; max: number },
  pct: number,
): { min: number; max: number } {
  if (pct === 0) return weapon;
  return {
    min: Math.max(1, Math.round(weapon.min * (1 + pct))),
    max: Math.max(1, Math.round(weapon.max * (1 + pct))),
  };
}

/** Build the hero's fighter from save state (gear, class kit, set tiers §4.6). */
export function heroToCombatant(save: GameSave): Combatant {
  const cls = getClass(save.hero.classId);
  const sig = classSignature(save.hero.classId);
  const pct = gearPercents(save);
  const sets = setAggregate(save);

  const weaponItem = save.inventory.equipped.weapon;
  const offhandItem = save.inventory.equipped.offhand;
  const armor = Object.values(save.inventory.equipped).reduce(
    (sum, item) => sum + (item ? itemArmor(item) : 0),
    0,
  );

  // The Polite Grimoire adds its damage on the same multiplier the sets use.
  const weapon = scaleWeapon(
    weaponItem ? weaponDamage(weaponItem) : unarmed(save.hero.level),
    sets.weaponDmgPct + uniqueTotal(save, 'weaponDmgPct'),
  );
  const offhandWeapon =
    save.hero.classId === 'assassin' && offhandItem
      ? scaleWeapon(weaponDamage(offhandItem), sets.weaponDmgPct)
      : undefined;

  // Full-set combat behaviors → Combatant flags (engine/combat.ts hooks).
  const fx: Partial<Combatant> = {};
  let strikeMult = sig.strikeMult;
  for (const effect of sets.effects) {
    switch (effect.kind) {
      case 'healOnBlock':
        fx.healOnBlockPct = effect.pctMaxHp;
        break;
      case 'afterBlockNextHit':
        fx.afterBlockNextHitMult = effect.mult;
        break;
      case 'reflectOnBlock':
        fx.reflectOnBlockPct = effect.pct;
        break;
      case 'afterEvadeCrit':
        fx.afterEvadeCrit = true;
        break;
      case 'firstStrike':
        fx.firstStrikeOverride = true;
        fx.firstStrikeDmgMult = effect.bonusDmg;
        break;
      case 'everyNthStrike':
        fx.everyNthStrike = { n: effect.n, mult: effect.mult };
        break;
      case 'enemyDrCap':
        fx.enemyDrCap = effect.cap;
        break;
      case 'offhandMult':
        strikeMult = effect.mult;
        break;
      case 'poisonOnCrit':
        fx.poisonOnCrit = { pct: effect.pct, rounds: effect.rounds };
        break;
      case 'doubleCritBonus':
        fx.doubleCritBonusMult = effect.mult;
        break;
      default:
        break; // economy effects (missionItemPP, expedition) live outside combat
    }
  }

  // Grandma's Battle Ladle reflects on a block — the same hook the Bulwark set
  // uses, so combat needs no new branch. The Snickering Dagger crits its first
  // strike, which is what `firstStrikeDmgMult` on an overridden first strike
  // already means.
  const ladle = uniqueTotal(save, 'blockReflect');
  if (ladle > 0) fx.reflectOnBlockPct = (fx.reflectOnBlockPct ?? 0) + ladle;
  if (hasUniqueFlag(save, 'firstStrikeAlwaysCrit')) {
    fx.firstStrikeOverride = true;
    fx.firstStrikeDmgMult = Math.max(fx.firstStrikeDmgMult ?? 0, sig.critMult);
  }

  return {
    id: 'hero',
    name: save.hero.name,
    level: save.hero.level,
    mainAttr: cls.mainAttr,
    attrs: {
      str: totalAttribute(save, 'str'),
      dex: totalAttribute(save, 'dex'),
      int: totalAttribute(save, 'int'),
      con: totalAttribute(save, 'con'),
      lck: totalAttribute(save, 'lck'),
    },
    maxHp: heroMaxHp(save),
    armor: Math.round(armor * armorMultiplier(save)),
    weapon,
    ...(offhandWeapon ? { offhandWeapon } : {}),
    blockChance: Math.min(CAP_BLOCK, sig.blockChance + sets.blockPP / 100),
    evadeChance: Math.min(
      CAP_EVADE,
      sig.evadeChance + sets.evadePP / 100 + petEvade(save) + uniqueEvade(save),
    ),
    unblockable: sig.unblockable,
    strikes: sig.strikes,
    strikeMult,
    dmgMult: sig.dmgMult,
    critCap: Math.max(sig.critCap, sets.critCap ?? 0),
    critMult: Math.min(sig.critMult + CAP_CRIT_DMG_BONUS, sig.critMult + pct.critDmg),
    ...(sets.critPP > 0 ? { critBonus: sets.critPP / 100 } : {}),
    ...fx,
  };
}

/** Enemy at a target level from a BALANCING §4 archetype template. */
export function archetypeCombatant(
  archetype: ArchetypeId,
  level: number,
  opts?: { id?: string; name?: string; mainAttr?: Combatant['mainAttr'] },
): Combatant {
  const tpl = ARCHETYPE_TEMPLATES[archetype];
  const main = Math.round(parMainAttr(level) * tpl.attr);
  const off = parOffAttr(level);
  const mainAttr = opts?.mainAttr ?? 'str';
  const con = parCon(level);
  const mid = 3 + 2.2 * level; // enemy "weapon" tracks the item curve at ilvl = level

  const attrs = { str: off, dex: off, int: off, con, lck: Math.round(off * 0.8) };
  attrs[mainAttr] = main;

  return {
    id: opts?.id ?? `${archetype}-${level}`,
    name: opts?.name ?? `${archetype}-${level}`,
    level,
    mainAttr,
    attrs,
    maxHp: Math.round(con * 4.0 * (level + 1) * tpl.hp),
    armor: Math.round(parArmor(level) * tpl.armor),
    weapon: { min: Math.round(mid * 0.85), max: Math.round(mid * 1.15) },
    blockChance: 0,
    evadeChance: tpl.evade,
    unblockable: tpl.unblockable,
    strikes: 1,
    strikeMult: 1,
    dmgMult: 1,
    critCap: CRIT_CAP,
    critMult: CRIT_MULT,
    brute: tpl.brute,
    critBonus: tpl.critBonus,
  };
}
