/**
 * Item sets (CONTENT_CATALOG.md §6.1, values per BALANCING §5): the chase.
 * 12 class sets (L20/L60/L100 × 4 classes) + 2 any-class sets. Dungeons drop
 * them on floors 5 & 10 (M5); the Wishing Well rolls them too (M7).
 * Piece slots: 4-pc = helm/chest/gloves/boots · 5-pc adds weapon · 6-pc belt.
 */
import { z } from 'zod';
import type { AttributeId, ClassId, EquipSlot } from '@/engine/types';

/** Additive stat package (fractions for %, "PP" = percentage points). */
export interface SetStatBonus {
  attrPct?: Partial<Record<AttributeId, number>>;
  allAttrPct?: number;
  armorPct?: number;
  hpPct?: number;
  weaponDmgPct?: number;
  critDmgPct?: number;
  critPP?: number;
  blockPP?: number;
  evadePP?: number;
  /** absolute crit-cap override (takes the max with the class cap) */
  critCap?: number;
  goldPct?: number;
  xpPct?: number;
}

/** Full-set special behaviors — combat hooks live in engine/combat.ts. */
export type SetSpecialEffect =
  | { kind: 'healOnBlock'; pctMaxHp: number }
  | { kind: 'afterBlockNextHit'; mult: number }
  | { kind: 'reflectOnBlock'; pct: number }
  | { kind: 'afterEvadeCrit' }
  | { kind: 'firstStrike'; bonusDmg: number }
  | { kind: 'everyNthStrike'; n: number; mult: number }
  | { kind: 'enemyDrCap'; cap: number }
  | { kind: 'offhandMult'; mult: number }
  | { kind: 'poisonOnCrit'; pct: number; rounds: number }
  | { kind: 'doubleCritBonus'; mult: number }
  | { kind: 'missionItemPP'; pp: number }
  | { kind: 'expedition'; heroism: number; extraDaily: number };

export interface SetDef {
  id: string;
  nameKey: string;
  classId: ClassId | null;
  /** item level of every piece in the set */
  level: number;
  slots: readonly EquipSlot[];
  two: SetStatBonus;
  four?: SetStatBonus;
  full: { bonus?: SetStatBonus; effect?: SetSpecialEffect };
}

const FOUR: readonly EquipSlot[] = ['helmet', 'chest', 'gloves', 'boots'];
const FIVE: readonly EquipSlot[] = [...FOUR, 'weapon'];
const SIX: readonly EquipSlot[] = [...FIVE, 'belt'];

export const SETS: readonly SetDef[] = [
  // — Warrior —
  {
    id: 'bulwark-boar',
    nameKey: 'set.bulwark-boar',
    classId: 'warrior',
    level: 20,
    slots: FOUR,
    two: { armorPct: 0.1 },
    full: { bonus: { blockPP: 5 }, effect: { kind: 'healOnBlock', pctMaxHp: 0.02 } },
  },
  {
    id: 'ironroot-sentinel',
    nameKey: 'set.ironroot-sentinel',
    classId: 'warrior',
    level: 60,
    slots: FIVE,
    two: { attrPct: { str: 0.08 } },
    four: { armorPct: 0.15 },
    full: { effect: { kind: 'afterBlockNextHit', mult: 1.4 } },
  },
  {
    id: 'aegis-molten-king',
    nameKey: 'set.aegis-molten-king',
    classId: 'warrior',
    level: 100,
    slots: SIX,
    two: { attrPct: { str: 0.1 } },
    four: { attrPct: { con: 0.1 } },
    full: { effect: { kind: 'reflectOnBlock', pct: 0.3 } },
  },
  // — Scout —
  {
    id: 'thicket-stalker',
    nameKey: 'set.thicket-stalker',
    classId: 'scout',
    level: 20,
    slots: FOUR,
    two: { attrPct: { dex: 0.06 } },
    full: { bonus: { evadePP: 3 } },
  },
  {
    id: 'galewind-pathfinder',
    nameKey: 'set.galewind-pathfinder',
    classId: 'scout',
    level: 60,
    slots: FIVE,
    two: { attrPct: { dex: 0.08 } },
    four: { critDmgPct: 15 },
    full: { effect: { kind: 'afterEvadeCrit' } },
  },
  {
    id: 'eyes-silent-wood',
    nameKey: 'set.eyes-silent-wood',
    classId: 'scout',
    level: 100,
    slots: SIX,
    two: { attrPct: { dex: 0.1 } },
    four: { attrPct: { lck: 0.12 } },
    full: { effect: { kind: 'firstStrike', bonusDmg: 0.25 } },
  },
  // — Mage —
  {
    id: 'apprentices-folly',
    nameKey: 'set.apprentices-folly',
    classId: 'mage',
    level: 20,
    slots: FOUR,
    two: { attrPct: { int: 0.06 } },
    full: { bonus: { weaponDmgPct: 0.08 } },
  },
  {
    id: 'tidebound-scholar',
    nameKey: 'set.tidebound-scholar',
    classId: 'mage',
    level: 60,
    slots: FIVE,
    two: { attrPct: { int: 0.08 } },
    four: { hpPct: 0.12 },
    full: { effect: { kind: 'everyNthStrike', n: 4, mult: 1.6 } },
  },
  {
    id: 'regalia-hollow-star',
    nameKey: 'set.regalia-hollow-star',
    classId: 'mage',
    level: 100,
    slots: SIX,
    two: { attrPct: { int: 0.1 } },
    four: { critPP: 5 },
    full: { effect: { kind: 'enemyDrCap', cap: 0.35 } },
  },
  // — Assassin —
  {
    id: 'alleycats-guise',
    nameKey: 'set.alleycats-guise',
    classId: 'assassin',
    level: 20,
    slots: FOUR,
    two: { attrPct: { dex: 0.06 } },
    full: { effect: { kind: 'offhandMult', mult: 0.7 } },
  },
  {
    id: 'duskveil-shroud',
    nameKey: 'set.duskveil-shroud',
    classId: 'assassin',
    level: 60,
    slots: FIVE,
    two: { attrPct: { dex: 0.08 } },
    four: { evadePP: 5 },
    full: { effect: { kind: 'poisonOnCrit', pct: 0.12, rounds: 2 } },
  },
  {
    id: 'masque-pale-king',
    nameKey: 'set.masque-pale-king',
    classId: 'assassin',
    level: 100,
    slots: SIX,
    two: { attrPct: { dex: 0.1 } },
    four: { critCap: 0.65 },
    full: { effect: { kind: 'doubleCritBonus', mult: 2 } },
  },
  // — Any class —
  {
    id: 'innkeepers-regalia',
    nameKey: 'set.innkeepers-regalia',
    classId: null,
    level: 40,
    slots: FIVE,
    two: { goldPct: 0.1 },
    four: { xpPct: 0.08 },
    full: { effect: { kind: 'missionItemPP', pp: 7 } },
  },
  {
    id: 'twilight-wanderer',
    nameKey: 'set.twilight-wanderer',
    classId: null,
    level: 85,
    slots: SIX,
    two: { allAttrPct: 0.05 },
    four: { xpPct: 0.1 },
    full: { effect: { kind: 'expedition', heroism: 6, extraDaily: 1 } },
  },
];

const statBonusSchema = z
  .object({
    attrPct: z.record(z.enum(['str', 'dex', 'int', 'con', 'lck']), z.number()).optional(),
    allAttrPct: z.number().optional(),
    armorPct: z.number().optional(),
    hpPct: z.number().optional(),
    weaponDmgPct: z.number().optional(),
    critDmgPct: z.number().optional(),
    critPP: z.number().optional(),
    blockPP: z.number().optional(),
    evadePP: z.number().optional(),
    critCap: z.number().optional(),
    goldPct: z.number().optional(),
    xpPct: z.number().optional(),
  })
  .strict();

export const setSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    nameKey: z.string(),
    classId: z.enum(['warrior', 'scout', 'mage', 'assassin']).nullable(),
    level: z.number().int().positive(),
    slots: z.array(z.string()).min(4).max(6),
    two: statBonusSchema,
    four: statBonusSchema.optional(),
    full: z
      .object({
        bonus: statBonusSchema.optional(),
        effect: z.object({ kind: z.string() }).passthrough().optional(),
      })
      .strict(),
  })
  .strict();

export function getSet(id: string): SetDef {
  const def = SETS.find((s) => s.id === id);
  if (!def) throw new Error(`Unknown set: ${id}`);
  return def;
}

/** The four class sets at a given tier level (20/60/100). */
export function classSetAt(level: 20 | 60 | 100, classId: ClassId): SetDef {
  const def = SETS.find((s) => s.level === level && s.classId === classId);
  if (!def) throw new Error(`No class set at L${level} for ${classId}`);
  return def;
}
