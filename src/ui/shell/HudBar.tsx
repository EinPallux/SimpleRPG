import { xpToNext } from '@/engine/xp';
import { VIGOR_DAILY_BASE } from '@/engine/constants';
import { t } from '@/i18n';
import { useGame } from '@/state/store';
import { CurrencyChip } from '../components/CurrencyChip';
import { EmblemAvatar } from '../components/EmblemAvatar';
import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { fmt } from '../format';

export function HudBar() {
  const save = useGame((s) => s.save);
  const openSettings = useGame((s) => s.setSettingsOpen);
  const toast = useGame((s) => s.toast);
  const timeFrozen = useGame((s) => s.timeFrozen);
  if (!save) return null;

  const { hero, daily } = save;
  const next = xpToNext(hero.level);

  return (
    <header className="frame-secondary--muted panel-fill sticky top-0 z-40 mx-2 mt-2 px-3 py-2 md:mx-3">
      {timeFrozen && (
        <div className="mb-2 rounded-sm bg-panel-inset px-3 py-1.5 text-xs font-bold text-[#e0c07a]">
          {t('hud.frozenBanner')}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Identity */}
        <div className="flex min-w-0 items-center gap-3">
          <EmblemAvatar emblem={hero.portrait} classId={hero.classId} size={44} />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="truncate font-display text-base font-semibold text-ink">
                {hero.name}
              </span>
              <span className="shrink-0 rounded-sm bg-panel-inset px-1.5 py-0.5 text-[11px] font-extrabold text-gold">
                {t('common.levelShort', { level: hero.level })}
              </span>
            </div>
            <ProgressBar
              variant="xp"
              value={hero.xp}
              max={next}
              className="mt-1 h-2.5 w-36 md:w-44"
              label=""
              title={t('hud.xpTooltip', { xp: fmt(hero.xp), next: fmt(next) })}
            />
          </div>
        </div>

        {/* Currencies */}
        <div className="order-3 flex w-full items-center gap-2 overflow-x-auto md:order-none md:w-auto md:flex-1 md:justify-center">
          <CurrencyChip kind="gold" value={hero.gold} />
          <CurrencyChip kind="gems" value={hero.gems} />
          <CurrencyChip kind="scraps" value={hero.scraps} />
          <CurrencyChip kind="dust" value={hero.dust} />
        </div>

        {/* Vigor + system */}
        <div className="ml-auto flex items-center gap-3">
          <div className="w-32 md:w-40" title={t('hud.vigorTooltip')}>
            <div className="mb-0.5 flex items-center justify-between text-[10px] font-bold tracking-wider text-ink-muted uppercase">
              <span>{t('hud.vigor')}</span>
              <span>
                {daily.vigor}/{VIGOR_DAILY_BASE}
              </span>
            </div>
            <ProgressBar
              variant="vigor"
              value={daily.vigor}
              max={Math.max(VIGOR_DAILY_BASE, daily.vigor)}
              className="h-2.5"
            />
          </div>
          <button
            aria-label={t('hud.help')}
            title={t('hud.help')}
            onClick={() => toast(t('toast.helpSoon'))}
            className="text-ink-muted transition-colors hover:text-ink"
          >
            <Icon id="help" size={20} />
          </button>
          <button
            aria-label={t('hud.settings')}
            title={t('hud.settings')}
            onClick={() => openSettings(true)}
            className="text-ink-muted transition-colors hover:text-gold"
          >
            <Icon id="settings" size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
