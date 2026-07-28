import { DUNGEONS } from '@/content/dungeons';
import { getQuest } from '@/content/quests';
import { claimableAchievements } from '@/engine/achievements';
import { canClaimCalendar } from '@/engine/calendar';
import {
  ARENA_FIGHTS_PER_DAY,
  CALENDAR_UNLOCK_LEVEL,
  QUESTS_UNLOCK_LEVEL,
} from '@/engine/constants';
import { canAttemptFloor } from '@/engine/dungeons';
import { expeditionsLeft } from '@/engine/expeditions';
import { missionEndsAt } from '@/engine/missions';
import { canClaimActivityChest, canClaimQuest, questBlock } from '@/engine/quests';
import { wheelSpinsLeft } from '@/engine/wheel';
import { t } from '@/i18n';
import { useGame, type ScreenId } from '@/state/store';
import { NAV_GROUPS, type NavEntry } from '../nav';
import { Icon } from '../components/Icon';
import { useGameClock } from '../hooks/useGameClock';

/** Live attention badges: mission ready, patrol on duty, daily activities waiting. */
function useNavBadges(): Partial<Record<ScreenId, string>> {
  const now = useGameClock(5000);
  const save = useGame((s) => s.save);
  const badges: Partial<Record<ScreenId, string>> = {};
  if (!save) return badges;
  const level = save.hero.level;
  const mission = save.activities.mission;
  if (mission && now >= missionEndsAt(mission)) badges.tavern = '!';
  if (save.activities.patrol) badges.patrol = '💤';
  if (level >= 5 && save.activities.arena.fightsToday < ARENA_FIGHTS_PER_DAY) {
    badges.arena = String(ARENA_FIGHTS_PER_DAY - save.activities.arena.fightsToday);
  }
  if (level >= 8) {
    const left = expeditionsLeft(save);
    if (left > 0 || save.activities.expedition) {
      badges.expeditions = save.activities.expedition ? '!' : String(left);
    }
  }
  if (level >= 12) {
    const ready = DUNGEONS.filter((d) => canAttemptFloor(save, d.id, now).ok).length;
    if (ready > 0) badges.dungeons = String(ready);
  }
  if (level >= 5 && wheelSpinsLeft(save) > 0) badges.wheel = String(wheelSpinsLeft(save));
  // Meta layer: only ever badge things that are actually claimable right now.
  if (level >= QUESTS_UNLOCK_LEVEL) {
    const ready =
      (['daily', 'weekly', 'monthly'] as const).reduce(
        (sum, cadence) =>
          sum +
          questBlock(save, cadence).questIds.filter((id) => canClaimQuest(save, getQuest(id)))
            .length,
        0,
      ) + (canClaimActivityChest(save) ? 1 : 0);
    if (ready > 0) badges.quests = String(ready);
  }
  const achievementsReady = claimableAchievements(save).length;
  if (achievementsReady > 0) badges.achievements = String(achievementsReady);
  if (level >= CALENDAR_UNLOCK_LEVEL && canClaimCalendar(save, now)) badges.calendar = '!';
  return badges;
}

function useNavActions() {
  const level = useGame((s) => s.save?.hero.level ?? 1);
  const screen = useGame((s) => s.screen);
  const setScreen = useGame((s) => s.setScreen);
  const toast = useGame((s) => s.toast);

  const activate = (entry: NavEntry) => {
    if (level < entry.unlockLevel) {
      toast(t('toast.locked', { name: t(entry.labelKey), level: entry.unlockLevel }));
      return;
    }
    setScreen(entry.screen);
  };
  return { level, screen, activate };
}

function RailEntry({
  entry,
  level,
  screen,
  onActivate,
  labels = 'auto',
  badge,
}: {
  entry: NavEntry;
  level: number;
  screen: ScreenId;
  onActivate: (entry: NavEntry) => void;
  labels?: 'auto' | 'always';
  badge?: string | undefined;
}) {
  const locked = level < entry.unlockLevel;
  const active = screen === entry.screen;
  const labelClass = labels === 'always' ? 'block' : 'hidden xl:block';
  return (
    <button
      onClick={() => onActivate(entry)}
      aria-current={active ? 'page' : undefined}
      title={locked ? t('nav.lockedTooltip', { level: entry.unlockLevel }) : t(entry.labelKey)}
      className={`group flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-bold transition-colors duration-(--motion-fast) ${
        active
          ? 'border-l-2 border-gold bg-panel-raised text-gold'
          : locked
            ? 'text-ink-faint hover:text-ink-muted'
            : 'text-ink-muted hover:bg-panel-raised hover:text-ink'
      }`}
    >
      <span className="relative shrink-0">
        <Icon id={entry.icon} size={22} className={locked ? 'opacity-50' : ''} />
        {locked && (
          <Icon id="lock" size={11} className="absolute -right-1.5 -bottom-1 text-ink-faint" />
        )}
        {!locked && badge && (
          <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-0.5 text-[9px] font-extrabold text-canvas">
            {badge}
          </span>
        )}
      </span>
      <span className={`${labelClass} min-w-0 flex-1 truncate`}>{t(entry.labelKey)}</span>
      {locked && (
        <span
          className={`${labelClass} shrink-0 rounded-sm bg-panel-inset px-1 py-0.5 text-[10px] font-extrabold text-ink-faint`}
        >
          {t('common.levelShort', { level: entry.unlockLevel })}
        </span>
      )}
    </button>
  );
}

/** Desktop navigation rail (≥lg). Locked entries are visible silhouettes — anticipation is content. */
export function NavRail() {
  const { level, screen, activate } = useNavActions();
  const badges = useNavBadges();
  return (
    <nav
      aria-label="Main"
      className="frame-secondary--muted panel-fill sticky top-2 mb-2 ml-2 hidden max-h-[calc(100dvh-16px)] w-16 shrink-0 self-start overflow-y-auto py-2 lg:block xl:w-52"
    >
      {NAV_GROUPS.map((group) => (
        <div key={group.labelKey} className="mb-1">
          <div className="hidden px-3 pt-2 pb-1 text-[10px] font-extrabold tracking-[0.18em] text-ink-faint uppercase xl:block">
            {t(group.labelKey)}
          </div>
          <div className="xl:hidden" aria-hidden="true">
            <div className="mx-3 my-2 border-t border-ink-faint/30" />
          </div>
          {group.entries.map((entry) => (
            <RailEntry
              key={entry.screen}
              entry={entry}
              level={level}
              screen={screen}
              onActivate={activate}
              badge={badges[entry.screen]}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

/** Mobile bottom bar (<lg): Tavern direct + one sheet per group. */
export function MobileTabBar({ onOpenSheet }: { onOpenSheet: (groupIndex: number) => void }) {
  const { screen, activate } = useNavActions();
  const badges = useNavBadges();
  const tavern = NAV_GROUPS[0]!.entries[0]!;
  const groups = NAV_GROUPS;
  return (
    <nav
      aria-label="Main"
      className="frame-secondary--muted panel-fill fixed inset-x-2 bottom-2 z-40 flex items-stretch justify-around py-1 lg:hidden"
      style={{ ['--frame-w' as string]: '10px' }}
    >
      <button
        onClick={() => activate(tavern)}
        aria-current={screen === 'tavern' ? 'page' : undefined}
        className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] font-bold ${screen === 'tavern' ? 'text-gold' : 'text-ink-muted'}`}
      >
        <span className="relative">
          <Icon id="tavern" size={22} />
          {badges.tavern && (
            <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-0.5 text-[9px] font-extrabold text-canvas">
              {badges.tavern}
            </span>
          )}
        </span>
        {t('nav.tavern')}
      </button>
      {groups.map((group, i) => {
        if (i === 0) return null; // Adventure's headline entry (Tavern) is the direct tab
        const containsActive = group.entries.some((e) => e.screen === screen);
        return (
          <button
            key={group.labelKey}
            onClick={() => onOpenSheet(i)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] font-bold ${containsActive ? 'text-gold' : 'text-ink-muted'}`}
          >
            <Icon id={group.entries[0]!.icon} size={22} />
            {t(group.labelKey)}
          </button>
        );
      })}
      <button
        onClick={() => onOpenSheet(0)}
        className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] font-bold text-ink-muted"
      >
        <Icon id="expedition" size={22} />
        {t('nav.more')}
      </button>
    </nav>
  );
}

/** Bottom-sheet group navigation for mobile. */
export function NavSheet({ groupIndex, onClose }: { groupIndex: number; onClose: () => void }) {
  const { level, screen, activate } = useNavActions();
  const group = NAV_GROUPS[groupIndex]!;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/70 lg:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="frame-primary panel-fill max-h-[70dvh] w-full overflow-y-auto p-4 pb-6 screen-enter">
        <h2 className="mb-2 font-display text-lg font-semibold text-gold">{t(group.labelKey)}</h2>
        {group.entries.map((entry) => (
          <RailEntry
            key={entry.screen}
            entry={entry}
            level={level}
            screen={screen}
            labels="always"
            onActivate={(e) => {
              activate(e);
              if (level >= e.unlockLevel) onClose();
            }}
          />
        ))}
      </div>
    </div>
  );
}
