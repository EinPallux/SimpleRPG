/**
 * The Bestiary (CONTENT_CATALOG.md §4, GAME_DESIGN.md §13): eighty named
 * monsters, eight per zone, ten zones — the codex's biggest page.
 *
 * This module is pure data. Two systems read it:
 *  - `engine/missions.ts` treats every completed mission as a *sighting* and
 *    draws a random resident of that zone (`monstersOfZone`), so the codex
 *    fills from where the hero actually goes;
 *  - `engine/expeditions.ts` names the foe on a fight card by matching the
 *    card's archetype against the hero's frontier zone (`monstersOfArchetype`),
 *    which is why every zone carries at least one grunt/swift/caster/brute.
 *
 * Archetypes mirror the combat flags in BALANCING §4 (elite = the zone's
 * headline act, exactly one per zone, always the last entry). Names, ids and
 * archetypes are canonical in CONTENT_CATALOG §4 — do not re-mix them here.
 *
 * Strings live in `src/i18n/parts/bestiary.json` (invariant 8): `monster.{id}`
 * is the display name, `monster.{id}.lore` is the one-line codex entry that
 * unlocks at `LORE_KILL_THRESHOLD` kills (meta.ts).
 */
import { monsterSchema, type MonsterArchetype, type MonsterDef } from './meta';

/** Re-exported so consumers validate against the one shared contract. */
export { monsterSchema };
export type { MonsterArchetype, MonsterDef };

function m(id: string, zoneIndex: number, archetype: MonsterArchetype): MonsterDef {
  return { id, zoneIndex, archetype, nameKey: `monster.${id}` };
}

export const MONSTERS: readonly MonsterDef[] = [
  // --- Zone 1 · Bramblewood -------------------------------------------------
  m('hedge-goblin', 1, 'grunt'),
  m('cranky-boar', 1, 'brute'),
  m('twig-sprite', 1, 'swift'),
  m('bramble-wolf', 1, 'grunt'),
  m('mushroom-truant', 1, 'grunt'),
  m('apprentice-poacher', 1, 'swift'),
  m('bee-wizards-swarm', 1, 'caster'),
  m('tobbin-the-toll-troll', 1, 'elite'),

  // --- Zone 2 · Millhaven Fields --------------------------------------------
  m('scarecrow-awoken', 2, 'grunt'),
  m('field-bandit', 2, 'swift'),
  m('rogue-ram', 2, 'brute'),
  m('crow-conspiracy', 2, 'swift'),
  m('turnip-golem', 2, 'brute'),
  m('hedge-witch', 2, 'caster'),
  m('tax-collector', 2, 'grunt'),
  m('old-man-mangel', 2, 'elite'),

  // --- Zone 3 · Blossomvale -------------------------------------------------
  m('pollen-imp', 3, 'swift'),
  m('thorn-dancer', 3, 'swift'),
  m('honey-slime', 3, 'brute'),
  m('petal-charmer', 3, 'caster'),
  m('hiveguard-drone', 3, 'grunt'),
  m('garden-gnome-ultra', 3, 'grunt'),
  m('wasp-baroness', 3, 'swift'),
  m('the-overgrown-groundskeeper', 3, 'elite'),

  // --- Zone 4 · Deepwood Watch ----------------------------------------------
  m('shade-lurker', 4, 'swift'),
  m('timber-ghoul', 4, 'grunt'),
  m('watchfire-wisp', 4, 'caster'),
  m('owlbear-cub-sitter', 4, 'brute'),
  m('web-matron', 4, 'swift'),
  m('deserter-ranger', 4, 'swift'),
  m('moss-troll', 4, 'brute'),
  m('the-toll-trolls-lawyer', 4, 'elite'),

  // --- Zone 5 · Saltmere Coast ----------------------------------------------
  m('dock-rat-king-let', 5, 'grunt'),
  m('brine-zombie', 5, 'grunt'),
  m('gull-tyrant', 5, 'swift'),
  m('smuggler-first-mate', 5, 'swift'),
  m('tidecaller', 5, 'caster'),
  m('barnacle-brute', 5, 'brute'),
  m('lighthouse-poltergeist', 5, 'caster'),
  m('captain-undertow', 5, 'elite'),

  // --- Zone 6 · Sunscorch Mesa ----------------------------------------------
  m('dust-devilkin', 6, 'swift'),
  m('sun-baked-bandito', 6, 'grunt'),
  m('cactus-shambler', 6, 'brute'),
  m('vulture-auger', 6, 'caster'),
  m('mesa-stalker', 6, 'swift'),
  m('clay-colossus', 6, 'brute'),
  m('mirage-twin', 6, 'caster'),
  m('sheriff-of-nowhere', 6, 'elite'),

  // --- Zone 7 · The Ashen Reach ---------------------------------------------
  m('ash-revenant', 7, 'grunt'),
  m('cinder-hound', 7, 'swift'),
  m('monument-golem', 7, 'brute'),
  m('bone-chanter', 7, 'caster'),
  m('grief-wraith', 7, 'caster'),
  m('blackglass-duelist', 7, 'swift'),
  m('ash-choked-giant', 7, 'brute'),
  m('the-last-standard-bearer', 7, 'elite'),

  // --- Zone 8 · Cinderpeak --------------------------------------------------
  m('magma-whelp', 8, 'swift'),
  m('obsidian-sentry', 8, 'brute'),
  m('fire-cultist', 8, 'caster'),
  m('lava-leaper', 8, 'swift'),
  m('smoke-shade', 8, 'caster'),
  m('basalt-ogre', 8, 'brute'),
  m('war-drum-imp', 8, 'grunt'),
  m('kiln-marshal-vorr', 8, 'elite'),

  // --- Zone 9 · Frostveil Summit --------------------------------------------
  m('frost-wight', 9, 'grunt'),
  m('icicle-lancer', 9, 'swift'),
  m('blizzard-hare', 9, 'swift'),
  m('rime-chanter', 9, 'caster'),
  m('frozen-sentinel', 9, 'brute'),
  m('avalanche-spirit', 9, 'brute'),
  m('aurora-wisp', 9, 'caster'),
  m('warden-of-the-white-stair', 9, 'elite'),

  // --- Zone 10 · Duskgate ---------------------------------------------------
  m('pale-courtier', 10, 'swift'),
  m('gloom-herald', 10, 'caster'),
  m('dusk-knight', 10, 'brute'),
  m('star-eaten-scholar', 10, 'caster'),
  m('veil-assassin', 10, 'swift'),
  m('twilight-mass', 10, 'brute'),
  m('lantern-snuffer', 10, 'grunt'),
  m('herald-of-the-pale-king', 10, 'elite'),
];

/** 80 — the codex denominator (`engine/metrics.ts`). */
export const MONSTER_COUNT = MONSTERS.length;

/** Every zone carries exactly this many residents (CONTENT §4). */
export const MONSTERS_PER_ZONE = 8;

// --- Indexes (built once; the pools are hot paths in missions/expeditions) ---

const BY_ID = new Map<string, MonsterDef>();
const BY_ZONE = new Map<number, MonsterDef[]>();
const BY_ZONE_ARCHETYPE = new Map<string, MonsterDef[]>();

for (const monster of MONSTERS) {
  BY_ID.set(monster.id, monster);
  const zonePool = BY_ZONE.get(monster.zoneIndex);
  if (zonePool) zonePool.push(monster);
  else BY_ZONE.set(monster.zoneIndex, [monster]);
  const key = `${monster.zoneIndex}:${monster.archetype}`;
  const pool = BY_ZONE_ARCHETYPE.get(key);
  if (pool) pool.push(monster);
  else BY_ZONE_ARCHETYPE.set(key, [monster]);
}

const EMPTY: readonly MonsterDef[] = [];

/** The eight residents of a zone, in catalog order. Unknown zone → empty. */
export function monstersOfZone(zoneIndex: number): readonly MonsterDef[] {
  return BY_ZONE.get(zoneIndex) ?? EMPTY;
}

/**
 * Residents of a zone matching a fight card's archetype (expeditions §16).
 * Never empty for grunt/swift/caster/brute in zones 1..10; 'elite' returns the
 * single headline monster. Unknown zone → empty (callers fall back to a
 * nameless foe rather than crashing a run).
 */
export function monstersOfArchetype(
  zoneIndex: number,
  archetype: MonsterArchetype,
): readonly MonsterDef[] {
  return BY_ZONE_ARCHETYPE.get(`${zoneIndex}:${archetype}`) ?? EMPTY;
}

/** Lookup by id; throws on unknown ids so bad content fails loudly. */
export function getMonster(id: string): MonsterDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Unknown monster: ${id}`);
  return def;
}

/** The zone's elite — one per zone, the last entry of its block. */
export function eliteOfZone(zoneIndex: number): MonsterDef | undefined {
  return monstersOfArchetype(zoneIndex, 'elite')[0];
}

// --- i18n key helpers (CONTENT §13) ----------------------------------------

export function monsterNameKey(id: string): string {
  return `monster.${id}`;
}

/** Codex lore — revealed at LORE_KILL_THRESHOLD kills (meta.ts). */
export function monsterLoreKey(id: string): string {
  return `monster.${id}.lore`;
}
