/**
 * Dungeons (GAME_DESIGN.md §15, CONTENT_CATALOG.md §5): five key-gated wings,
 * ten named floor bosses each — the stat walls that pace the mid-game.
 * Boss numbers come from BALANCING §4 formulas; the `trait` layers an
 * archetype flag (swift/caster/brute/elite) on top for variety.
 * M5 note: dungeons gate by level; story-chapter keys join in M6.
 */
import { z } from 'zod';
import type { ClassId } from '@/engine/types';

export type BossTrait = 'none' | 'swift' | 'caster' | 'brute' | 'elite';

export interface BossDef {
  /** slug unique across all dungeons (codex + i18n key base `boss.{slug}`) */
  slug: string;
  trait: BossTrait;
}

/** What floors 5 & 10 drop (BALANCING §4.6): a class set or an any-class set. */
export type SetPool =
  | { kind: 'class'; level: 20 | 60 | 100 }
  | { kind: 'fixed'; setId: string; pityClassLevel: 20 | 60 };

export interface DungeonDef {
  id: string;
  nameKey: string;
  unlockLevel: number;
  /** entry level Ld — floor target levels ramp from here (§4) */
  entryLevel: number;
  /** the next dungeon's entry (or final clear window end) — the ramp target */
  nextLevel: number;
  setPool: SetPool;
  bosses: readonly BossDef[]; // exactly 10, floors 1..10
}

function b(slug: string, trait: BossTrait): BossDef {
  return { slug, trait };
}

export const DUNGEONS: readonly DungeonDef[] = [
  {
    id: 'rat-cellars',
    nameKey: 'dungeon.rat-cellars',
    unlockLevel: 12,
    entryLevel: 12,
    nextLevel: 25,
    setPool: { kind: 'class', level: 20 },
    bosses: [
      b('squeaker', 'none'),
      b('twitchwhisker', 'swift'),
      b('cheese-baron', 'none'),
      b('gnawbone', 'brute'),
      b('rattigan-prime', 'elite'),
      b('under-butler', 'none'),
      b('mold-king-sporus', 'caster'),
      b('whiskered-widow', 'swift'),
      b('tunnel-tyrant', 'brute'),
      b('rat-kings-rat', 'elite'),
    ],
  },
  {
    id: 'sunken-crypt',
    nameKey: 'dungeon.sunken-crypt',
    unlockLevel: 25,
    entryLevel: 25,
    nextLevel: 45,
    setPool: { kind: 'fixed', setId: 'innkeepers-regalia', pityClassLevel: 20 },
    bosses: [
      b('barnacle-bishop', 'caster'),
      b('damp-deacon', 'none'),
      b('coffin-bobber', 'swift'),
      b('silt-prophet', 'caster'),
      b('abbess-of-algae', 'elite'),
      b('pickled-knight', 'brute'),
      b('choir-of-bubbles', 'caster'),
      b('reliquary-crab', 'brute'),
      b('drowned-sexton', 'none'),
      b('saint-mildew', 'elite'),
    ],
  },
  {
    id: 'ironroot-hollows',
    nameKey: 'dungeon.ironroot-hollows',
    unlockLevel: 45,
    entryLevel: 45,
    nextLevel: 70,
    setPool: { kind: 'class', level: 60 },
    bosses: [
      b('root-bound-golem', 'brute'),
      b('sap-countess', 'caster'),
      b('burrow-baron', 'none'),
      b('compost-horror', 'brute'),
      b('ironbark-alpha', 'elite'),
      b('gilded-beetle', 'swift'),
      b('fungal-parliament', 'caster'),
      b('tremor-worm', 'brute'),
      b('deep-gardener', 'none'),
      b('heartwood-regent', 'elite'),
    ],
  },
  {
    id: 'obsidian-spire',
    nameKey: 'dungeon.obsidian-spire',
    unlockLevel: 70,
    entryLevel: 70,
    nextLevel: 95,
    setPool: { kind: 'fixed', setId: 'twilight-wanderer', pityClassLevel: 60 },
    bosses: [
      b('glasswork-sentinel', 'none'),
      b('mirror-twin', 'swift'),
      b('stair-warden', 'none'),
      b('volcanic-scribe', 'caster'),
      b('archivist-of-ash', 'elite'),
      b('smoke-chamberlain', 'caster'),
      b('molten-aviary', 'swift'),
      b('spire-inquisitor', 'elite'),
      b('penultimate-door', 'brute'),
      b('magnus-vitrified', 'elite'),
    ],
  },
  {
    id: 'pale-court',
    nameKey: 'dungeon.pale-court',
    unlockLevel: 95,
    entryLevel: 95,
    nextLevel: 130,
    setPool: { kind: 'class', level: 100 },
    bosses: [
      b('gatekeeper-morrow', 'brute'),
      b('bone-sommelier', 'none'),
      b('pale-jester', 'swift'),
      b('twin-regents', 'elite'),
      b('queens-echo', 'caster'),
      b('master-of-hounds', 'brute'),
      b('unlit-chandelier', 'caster'),
      b('chancellor-vane', 'none'),
      b('kings-conscience', 'caster'),
      b('the-pale-king', 'elite'),
    ],
  },
];

export const bossSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    trait: z.enum(['none', 'swift', 'caster', 'brute', 'elite']),
  })
  .strict();

export const dungeonSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    nameKey: z.string(),
    unlockLevel: z.number().int().positive(),
    entryLevel: z.number().int().positive(),
    nextLevel: z.number().int().positive(),
    setPool: z.union([
      z.object({ kind: z.literal('class'), level: z.union([z.literal(20), z.literal(60), z.literal(100)]) }).strict(),
      z
        .object({
          kind: z.literal('fixed'),
          setId: z.string(),
          pityClassLevel: z.union([z.literal(20), z.literal(60)]),
        })
        .strict(),
    ]),
    bosses: z.array(bossSchema).length(10),
  })
  .strict();

export function getDungeon(id: string): DungeonDef {
  const def = DUNGEONS.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown dungeon: ${id}`);
  return def;
}

/** Boss target level for floor f (1..10): Lt = Ld + ceil(f × (next − Ld) / 11). */
export function floorLevel(dungeon: DungeonDef, floor: number): number {
  return dungeon.entryLevel + Math.ceil((floor * (dungeon.nextLevel - dungeon.entryLevel)) / 11);
}

/** i18n key helpers (CONTENT §13: `boss.{slug}.name` / `.intro`). */
export function bossNameKey(slug: string): string {
  return `boss.${slug}.name`;
}
export function bossIntroKey(slug: string): string {
  return `boss.${slug}.intro`;
}

/** All 50 slugs — codex + validation convenience. */
export function allBossSlugs(): string[] {
  return DUNGEONS.flatMap((d) => d.bosses.map((boss) => boss.slug));
}

/** Convenience for UI: the class the set pool would pay out for this hero. */
export function dungeonSetForClass(dungeon: DungeonDef, classId: ClassId): string {
  if (dungeon.setPool.kind === 'fixed') return dungeon.setPool.setId;
  const level = dungeon.setPool.level;
  const byClass: Record<ClassId, string> = {
    warrior: level === 20 ? 'bulwark-boar' : level === 60 ? 'ironroot-sentinel' : 'aegis-molten-king',
    scout: level === 20 ? 'thicket-stalker' : level === 60 ? 'galewind-pathfinder' : 'eyes-silent-wood',
    mage: level === 20 ? 'apprentices-folly' : level === 60 ? 'tidebound-scholar' : 'regalia-hollow-star',
    assassin: level === 20 ? 'alleycats-guise' : level === 60 ? 'duskveil-shroud' : 'masque-pale-king',
  };
  return byClass[classId];
}
