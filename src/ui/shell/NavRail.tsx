import { t } from '@/i18n';
import { useGame, type ScreenId } from '@/state/store';
import { NAV_GROUPS, type NavEntry } from '../nav';
import { Icon } from '../components/Icon';

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
}: {
  entry: NavEntry;
  level: number;
  screen: ScreenId;
  onActivate: (entry: NavEntry) => void;
  labels?: 'auto' | 'always';
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
        <Icon id="tavern" size={22} />
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
