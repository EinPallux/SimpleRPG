/**
 * The four classes of Aethermoor (GAME_DESIGN.md §3.3, CONTENT_CATALOG.md §2).
 * Starting spreads are attribute order STR/DEX/INT/CON/LCK from the catalog.
 * Combat signature constants join in M1 with the combat engine.
 */
import { z } from 'zod';
import type { AttributeId, ClassId } from '@/engine/types';

export interface ClassDef {
  id: ClassId;
  mainAttr: AttributeId;
  hpFactor: number;
  armorMult: number;
  startAttrs: Record<AttributeId, number>;
  /** icon id in the sprite (validated by content tests) */
  icon: string;
  /** default emblem icon for new heroes of this class */
  emblemIcon: string;
  /** CSS custom property carrying the class color (UI_DESIGN.md §2) */
  colorVar: string;
}

export const classSchema = z.object({
  id: z.enum(['warrior', 'scout', 'mage', 'assassin']),
  mainAttr: z.enum(['str', 'dex', 'int', 'con', 'lck']),
  hpFactor: z.number().positive(),
  armorMult: z.number().positive(),
  startAttrs: z.object({
    str: z.number().int().positive(),
    dex: z.number().int().positive(),
    int: z.number().int().positive(),
    con: z.number().int().positive(),
    lck: z.number().int().positive(),
  }),
  icon: z.string().min(1),
  emblemIcon: z.string().min(1),
  colorVar: z.string().startsWith('--c-'),
});

export const CLASSES: readonly ClassDef[] = [
  {
    id: 'warrior',
    mainAttr: 'str',
    hpFactor: 5.0,
    armorMult: 1.5,
    startAttrs: { str: 12, dex: 8, int: 6, con: 12, lck: 7 },
    icon: 'warrior',
    emblemIcon: 'warrior',
    colorVar: '--c-warrior',
  },
  {
    id: 'scout',
    mainAttr: 'dex',
    hpFactor: 4.0,
    armorMult: 1.0,
    startAttrs: { str: 8, dex: 12, int: 6, con: 10, lck: 9 },
    icon: 'scout',
    emblemIcon: 'scout',
    colorVar: '--c-scout',
  },
  {
    id: 'mage',
    mainAttr: 'int',
    hpFactor: 2.0,
    armorMult: 0.6,
    startAttrs: { str: 6, dex: 7, int: 14, con: 8, lck: 10 },
    icon: 'mage',
    emblemIcon: 'mage',
    colorVar: '--c-mage',
  },
  {
    id: 'assassin',
    mainAttr: 'dex',
    hpFactor: 3.5,
    armorMult: 0.85,
    startAttrs: { str: 7, dex: 13, int: 7, con: 9, lck: 9 },
    icon: 'assassin',
    emblemIcon: 'assassin',
    colorVar: '--c-assassin',
  },
];

export const CLASS_IDS = CLASSES.map((c) => c.id);

export function getClass(id: ClassId): ClassDef {
  const def = CLASSES.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown class: ${id}`);
  return def;
}
