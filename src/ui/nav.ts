/**
 * Navigation registry — mirrors the unlock ladder (GAME_DESIGN.md §18) and the
 * rail grouping (UI_DESIGN.md §5). Locked entries render as silhouettes with
 * their unlock level; clicking them toasts instead of navigating.
 *
 * Unlock levels are IMPORTED, never written here. This file used to hold its
 * own copies, which is exactly how the Stable kept advertising "Lv 10" for a
 * whole milestone after `STABLE_UNLOCK_LEVEL` moved to 1: the door was open and
 * the sign on it was stale.
 */
import {
  ACHIEVEMENTS_UNLOCK_LEVEL,
  ARENA_UNLOCK_LEVEL,
  CALENDAR_UNLOCK_LEVEL,
  CODEX_UNLOCK_LEVEL,
  DUNGEONS_UNLOCK_LEVEL,
  EXPEDITIONS_UNLOCK_LEVEL,
  FORGE_UNLOCK_LEVEL,
  HALL_OF_FAME_UNLOCK_LEVEL,
  MENAGERIE_UNLOCK_LEVEL,
  PATROL_UNLOCK_LEVEL,
  QUESTS_UNLOCK_LEVEL,
  SHOPS_UNLOCK_LEVEL,
  STABLE_UNLOCK_LEVEL,
  WELL_UNLOCK_LEVEL,
  WHEEL_UNLOCK_LEVEL,
} from '@/engine/constants';
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
      {
        screen: 'expeditions',
        labelKey: 'nav.expeditions',
        icon: 'expedition',
        unlockLevel: EXPEDITIONS_UNLOCK_LEVEL,
      },
      {
        screen: 'patrol',
        labelKey: 'nav.patrol',
        icon: 'patrol',
        unlockLevel: PATROL_UNLOCK_LEVEL,
      },
    ],
  },
  {
    labelKey: 'nav.group.combat',
    entries: [
      { screen: 'arena', labelKey: 'nav.arena', icon: 'arena', unlockLevel: ARENA_UNLOCK_LEVEL },
      {
        screen: 'dungeons',
        labelKey: 'nav.dungeons',
        icon: 'dungeon',
        unlockLevel: DUNGEONS_UNLOCK_LEVEL,
      },
      {
        screen: 'hallOfFame',
        labelKey: 'nav.hallOfFame',
        icon: 'hall-of-fame',
        unlockLevel: HALL_OF_FAME_UNLOCK_LEVEL,
      },
    ],
  },
  {
    labelKey: 'nav.group.town',
    entries: [
      { screen: 'shops', labelKey: 'nav.shops', icon: 'shops', unlockLevel: SHOPS_UNLOCK_LEVEL },
      { screen: 'forge', labelKey: 'nav.forge', icon: 'forge', unlockLevel: FORGE_UNLOCK_LEVEL },
      {
        screen: 'stable',
        labelKey: 'nav.stable',
        icon: 'stable',
        unlockLevel: STABLE_UNLOCK_LEVEL,
      },
      {
        screen: 'menagerie',
        labelKey: 'nav.menagerie',
        icon: 'menagerie',
        unlockLevel: MENAGERIE_UNLOCK_LEVEL,
      },
      { screen: 'well', labelKey: 'nav.well', icon: 'well', unlockLevel: WELL_UNLOCK_LEVEL },
      { screen: 'wheel', labelKey: 'nav.wheel', icon: 'wheel', unlockLevel: WHEEL_UNLOCK_LEVEL },
    ],
  },
  {
    labelKey: 'nav.group.hero',
    entries: [
      { screen: 'character', labelKey: 'nav.character', icon: 'character', unlockLevel: 1 },
      {
        screen: 'quests',
        labelKey: 'nav.quests',
        icon: 'quests',
        unlockLevel: QUESTS_UNLOCK_LEVEL,
      },
      {
        screen: 'achievements',
        labelKey: 'nav.achievements',
        icon: 'achievements',
        unlockLevel: ACHIEVEMENTS_UNLOCK_LEVEL,
      },
      { screen: 'codex', labelKey: 'nav.codex', icon: 'codex', unlockLevel: CODEX_UNLOCK_LEVEL },
      {
        screen: 'calendar',
        labelKey: 'nav.calendar',
        icon: 'calendar',
        unlockLevel: CALENDAR_UNLOCK_LEVEL,
      },
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
