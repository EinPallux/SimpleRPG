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
import { gearPercents, heroMaxHp, totalAttribute } from './stats';
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

/** Build the hero's fighter from save state (gear, class kit, percent-line caps). */
export function heroToCombatant(save: GameSave): Combatant {
  const cls = getClass(save.hero.classId);
  const sig = classSignature(save.hero.classId);
  const pct = gearPercents(save);

  const weaponItem = save.inventory.equipped.weapon;
  const offhandItem = save.inventory.equipped.offhand;
  const armor = Object.values(save.inventory.equipped).reduce(
    (sum, item) => sum + (item ? itemArmor(item) : 0),
    0,
  );

  const weapon = weaponItem ? weaponDamage(weaponItem) : unarmed(save.hero.level);
  const offhandWeapon =
    save.hero.classId === 'assassin' && offhandItem ? weaponDamage(offhandItem) : undefined;

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
    armor,
    weapon,
    ...(offhandWeapon ? { offhandWeapon } : {}),
    blockChance: Math.min(CAP_BLOCK, sig.blockChance),
    evadeChance: Math.min(CAP_EVADE, sig.evadeChance),
    unblockable: sig.unblockable,
    strikes: sig.strikes,
    strikeMult: sig.strikeMult,
    dmgMult: sig.dmgMult,
    critCap: sig.critCap,
    critMult: Math.min(sig.critMult + CAP_CRIT_DMG_BONUS, sig.critMult + pct.critDmg),
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
