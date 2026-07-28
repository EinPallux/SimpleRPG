import type { MissionRewards } from '@/engine/missions';
import { getZone } from '@/content/zones';
import { t, type I18nKey } from '@/i18n';
import { fmt } from '../format';
import { FButton } from './FButton';
import { ItemCard } from './ItemCard';
import { Modal } from './Modal';

/** The chest-open moment (UI_DESIGN §7): xp → level-up → gold → items. */
export function RewardReveal({
  rewards,
  onClose,
}: {
  rewards: MissionRewards;
  onClose: () => void;
}) {
  const zone = getZone(rewards.zoneIndex);
  return (
    <Modal title={t('reveal.title')} onClose={onClose}>
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-xs text-ink-faint">{t(zone.nameKey as I18nKey)}</p>
        {rewards.lucky && (
          <p className="animate-pulse font-display text-sm font-bold text-gold-bright">
            {t('reveal.lucky')}
          </p>
        )}
        <p className="font-display text-2xl font-bold text-xp">
          {t('reveal.xp', { xp: fmt(rewards.xp.gained) })}
        </p>
        {rewards.xp.levelsGained > 0 && (
          <p className="frame-legendary panel-fill px-4 py-2 font-display text-lg font-bold text-gold-bright [text-shadow:0_0_12px_rgba(240,199,94,.6)]">
            {t('reveal.levelUp', { level: rewards.xp.newLevel })}
          </p>
        )}
        <p className="font-display text-xl font-semibold text-gold">
          {t('reveal.gold', { gold: fmt(rewards.gold) })}
        </p>
        {(rewards.item || rewards.chest) && (
          <div className="mt-1 flex flex-wrap items-start justify-center gap-3">
            {rewards.item && (
              <div>
                <p className="mb-1 text-xs font-bold text-ink-muted">{t('reveal.item')}</p>
                <ItemCard item={rewards.item} />
              </div>
            )}
            {rewards.chest && (
              <div>
                <p className="mb-1 text-xs font-bold text-gold-bright">{t('reveal.chest')}</p>
                <ItemCard item={rewards.chest} />
              </div>
            )}
          </div>
        )}
        {rewards.autoSoldGold > 0 && (
          <p className="text-xs text-ink-faint">
            {t('reveal.autoSold', { gold: fmt(rewards.autoSoldGold) })}
          </p>
        )}
        <FButton size="lg" onClick={onClose} autoFocus>
          {t('reveal.collect')}
        </FButton>
      </div>
    </Modal>
  );
}
