/**
 * What the Wishing Well hands back (GAME_DESIGN.md §10).
 *
 * Two jobs beyond showing the loot. First, a dupe must read as a *conversion*,
 * never as a miss: the set piece you already own says "dust instead", the pet
 * you already adopted says "treats instead", and both keep the prize line above
 * them. Second, a guarantee announces itself — if pity paid for this result,
 * the card says so, because a pity counter you cannot see paying out is just a
 * number that moves.
 *
 * `Again` re-tosses the same banner at the same count and is priced in plain
 * gems the hero already owns; there is no purchase path here and none to add.
 */
import { useEffect, useState } from 'react';
import type { BannerId } from '@/content/collectibles';
import { bannerNameKey, frameNameKey, outcomeLabelKey } from '@/content/gacha';
import { petNameKey } from '@/content/pets';
import { getSet } from '@/content/sets';
import { TOSS_TEN_COUNT } from '@/engine/constants';
import { canToss, tossCost, type TossResult } from '@/engine/gacha';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { fmt } from '../format';
import { FButton } from './FButton';
import { Icon } from './Icon';
import { ItemCard } from './ItemCard';
import { Modal } from './Modal';

/** The bundle only pays out when the consumable slot did not roll a frame. */
function isBundle(result: TossResult): boolean {
  return result.kind === 'consumable' && result.frameId === null;
}

function ResultCard({
  result,
  index,
  focal,
}: {
  result: TossResult;
  index: number;
  focal: boolean;
}) {
  const eyebrow = result.frameId
    ? t('well.outcome.frame')
    : t(outcomeLabelKey(result.kind) as I18nKey);

  return (
    <div
      className="frame-secondary panel-fill screen-enter flex flex-col items-center gap-1.5 p-3 text-center"
      style={{
        // Staggered by the shared motion token, so "reduce motion" (which zeroes
        // --motion-base) lands every card at once instead of trickling.
        animationDelay: `calc(var(--motion-base) * ${index * 0.4})`,
        animationFillMode: 'backwards',
      }}
    >
      <p
        className={`font-extrabold tracking-[0.14em] text-ink-faint uppercase ${focal ? 'text-xs' : 'text-[10px]'}`}
      >
        {eyebrow}
      </p>

      {result.frameId && (
        <p className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-teal">
          <Icon id="star" size={14} />
          {t('well.gotFrame', { name: t(frameNameKey(result.frameId) as I18nKey) })}
        </p>
      )}

      {isBundle(result) && (
        <>
          <p className="text-sm font-bold text-ink">{t('well.bundle')}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-bold">
            {result.gold > 0 && (
              <span className="inline-flex items-center gap-1 text-gold">
                <Icon id="gold" size={13} /> {t('quests.reward.gold', { gold: fmt(result.gold) })}
              </span>
            )}
            {result.scraps > 0 && (
              <span className="inline-flex items-center gap-1 text-ink-muted">
                <Icon id="scraps" size={13} /> {t('quests.reward.scraps', { n: result.scraps })}
              </span>
            )}
            {result.treats > 0 && (
              <span className="inline-flex items-center gap-1 text-ink-muted">
                <Icon id="treats" size={13} /> {t('quests.reward.treats', { n: result.treats })}
              </span>
            )}
          </div>
        </>
      )}

      {result.kind === 'setPiece' && result.setId && (
        <p className="font-display text-sm font-bold text-[#35c99a]">
          {t(getSet(result.setId).nameKey as I18nKey)}
        </p>
      )}

      {result.kind === 'petEgg' && result.petId && (
        <p className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-gold-bright">
          <Icon id="menagerie" size={14} />
          {t('well.gotPet', { name: t(petNameKey(result.petId) as I18nKey) })}
        </p>
      )}

      {result.item && <ItemCard item={result.item} />}

      {/* Nothing is wasted: the dupe lines say what it turned into. */}
      {result.dupe && result.kind === 'setPiece' && (
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#b48fd9]">
          <Icon id="dust" size={13} /> {t('well.dupeSet', { n: result.dust })}
        </p>
      )}
      {result.dupe && result.kind === 'petEgg' && (
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
          <Icon id="treats" size={13} /> {t('well.dupePet', { n: result.treats })}
        </p>
      )}

      {result.autoSoldGold > 0 && (
        <p className="text-xs font-semibold text-ink-muted">
          {t('arena.reward.chestSold', { gold: fmt(result.autoSoldGold) })}
        </p>
      )}

      {result.pity && (
        <p className="animate-pulse text-[11px] font-bold text-gold-bright">
          {t(result.pity === 'epic' ? 'well.pityHitEpic' : 'well.pityHitSet')}
        </p>
      )}
    </div>
  );
}

export function TossReveal({
  bannerId,
  results,
  onClose,
}: {
  bannerId: BannerId;
  results: TossResult[];
  onClose: () => void;
}) {
  const save = useGame((s) => s.save);
  const toss = useGame((s) => s.wellToss);

  // Modal moves focus to the dialog on mount, so the opener is captured during
  // the first render and handed focus back when the reveal closes.
  const [opener] = useState<Element | null>(() => document.activeElement);
  useEffect(() => {
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [opener]);

  const ten = results.length === TOSS_TEN_COUNT;
  const count = ten ? TOSS_TEN_COUNT : 1;
  const cost = save ? tossCost(save, bannerId, count) : 0;
  const affordable = save ? canToss(save, bannerId, count) : false;
  // Every toss bumps the ledger, so the counter doubles as a batch id: a re-toss
  // remounts the cards and the reveal plays again.
  const batch = save?.stats.gachaTosses ?? 0;

  return (
    <Modal title={t('well.results')} onClose={onClose} wide={ten}>
      <p className="-mt-2 mb-3 text-center text-xs font-bold tracking-wider text-ink-faint uppercase">
        {t(bannerNameKey(bannerId) as I18nKey)}
      </p>

      <div key={batch} className={ten ? 'grid gap-2 sm:grid-cols-2' : 'flex justify-center'}>
        {results.map((result, i) => (
          <ResultCard key={i} result={result} index={ten ? i : 0} focal={!ten} />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {affordable && cost > 0 ? (
          <span className="mr-auto inline-flex items-center gap-1 text-xs font-bold text-gem">
            <Icon id="gem" size={13} /> {t('well.gems', { n: cost })}
          </span>
        ) : (
          !affordable && (
            <span className="mr-auto text-xs font-semibold text-ink-faint">{t('well.noGems')}</span>
          )
        )}
        <FButton variant="quiet" onClick={onClose} autoFocus>
          {t('well.close')}
        </FButton>
        <FButton variant="gem" disabled={!affordable} onClick={() => toss(bannerId, count)}>
          {t('well.again')}
        </FButton>
      </div>
    </Modal>
  );
}
