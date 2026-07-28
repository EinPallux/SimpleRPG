/**
 * Minimal typed i18n layer (invariant 8: every user-facing string goes through
 * here). English-only at v1.0; the flat-key catalog keeps the door open for
 * additional locales as a post-1.0 patch without refactoring call sites.
 */
import en from './en.json';

export type I18nKey = keyof typeof en;

const catalog: Record<I18nKey, string> = en;

export function t(key: I18nKey, params?: Record<string, string | number>): string {
  let text = catalog[key] ?? key;
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
