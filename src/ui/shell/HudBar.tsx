import { xpToNext } from '@/engine/xp';
import { PATROL_UNLOCK_LEVEL, PATROL_VIGOR_THRESHOLD, VIGOR_DAILY_BASE } from '@/engine/constants';
import { t } from '@/i18n';
import { useGame } from '@/state/store';
import { CurrencyChip } from '../components/CurrencyChip';
import { EmblemAvatar } from '../components/EmblemAvatar';
import { HelpButton } from '../components/HelpOverlay';
import { Hint } from '../components/Hint';
import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { fmt } from '../format';

/**
 * The one line of the vigor tooltip worth acting on, or nothing.
 *
 * An empty tank and a nearly-empty one are two different situations with two
 * different answers — top it up downstairs, or go and get paid for being tired.
 * Anything above that needs no advice at all, and a tooltip that always has
 * something urgent to say quickly has nothing.
 */
function vigorNote(vigor: number, level: number): string | undefined {
  if (vigor === 0) return t('hud.tip.vigor.empty');
  if (vigor < PATROL_VIGOR_THRESHOLD && level >= PATROL_UNLOCK_LEVEL) {
    return t('hud.tip.vigor.patrol');
  }
  return undefined;
}

export function HudBar() {
  const save = useGame((s) => s.save);
  const openSettings = useGame((s) => s.setSettingsOpen);
  const screen = useGame((s) => s.screen);
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
            <Hint
              title={t('hud.tip.xp.title')}
              body={t('hud.tip.xp.body')}
              rows={[
                [t('hud.tip.xp.current'), fmt(hero.xp)],
                [t('hud.tip.xp.next'), fmt(next)],
                [t('hud.tip.xp.togo'), fmt(Math.max(0, next - hero.xp))],
              ]}
              placement="bottom"
              className="mt-1 block"
            >
              <ProgressBar
                variant="xp"
                value={hero.xp}
                max={next}
                className="h-2.5 w-36 md:w-44"
                label=""
                name={t('hud.tip.xp.title')}
                tabbable
              />
            </Hint>
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
          <Hint
            title={t('hud.vigor')}
            body={t('hud.vigorTooltip')}
            rows={[[t('hud.tip.vigor.left'), `${daily.vigor} / ${VIGOR_DAILY_BASE}`]]}
            footer={t('hud.tip.vigor.refill', { base: VIGOR_DAILY_BASE })}
            note={vigorNote(daily.vigor, hero.level)}
            placement="bottom"
            className="block w-32 md:w-40"
          >
            <div tabIndex={0}>
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
                name={t('hud.vigor')}
                className="h-2.5"
              />
            </div>
          </Hint>
          {/* §17: every screen keeps its "?" forever. It reads the CURRENT
              screen, so one button in the header covers all twenty. */}
          <HelpButton screen={screen} />
          <Hint title={t('hud.settings')} body={t('hud.tip.settings.body')} placement="bottom">
            <button
              aria-label={t('hud.settings')}
              onClick={() => openSettings(true)}
              className="-m-3 grid h-11 w-11 place-items-center text-ink-muted transition-colors hover:text-gold"
            >
              <Icon id="settings" size={20} />
            </button>
          </Hint>
        </div>
      </div>
    </header>
  );
}
