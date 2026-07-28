/**
 * Navigation registry — mirrors the unlock ladder (GAME_DESIGN.md §18) and the
 * rail grouping (UI_DESIGN.md §5). Locked entries render as silhouettes with
 * their unlock level; clicking them toasts instead of navigating.
 */
import type { ScreenId } from '@/state/store';
import type { I18nKey } from '@/i18n';
import type { IconId } from './icons.gen';

export interface NavEntry {
  screen: ScreenId;
  labelKey: I18nKey;
  icon: IconId;
  unlockLevel: number;
}

export interface NavGroup {
  labelKey: I18nKey;
  entries: NavEntry[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    labelKey: 'nav.group.adventure',
    entries: [
      { screen: 'tavern', labelKey: 'nav.tavern', icon: 'tavern', unlockLevel: 1 },
      { screen: 'expeditions', labelKey: 'nav.expeditions', icon: 'expedition', unlockLevel: 8 },
      { screen: 'patrol', labelKey: 'nav.patrol', icon: 'patrol', unlockLevel: 3 },
    ],
  },
  {
    labelKey: 'nav.group.combat',
    entries: [
      { screen: 'arena', labelKey: 'nav.arena', icon: 'arena', unlockLevel: 5 },
      { screen: 'dungeons', labelKey: 'nav.dungeons', icon: 'dungeon', unlockLevel: 12 },
      { screen: 'hallOfFame', labelKey: 'nav.hallOfFame', icon: 'hall-of-fame', unlockLevel: 15 },
    ],
  },
  {
    labelKey: 'nav.group.town',
    entries: [
      { screen: 'shops', labelKey: 'nav.shops', icon: 'shops', unlockLevel: 10 },
      { screen: 'forge', labelKey: 'nav.forge', icon: 'forge', unlockLevel: 15 },
      { screen: 'stable', labelKey: 'nav.stable', icon: 'stable', unlockLevel: 10 },
      { screen: 'menagerie', labelKey: 'nav.menagerie', icon: 'menagerie', unlockLevel: 35 },
      { screen: 'well', labelKey: 'nav.well', icon: 'well', unlockLevel: 18 },
      { screen: 'wheel', labelKey: 'nav.wheel', icon: 'wheel', unlockLevel: 5 },
    ],
  },
  {
    labelKey: 'nav.group.hero',
    entries: [
      { screen: 'character', labelKey: 'nav.character', icon: 'character', unlockLevel: 1 },
      { screen: 'quests', labelKey: 'nav.quests', icon: 'quests', unlockLevel: 6 },
      {
        screen: 'achievements',
        labelKey: 'nav.achievements',
        icon: 'achievements',
        unlockLevel: 6,
      },
      { screen: 'codex', labelKey: 'nav.codex', icon: 'codex', unlockLevel: 25 },
      { screen: 'calendar', labelKey: 'nav.calendar', icon: 'calendar', unlockLevel: 18 },
    ],
  },
];

export function findNavEntry(screen: ScreenId): NavEntry | undefined {
  for (const group of NAV_GROUPS) {
    const entry = group.entries.find((e) => e.screen === screen);
    if (entry) return entry;
  }
  return undefined;
}
