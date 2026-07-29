import { mountBlurbKey, mountNameKey } from '@/content/mounts';
import { getTitle } from '@/content/titles';
import { STABLE_UNLOCK_LEVEL } from '@/engine/constants';
import { currentMount, MAX_MOUNT_TIER, stableRows, stableUnlocked } from '@/engine/mounts';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { CurrencyChip } from '../components/CurrencyChip';
import { EmptyState } from '../components/EmptyState';
import { FButton } from '../components/FButton';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';
import { fmt } from '../format';

/** The Drake is the one stall that charges gems — and the one that looks it. */
function isDrake(costGems: number | undefined): boolean {
  return (costGems ?? 0) > 0;
}

export function StableScreen() {
  const save = useGame((s) => s.save);
  const buy = useGame((s) => s.mountBuy);

  // Loading: the shell mounts screens before the slot finishes hydrating.
  if (!save) return null;

  if (!stableUnlocked(save)) {
    return (
      <Panel variant="secondary">
        <EmptyState
          icon="lock"
          title={t('stable.title')}
          body={t('stable.locked', { level: STABLE_UNLOCK_LEVEL })}
        />
      </Panel>
    );
  }

  const mount = currentMount(save);
  const rows = stableRows(save);
  const firstPurchase = save.progress.mountTier === 0;

  return (
    <div className="flex flex-col gap-4">
      <Panel variant="primary">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-gold-bright">
              {t('stable.title')}
            </h1>
            <p className="text-sm text-ink-muted">{t('stable.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <CurrencyChip kind="gold" value={save.hero.gold} />
            <CurrencyChip kind="gems" value={save.hero.gems} />
          </div>
        </div>
      </Panel>

      <Panel
        variant="secondary"
        title={t('stable.current')}
        headerRight={
          <span className="flex items-center gap-1" aria-hidden="true">
            {Array.from({ length: MAX_MOUNT_TIER }, (_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full border border-black/50 ${
                  i < save.progress.mountTier ? 'bg-gold' : 'bg-panel-inset'
                }`}
              />
            ))}
          </span>
        }
      >
        <div className="flex items-center gap-3">
          <Icon
            id={mount && isDrake(mount.costGems) ? 'dragon' : 'stable'}
            size={30}
            className={`shrink-0 ${mount ? 'text-gold' : 'text-ink-faint'}`}
          />
          <div className="min-w-0">
            <p className="font-display text-lg font-bold text-gold">
              {mount ? t(mountNameKey(mount.id) as I18nKey) : t('stable.onFoot')}
            </p>
            <p className="text-xs leading-relaxed text-ink-muted">
              {mount
                ? t('stable.speed', { pct: Math.round(mount.speed * 100) })
                : t('mount.none.blurb')}
            </p>
          </div>
        </div>
      </Panel>

      <p className="text-xs font-semibold text-ink-faint">{t('stable.pays')}</p>

      <div className="flex flex-col gap-3">
        {rows.map(({ mount: stall, price, owned, affordable }) => {
          const gems = isDrake(stall.costGems);
          return (
            <Panel key={stall.id} variant={gems ? 'special' : 'secondary'}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <Icon
                    id={gems ? 'dragon' : 'stable'}
                    size={gems ? 32 : 26}
                    className={`mt-0.5 shrink-0 ${gems ? 'text-gem' : 'text-ink-muted'}`}
                  />
                  <div className="min-w-0">
                    <h3
                      className={`font-display font-bold ${gems ? 'text-lg text-gem' : 'text-base text-ink'}`}
                    >
                      {t(mountNameKey(stall.id) as I18nKey)}
                    </h3>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted italic">
                      {t(mountBlurbKey(stall.id) as I18nKey)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold">
                      <span className="text-teal">
                        {t('stable.speed', { pct: Math.round(stall.speed * 100) })}
                      </span>
                      <span className="inline-flex items-center gap-1 text-gold">
                        <Icon id="crown" size={11} />
                        {t('stable.title.grants', {
                          title: t(getTitle(stall.titleId).nameKey as I18nKey),
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                  {owned ? (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-panel-inset px-2 py-1 text-[10px] font-extrabold tracking-wide text-gold uppercase">
                      <Icon id="star" size={11} /> {t('stable.owned')}
                    </span>
                  ) : (
                    <>
                      <span
                        className={`inline-flex items-center gap-1.5 text-sm font-bold ${gems ? 'text-gem' : 'text-gold-bright'}`}
                      >
                        <Icon
                          id={gems ? 'gem' : 'gold'}
                          size={15}
                          label={t(gems ? 'hud.gems' : 'hud.gold')}
                        />
                        {fmt(gems ? price.gems : price.gold)}
                      </span>
                      <FButton
                        variant={gems ? 'gem' : 'primary'}
                        disabled={!affordable}
                        onClick={() => buy(stall.tier)}
                      >
                        {firstPurchase ? t('stable.buy') : t('stable.upgrade')}
                      </FButton>
                    </>
                  )}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
