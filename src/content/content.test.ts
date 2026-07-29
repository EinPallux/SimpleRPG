/**
 * Content validation (`pnpm validate:content`, TECHNICAL_ARCHITECTURE.md §8):
 * schemas, unique ids, i18n key coverage, icon referential integrity.
 */
import { describe, expect, it } from 'vitest';
import { hasKey } from '@/i18n';
import { ICON_IDS } from '@/ui/icons.gen';
import { NAV_GROUPS } from '@/ui/nav';
import { CLASSES, classSchema } from './classes';
import {
  allBossSlugs,
  bossIntroKey,
  bossNameKey,
  DUNGEONS,
  dungeonSchema,
  floorLevel,
} from './dungeons';
import { EMBLEM_ICONS, EMBLEM_PALETTES } from './emblems';
import {
  allMinibossSlugs,
  EVENTS,
  eventSchema,
  LOCALES,
  localeSchema,
  MINIBOSS_RESERVES,
} from './expeditions';
import { classSetAt, getSet, SETS, setSchema } from './sets';
import { WHEEL_SLOTS, wheelSlotSchema } from './wheel';

const iconSet = new Set<string>(ICON_IDS);

describe('classes', () => {
  it('validate against their schema', () => {
    for (const cls of CLASSES) expect(() => classSchema.parse(cls)).not.toThrow();
  });

  it('have unique ids and exactly four entries', () => {
    expect(new Set(CLASSES.map((c) => c.id)).size).toBe(4);
  });

  it('carry i18n name/blurb/signature keys', () => {
    for (const cls of CLASSES) {
      expect(hasKey(`class.${cls.id}.name`)).toBe(true);
      expect(hasKey(`class.${cls.id}.blurb`)).toBe(true);
      expect(hasKey(`class.${cls.id}.signature`)).toBe(true);
    }
  });

  it('reference real sprite icons', () => {
    for (const cls of CLASSES) {
      expect(iconSet.has(cls.icon)).toBe(true);
      expect(iconSet.has(cls.emblemIcon)).toBe(true);
    }
  });
});

describe('emblems', () => {
  it('icons exist in the sprite and palettes are well-formed', () => {
    for (const icon of EMBLEM_ICONS) expect(iconSet.has(icon)).toBe(true);
    for (const p of EMBLEM_PALETTES) {
      expect(p.from).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.to).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('navigation registry', () => {
  it('labels resolve and icons exist', () => {
    for (const group of NAV_GROUPS) {
      expect(hasKey(group.labelKey)).toBe(true);
      for (const entry of group.entries) {
        expect(hasKey(entry.labelKey)).toBe(true);
        expect(iconSet.has(entry.icon)).toBe(true);
        expect(entry.unlockLevel).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('covers every screen exactly once', () => {
    const screens = NAV_GROUPS.flatMap((g) => g.entries.map((e) => e.screen));
    expect(new Set(screens).size).toBe(screens.length);
    expect(screens.length).toBe(17);
  });

  it('mirrors the GAME_DESIGN §18 unlock ladder for M0 anchors', () => {
    const bySc = new Map(NAV_GROUPS.flatMap((g) => g.entries).map((e) => [e.screen, e]));
    expect(bySc.get('tavern')?.unlockLevel).toBe(1);
    expect(bySc.get('character')?.unlockLevel).toBe(1);
    expect(bySc.get('patrol')?.unlockLevel).toBe(3);
    expect(bySc.get('arena')?.unlockLevel).toBe(5);
    expect(bySc.get('dungeons')?.unlockLevel).toBe(12);
    expect(bySc.get('well')?.unlockLevel).toBe(18);
    expect(bySc.get('menagerie')?.unlockLevel).toBe(35);
  });
});

describe('item sets (M5)', () => {
  it('validate, are unique, and cover every class at 20/60/100', () => {
    for (const set of SETS) expect(() => setSchema.parse(set)).not.toThrow();
    expect(new Set(SETS.map((s) => s.id)).size).toBe(14);
    for (const level of [20, 60, 100] as const) {
      for (const cls of ['warrior', 'scout', 'mage', 'assassin'] as const) {
        expect(classSetAt(level, cls).classId).toBe(cls);
      }
    }
  });

  it('piece slots are unique per set and named in i18n', () => {
    for (const set of SETS) {
      expect(new Set(set.slots).size).toBe(set.slots.length);
      expect(hasKey(set.nameKey)).toBe(true);
    }
  });
});

describe('dungeons (M5)', () => {
  it('validate: five wings, ten bosses each, slugs globally unique', () => {
    for (const d of DUNGEONS) expect(() => dungeonSchema.parse(d)).not.toThrow();
    expect(DUNGEONS).toHaveLength(5);
    const slugs = allBossSlugs();
    expect(slugs).toHaveLength(50);
    expect(new Set(slugs).size).toBe(50);
  });

  it('every boss has a name and an intro threat (CONTENT §13)', () => {
    for (const slug of allBossSlugs()) {
      expect(hasKey(bossNameKey(slug))).toBe(true);
      expect(hasKey(bossIntroKey(slug))).toBe(true);
    }
    for (const d of DUNGEONS) expect(hasKey(d.nameKey)).toBe(true);
  });

  it('floors ramp toward the next dungeon and fixed set pools resolve', () => {
    for (const d of DUNGEONS) {
      for (let f = 2; f <= 10; f++) {
        expect(floorLevel(d, f)).toBeGreaterThanOrEqual(floorLevel(d, f - 1));
      }
      // §4: floor 1 lands at Ld + ceil(span/11) — up to +4 on D5's wide window
      expect(floorLevel(d, 1)).toBeLessThanOrEqual(d.entryLevel + 4);
      expect(floorLevel(d, 10)).toBeLessThan(d.nextLevel);
      const pool = d.setPool;
      if (pool.kind === 'fixed') expect(() => getSet(pool.setId)).not.toThrow();
    }
  });
});

describe('expeditions (M5)', () => {
  it('locales validate, map to real art, and speak', () => {
    for (const locale of LOCALES) {
      expect(() => localeSchema.parse(locale)).not.toThrow();
      expect(hasKey(locale.nameKey)).toBe(true);
      expect(hasKey(`miniboss.${locale.minibossSlug}.name`)).toBe(true);
      expect(hasKey(`miniboss.${locale.minibossSlug}.intro`)).toBe(true);
    }
    expect(new Set(LOCALES.map((l) => l.bg)).size).toBe(4);
  });

  it('every mini-boss who can hold encounter 3 has a name and a threat (§5: 4 + 6 reserve)', () => {
    const roster = allMinibossSlugs();
    expect(MINIBOSS_RESERVES).toHaveLength(6);
    expect(roster).toHaveLength(10);
    expect(new Set(roster).size).toBe(10); // a reserve must not duplicate a locale's own
    for (const slug of roster) {
      expect(hasKey(`miniboss.${slug}.name`)).toBe(true);
      expect(hasKey(`miniboss.${slug}.intro`)).toBe(true);
    }
  });

  it('all 24 events validate and carry their five strings', () => {
    expect(EVENTS).toHaveLength(24);
    for (const event of EVENTS) {
      expect(() => eventSchema.parse(event)).not.toThrow();
      for (const part of ['prompt', 'safe', 'bold', 'safeOut', 'boldOut']) {
        expect(hasKey(`exped.event.${event.index}.${part}`)).toBe(true);
      }
    }
  });
});

describe('wheel of destiny (M5)', () => {
  it('twelve slots, weights sum to 100, labels resolve', () => {
    expect(WHEEL_SLOTS).toHaveLength(12);
    expect(WHEEL_SLOTS.reduce((sum, s) => sum + s.weight, 0)).toBe(100);
    for (const slot of WHEEL_SLOTS) {
      expect(() => wheelSlotSchema.parse(slot)).not.toThrow();
      expect(hasKey(slot.labelKey)).toBe(true);
    }
  });
});
