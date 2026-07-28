/**
 * Bestiary validation (CONTENT_CATALOG.md §4, GAME_DESIGN.md §13): shape,
 * per-zone census, archetype spread and i18n coverage for all 80 monsters.
 * The archetype-pool assertions are load-bearing — `engine/expeditions.ts`
 * names a fight card's foe by drawing from `monstersOfArchetype`.
 */
import { describe, expect, it } from 'vitest';
import { hasKey } from '@/i18n';
import type { MonsterArchetype } from './meta';
import { monsterSchema as sharedSchema } from './meta';
import {
  eliteOfZone,
  getMonster,
  MONSTER_COUNT,
  MONSTERS,
  MONSTERS_PER_ZONE,
  monsterLoreKey,
  monsterNameKey,
  monsterSchema,
  monstersOfArchetype,
  monstersOfZone,
} from './bestiary';

const ZONE_INDEXES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const FIGHTABLE: MonsterArchetype[] = ['grunt', 'swift', 'caster', 'brute'];
/** Strict kebab-case: lowercase words joined by single hyphens. */
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('bestiary (M6)', () => {
  it('holds exactly 80 monsters and reports the count', () => {
    expect(MONSTERS).toHaveLength(80);
    expect(MONSTER_COUNT).toBe(80);
  });

  it('gives every zone 1..10 exactly eight residents', () => {
    expect(MONSTERS_PER_ZONE).toBe(8);
    for (const zone of ZONE_INDEXES) {
      const residents = monstersOfZone(zone);
      expect(residents).toHaveLength(MONSTERS_PER_ZONE);
      for (const monster of residents) expect(monster.zoneIndex).toBe(zone);
    }
    expect(new Set(MONSTERS.map((m) => m.zoneIndex))).toEqual(new Set(ZONE_INDEXES));
  });

  it('uses unique kebab-case ids', () => {
    const ids = MONSTERS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(KEBAB);
  });

  it('validates every entry against the shared schema', () => {
    for (const monster of MONSTERS) expect(() => monsterSchema.parse(monster)).not.toThrow();
    // the re-export is the one contract from meta.ts, not a copy
    expect(monsterSchema).toBe(sharedSchema);
  });

  it('rejects malformed entries (schema is strict)', () => {
    expect(() => monsterSchema.parse({ ...MONSTERS[0]!, id: 'Hedge Goblin' })).toThrow();
    expect(() => monsterSchema.parse({ ...MONSTERS[0]!, zoneIndex: 11 })).toThrow();
    expect(() => monsterSchema.parse({ ...MONSTERS[0]!, archetype: 'boss' })).toThrow();
    expect(() => monsterSchema.parse({ ...MONSTERS[0]!, icon: 'x.png' })).toThrow();
  });

  it('crowns exactly one elite per zone, always the last entry', () => {
    for (const zone of ZONE_INDEXES) {
      const residents = monstersOfZone(zone);
      const elites = residents.filter((m) => m.archetype === 'elite');
      expect(elites).toHaveLength(1);
      expect(residents[residents.length - 1]!.archetype).toBe('elite');
      expect(eliteOfZone(zone)).toBe(elites[0]);
    }
    expect(MONSTERS.filter((m) => m.archetype === 'elite')).toHaveLength(10);
  });

  it('spreads archetypes plausibly: all four fight types in every zone, none dominant', () => {
    for (const zone of ZONE_INDEXES) {
      const residents = monstersOfZone(zone);
      for (const archetype of FIGHTABLE) {
        const pool = residents.filter((m) => m.archetype === archetype);
        expect(pool.length).toBeGreaterThanOrEqual(1);
        // 7 non-elite slots: no single archetype may swallow the zone
        expect(pool.length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('resolves a name and a lore line for every monster', () => {
    for (const monster of MONSTERS) {
      expect(monster.nameKey).toBe(`monster.${monster.id}`);
      expect(monster.nameKey).toBe(monsterNameKey(monster.id));
      expect(hasKey(monster.nameKey)).toBe(true);
      expect(hasKey(monsterLoreKey(monster.id))).toBe(true);
    }
  });

  it('keeps name and lore keys distinct — 160 strings, no collisions', () => {
    const keys = MONSTERS.flatMap((m) => [monsterNameKey(m.id), monsterLoreKey(m.id)]);
    expect(keys).toHaveLength(160);
    expect(new Set(keys).size).toBe(160);
  });

  it('draws archetype pools that match the zone and are never empty', () => {
    for (const zone of ZONE_INDEXES) {
      for (const archetype of FIGHTABLE) {
        const pool = monstersOfArchetype(zone, archetype);
        expect(pool.length).toBeGreaterThan(0);
        for (const monster of pool) {
          expect(monster.zoneIndex).toBe(zone);
          expect(monster.archetype).toBe(archetype);
        }
        // exactly the subset monstersOfZone would filter to
        expect(pool.map((m) => m.id)).toEqual(
          monstersOfZone(zone)
            .filter((m) => m.archetype === archetype)
            .map((m) => m.id),
        );
      }
      expect(monstersOfArchetype(zone, 'elite')).toHaveLength(1);
    }
  });

  it('returns empty pools for zones that do not exist rather than throwing', () => {
    expect(monstersOfZone(0)).toHaveLength(0);
    expect(monstersOfZone(11)).toHaveLength(0);
    expect(monstersOfArchetype(11, 'grunt')).toHaveLength(0);
    expect(eliteOfZone(11)).toBeUndefined();
  });

  it('looks monsters up by id and throws on unknown ones', () => {
    for (const monster of MONSTERS) expect(getMonster(monster.id)).toBe(monster);
    expect(getMonster('tobbin-the-toll-troll').zoneIndex).toBe(1);
    expect(getMonster('tax-collector').archetype).toBe('grunt');
    expect(() => getMonster('hedge-goblin-deluxe')).toThrow(/Unknown monster/);
  });
});
