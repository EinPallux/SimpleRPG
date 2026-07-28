import type { GrantedReward } from '@/engine/rewards';
import { getTitle } from '@/content/titles';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { fmt } from '../format';
import { FButton } from './FButton';
import { Icon } from './Icon';
import { ItemCard } from './ItemCard';
import { Modal } from './Modal';

/** Every payout the meta layer can hand over, in one reusable reveal. */
export function RewardLines({ reward }: { reward: GrantedReward }) {
  const lines: React.ReactNode[] = [];
  if (reward.gold > 0) {
    lines.push(
      <span key="gold" className="inline-flex items-center gap-1 text-gold">
        <Icon id="gold" size={14} /> {t('quests.reward.gold', { gold: fmt(reward.gold) })}
      </span>,
    );
  }
  if (reward.xp) {
    lines.push(
      <span key="xp" className="text-xp">
        {t('quests.reward.xp', { xp: fmt(reward.xp.gained) })}
      </span>,
    );
  }
  if (reward.gems > 0) {
    lines.push(
      <span key="gems" className="inline-flex items-center gap-1 text-gem">
        <Icon id="gem" size={14} /> {t('quests.reward.gems', { n: reward.gems })}
      </span>,
    );
  }
  if (reward.scraps > 0) {
    lines.push(
      <span key="scraps" className="inline-flex items-center gap-1 text-ink-muted">
        <Icon id="scraps" size={14} /> {t('quests.reward.scraps', { n: reward.scraps })}
      </span>,
    );
  }
  if (reward.dust > 0) {
    lines.push(
      <span key="dust" className="inline-flex items-center gap-1 text-ink-muted">
        <Icon id="dust" size={14} /> {t('quests.reward.dust', { n: reward.dust })}
      </span>,
    );
  }
  if (reward.treats > 0) {
    lines.push(
      <span key="treats" className="inline-flex items-center gap-1 text-ink-muted">
        <Icon id="treats" size={14} /> {t('quests.reward.treats', { n: reward.treats })}
      </span>,
    );
  }
  return (
    <>
      {lines.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold">{lines}</div>
      )}
      {reward.potion && (
        <p className="text-xs font-semibold text-teal">{t('quests.reward.elixir')}</p>
      )}
      {reward.titleId && (
        <p className="text-sm font-bold text-gold-bright">
          “{t(getTitle(reward.titleId).nameKey as I18nKey)}”
        </p>
      )}
      {reward.frameId && (
        <p className="text-xs font-semibold text-teal">{t('quests.reward.frame')}</p>
      )}
      {reward.items.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
      {reward.autoSoldGold > 0 && (
        <p className="text-xs font-semibold text-ink-muted">
          {t('arena.reward.chestSold', { gold: fmt(reward.autoSoldGold) })}
        </p>
      )}
    </>
  );
}

/** Shell-level reveal for quest / story / chest / calendar payouts. */
export function MetaRewardModal() {
  const payload = useGame((s) => s.metaReward);
  const close = useGame((s) => s.closeMetaReward);
  if (!payload) return null;
  return (
    <Modal title={t(payload.titleKey)} onClose={close}>
      <div className="flex flex-col items-start gap-2.5">
        <RewardLines reward={payload.reward} />
      </div>
      <div className="mt-4 flex justify-end">
        <FButton onClick={close} autoFocus>
          {t('combat.continue')}
        </FButton>
      </div>
    </Modal>
  );
}
