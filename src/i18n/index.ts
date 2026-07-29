/**
 * Minimal typed i18n layer (invariant 8: every user-facing string goes through
 * here). English-only at v1.0; the flat-key catalog keeps the door open for
 * additional locales as a post-1.0 patch without refactoring call sites.
 *
 * The catalog is split: `en.json` holds the UI chrome, `parts/*.json` hold the
 * bulk content pools (story prose, achievements, bestiary lore…). Keys are
 * globally flat and unique — the merge is a plain spread, and `I18nKey` stays
 * a literal union across every file, so typos remain compile errors.
 */
import en from './en.json';
import achievements from './parts/achievements.json';
import bestiary from './parts/bestiary.json';
import calendar from './parts/calendar.json';
import gacha from './parts/gacha.json';
import help from './parts/help.json';
import mounts from './parts/mounts.json';
import pets from './parts/pets.json';
import quests from './parts/quests.json';
import story from './parts/story.json';
import titles from './parts/titles.json';

const catalog = {
  ...en,
  ...achievements,
  ...bestiary,
  ...calendar,
  ...gacha,
  ...help,
  ...mounts,
  ...pets,
  ...quests,
  ...story,
  ...titles,
};

export type I18nKey = keyof typeof catalog;

export function t(key: I18nKey, params?: Record<string, string | number>): string {
  let text: string = catalog[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/** True when a key exists — used by content validation tests. */
export function hasKey(key: string): key is I18nKey {
  return key in catalog;
}
