/**
 * The permanent "?" page every screen keeps forever (GAME_DESIGN.md §17, last
 * bullet: static, hand-written, no video).
 *
 * Only the SHAPE lives here — which screen has a page and how long it is. The
 * words live in `i18n/parts/help.json`, hand-written per screen, because help
 * is the only documentation this game ever hands a player: it has to name real
 * numbers and the one trap each screen hides, which no template can generate.
 *
 * Two rules the shape enforces:
 *  1. **Every screen has a page.** The registry is a total `Record` over the
 *     screen union, so a screen cannot ship without its help — the compiler
 *     asks for it, and §17's "forever" stops being a promise someone has to
 *     remember.
 *  2. **Three to six bullets.** Fewer is not help; more is a manual nobody
 *     reads. `help.test.ts` holds both ends.
 */

/**
 * The screens with a page — a mirror of `ScreenId` (state/store.ts), which
 * content may not import (layering: content never depends on state or UI).
 * `help.test.ts` pins the two unions together in both directions, so the mirror
 * cannot drift silently.
 */
export type HelpScreen =
  | 'tavern'
  | 'expeditions'
  | 'patrol'
  | 'arena'
  | 'dungeons'
  | 'hallOfFame'
  | 'shops'
  | 'forge'
  | 'stable'
  | 'menagerie'
  | 'well'
  | 'wheel'
  | 'character'
  | 'quests'
  | 'achievements'
  | 'codex'
  | 'calendar';

/** §17's "short intro plus a handful of bullets", pinned down. */
export const HELP_BULLETS_MIN = 3;
export const HELP_BULLETS_MAX = 6;

/**
 * Bullets per screen, in nav-rail reading order (UI_DESIGN §5) — insertion
 * order is what {@link HELP_SCREENS} publishes, so the order is data too.
 *
 * The count is authored rather than counted from the catalog: a page grows a
 * bullet only when someone deliberately writes one, and a missing string then
 * fails the test instead of silently shortening the page.
 */
const BULLET_COUNTS: Record<HelpScreen, number> = {
  tavern: 6,
  expeditions: 5,
  patrol: 5,
  arena: 6,
  dungeons: 5,
  hallOfFame: 5,
  shops: 5,
  forge: 5,
  stable: 5,
  menagerie: 5,
  well: 6,
  wheel: 5,
  character: 6,
  quests: 5,
  achievements: 5,
  codex: 5,
  calendar: 4,
};

export interface HelpEntry {
  screen: HelpScreen;
  /** i18n `help.{screen}.intro` — one or two sentences of framing */
  introKey: string;
  /** i18n `help.{screen}.bullet.{i}`, in reading order */
  bulletKeys: readonly string[];
}

/** Every screen with a help page — which, by construction, is every screen. */
export const HELP_SCREENS: readonly HelpScreen[] = Object.keys(BULLET_COUNTS) as HelpScreen[];

export function helpIntroKey(screen: string): string {
  return `help.${screen}.intro`;
}

export function helpBulletKey(screen: string, index: number): string {
  return `help.${screen}.bullet.${index}`;
}

export function getHelp(screen: HelpScreen): HelpEntry {
  return {
    screen,
    introKey: helpIntroKey(screen),
    bulletKeys: Array.from({ length: BULLET_COUNTS[screen] }, (_, i) => helpBulletKey(screen, i)),
  };
}
