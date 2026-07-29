/**
 * Help-page validation (GAME_DESIGN.md §17: every screen keeps a "?" overlay
 * forever). "Forever" is the whole contract, so this suite guards the two ways
 * it could quietly stop being true: a screen shipping without a page, and a key
 * that renders as `help.thing.bullet.4` because nobody wrote the sentence.
 */
import { describe, expect, it } from 'vitest';
import { hasKey } from '@/i18n';
import en from '@/i18n/en.json';
import helpCatalog from '@/i18n/parts/help.json';
import type { ScreenId } from '@/state/store';
import { NAV_GROUPS } from '@/ui/nav';
import {
  getHelp,
  helpBulletKey,
  helpIntroKey,
  HELP_BULLETS_MAX,
  HELP_BULLETS_MIN,
  HELP_SCREENS,
  type HelpScreen,
} from './help';

const NAV_SCREENS: readonly ScreenId[] = NAV_GROUPS.flatMap((group) =>
  group.entries.map((entry) => entry.screen),
);
const COPY = helpCatalog as Record<string, string>;
const ALL_KEYS = HELP_SCREENS.flatMap((screen) => {
  const entry = getHelp(screen);
  return [entry.introKey, ...entry.bulletKeys];
});

describe('help pages (M8)', () => {
  it('keeps a page for every screen in the nav rail', () => {
    expect(NAV_SCREENS.length).toBeGreaterThan(0);
    for (const screen of NAV_SCREENS) expect(HELP_SCREENS).toContain(screen);
    // …and nothing beyond them: an orphan page is a screen someone deleted.
    expect([...HELP_SCREENS].sort()).toEqual([...NAV_SCREENS].sort());
  });

  it('mirrors the ScreenId union in both directions', () => {
    // Content may not import the store, so its screen union is a hand mirror.
    // These two assignments are what keeps the mirror honest at compile time;
    // the expectation below is only here to spend the values.
    const asHelpScreens: readonly HelpScreen[] = NAV_SCREENS;
    const asScreenIds: readonly ScreenId[] = HELP_SCREENS;
    expect([...asHelpScreens].sort()).toEqual([...asScreenIds].sort());
  });

  it('resolves every intro and bullet key in the catalog', () => {
    for (const screen of HELP_SCREENS) {
      const entry = getHelp(screen);
      expect(hasKey(entry.introKey)).toBe(true);
      for (const key of entry.bulletKeys) expect(hasKey(key)).toBe(true);
    }
  });

  it('prints three to six bullets per screen', () => {
    for (const screen of HELP_SCREENS) {
      const { bulletKeys } = getHelp(screen);
      expect(bulletKeys.length).toBeGreaterThanOrEqual(HELP_BULLETS_MIN);
      expect(bulletKeys.length).toBeLessThanOrEqual(HELP_BULLETS_MAX);
    }
  });

  it('issues no duplicate keys', () => {
    expect(new Set(ALL_KEYS).size).toBe(ALL_KEYS.length);
  });

  it('names its keys the documented way, numbered from zero', () => {
    for (const screen of HELP_SCREENS) {
      const entry = getHelp(screen);
      expect(entry.screen).toBe(screen);
      expect(entry.introKey).toBe(`help.${screen}.intro`);
      expect(entry.introKey).toBe(helpIntroKey(screen));
      entry.bulletKeys.forEach((key, i) => {
        expect(key).toBe(`help.${screen}.bullet.${i}`);
        expect(key).toBe(helpBulletKey(screen, i));
      });
    }
  });

  it('carries exactly the copy the registry asks for', () => {
    // The flat catalog merges by spread, so a stray key here is dead weight a
    // translator would still have to carry.
    expect(Object.keys(COPY).sort()).toEqual([...ALL_KEYS].sort());
  });

  it('collides with nothing already in the chrome catalog', () => {
    const chrome = new Set(Object.keys(en));
    // help.title / help.open / help.close live in en.json and stay there.
    for (const key of Object.keys(COPY)) {
      expect(key.startsWith('help.')).toBe(true);
      expect(chrome.has(key)).toBe(false);
    }
  });

  it('writes real sentences, not placeholders', () => {
    for (const [key, text] of Object.entries(COPY)) {
      expect(text.trim(), key).toBe(text);
      expect(text.length, key).toBeGreaterThan(40);
      expect(text.endsWith('.'), key).toBe(true);
    }
  });
});
