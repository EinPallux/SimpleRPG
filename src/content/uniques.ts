/**
 * The eight legendary uniques (CONTENT_CATALOG.md §6.2).
 *
 * These are the only items in the game with a NAME rather than a generated
 * one, and the only ones whose effect is bespoke rather than a stat line. That
 * makes them the long tail's punchline: a set is a project, a unique is a
 * story you tell about the night it dropped.
 *
 * Design rules the shape enforces:
 *  - **One of each, ever.** `uniqueId` on the item instance is the identity;
 *    the drop path refuses to hand over one already owned, so "all eight" is a
 *    reachable goal rather than a lottery you can lose to duplicates.
 *  - **Effects reuse the machinery that already exists.** Six of the eight map
 *    onto hooks the set system or the economy already reads (reflect-on-block,
 *    evade, shop discount…), so a unique adds no new special case to combat.
 *  - **They are not strictly better.** Each is a sidegrade with a personality:
 *    the Ladle reflects but is a plain weapon otherwise; the Crown scales with
 *    level rather than with item level. A unique should be a *choice*.
 *  - **…and never strictly worse.** `minLevel` gates when one may drop; it is
 *    NOT the item level. The piece rolls at the level of the legendary it
 *    replaced, so finding one is never a downgrade for a high-level hero — see
 *    engine/items.ts `generateUnique`.
 */
import { z } from 'zod';
import type { ClassId, EquipSlot } from '@/engine/types';

/**
 * What a unique does. Every kind is read by exactly one consumer, named in the
 * comment, so adding a unique never means hunting for where effects apply.
 */
export type UniqueEffect =
  /** engine/patrol.ts — gold banked per tick */
  | { kind: 'patrolGold'; pct: number }
  /** engine/combatants.ts → combat's first-strike hook */
  | { kind: 'firstStrikeAlwaysCrit' }
  /** engine/combatants.ts → the same hook the Bulwark set uses */
  | { kind: 'blockReflect'; pct: number }
  /** engine/combatants.ts — scales the weapon range */
  | { kind: 'weaponDmgPct'; pct: number }
  /** engine/combatants.ts — added to evade, still under CAP_EVADE */
  | { kind: 'evadePP'; pp: number }
  /** engine/shops.ts — stacks with a pet's discount, under the same cap */
  | { kind: 'shopDiscount'; pct: number }
  /** engine/wheel.ts — percentage points added to the gem slot's share */
  | { kind: 'wheelGemPP'; pp: number }
  /** engine/stats.ts — flat attributes per N hero levels, so it never retires */
  | { kind: 'attrPerLevels'; per: number };

export interface UniqueDef {
  id: string;
  slot: EquipSlot;
  /** null = any class can wear it */
  classId: ClassId | null;
  /** hero level from which this one may drop — a gate, never the item level */
  minLevel: number;
  effect: UniqueEffect;
  /** i18n base key — `unique.{id}.name` + `.blurb` */
  nameKey: string;
}

export const UNIQUES: readonly UniqueDef[] = [
  {
    id: 'kettle-of-endless-soup',
    slot: 'talisman',
    classId: null,
    minLevel: 30,
    effect: { kind: 'patrolGold', pct: 0.25 },
    nameKey: 'unique.kettle-of-endless-soup',
  },
  {
    id: 'snickering-dagger',
    slot: 'offhand',
    classId: 'assassin',
    minLevel: 45,
    effect: { kind: 'firstStrikeAlwaysCrit' },
    nameKey: 'unique.snickering-dagger',
  },
  {
    id: 'grandmas-battle-ladle',
    slot: 'weapon',
    classId: 'warrior',
    minLevel: 40,
    effect: { kind: 'blockReflect', pct: 0.08 },
    nameKey: 'unique.grandmas-battle-ladle',
  },
  {
    id: 'polite-grimoire',
    slot: 'offhand',
    classId: 'mage',
    minLevel: 45,
    effect: { kind: 'weaponDmgPct', pct: 0.12 },
    nameKey: 'unique.polite-grimoire',
  },
  {
    id: 'boots-of-somewhere-else',
    slot: 'boots',
    classId: null,
    minLevel: 50,
    effect: { kind: 'evadePP', pp: 8 },
    nameKey: 'unique.boots-of-somewhere-else',
  },
  {
    id: 'gilded-iou',
    slot: 'amulet',
    classId: null,
    minLevel: 35,
    effect: { kind: 'shopDiscount', pct: 0.15 },
    nameKey: 'unique.gilded-iou',
  },
  {
    id: 'wheelwrights-lucky-spoke',
    slot: 'ring',
    classId: null,
    minLevel: 35,
    effect: { kind: 'wheelGemPP', pp: 4 },
    nameKey: 'unique.wheelwrights-lucky-spoke',
  },
  {
    id: 'crown-of-the-understudy',
    slot: 'helmet',
    classId: null,
    minLevel: 55,
    effect: { kind: 'attrPerLevels', per: 10 },
    nameKey: 'unique.crown-of-the-understudy',
  },
];

export const UNIQUE_COUNT: number = UNIQUES.length;

export function getUnique(id: string): UniqueDef {
  const def = UNIQUES.find((u) => u.id === id);
  if (!def) throw new Error(`Unknown unique: ${id}`);
  return def;
}

export function uniqueOrNull(id: string | undefined): UniqueDef | null {
  if (!id) return null;
  return UNIQUES.find((u) => u.id === id) ?? null;
}

/**
 * The uniques in play at a given level. `level` applies the `minLevel` gate, so
 * the eight arrive spread across the climb rather than all being reachable from
 * the first jackpot; omit it for the full set (the Codex does this).
 *
 * This used to filter by class as well, on the reasoning that a legendary you
 * can never equip is worse than no drop. Two things killed that: gear is no
 * longer class-locked (engine/inventoryOps.ts), and the filter quietly made the
 * *"all eight"* achievement impossible — only five uniques are classless, so a
 * warrior topped out at six and a scout, who has no unique cut for them at all,
 * at five. A goal nobody can finish is worse than an off-class drop.
 *
 * `classId` on a def now means only "who this was made for", which is what its
 * stat lines are slanted toward.
 */
export function availableUniques(level?: number): readonly UniqueDef[] {
  return UNIQUES.filter((u) => level === undefined || level >= u.minLevel);
}

export function uniqueNameKey(id: string): string {
  return `unique.${id}.name`;
}
export function uniqueBlurbKey(id: string): string {
  return `unique.${id}.blurb`;
}

export const uniqueSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    slot: z.string(),
    classId: z.enum(['warrior', 'scout', 'mage', 'assassin']).nullable(),
    minLevel: z.number().int().positive(),
    effect: z.object({ kind: z.string() }).passthrough(),
    nameKey: z.string(),
  })
  .strict();
