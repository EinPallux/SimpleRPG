/**
 * Content validation (`pnpm validate:content`, TECHNICAL_ARCHITECTURE.md §8):
 * schemas, unique ids, i18n key coverage, icon referential integrity.
 */
import { describe, expect, it } from 'vitest';
import { hasKey } from '@/i18n';
import { ICON_IDS } from '@/ui/icons.gen';
import { NAV_GROUPS } from '@/ui/nav';
import { CLASSES, classSchema } from './classes';
import { EMBLEM_ICONS, EMBLEM_PALETTES } from './emblems';

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
