import { useEffect } from 'react';
import { getLocale, LOCALES } from '@/content/expeditions';
import { EXPEDITION_COST, HEROISM_GOLD, HEROISM_SILVER } from '@/engine/constants';
import { canStartExpedition, chestTier, expeditionsLeft } from '@/engine/expeditions';
import type { ExpeditionCard } from '@/engine/types';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { ExpedRewards } from '../components/PvePlayback';
import { FButton } from '../components/FButton';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';
import type { IconId } from '../icons.gen';

function LocaleArt({ bg, className = '' }: { bg: number; className?: string }) {
  return (
    <picture>
      <source
        type="image/avif"
        srcSet={`/assets/bg/mission_background_${bg}-1280.avif 1280w`}
      />
      <img
        src={`/assets/bg/mission_background_${bg}-1280.webp`}
        alt=""
        loading="lazy"
        className={`h-full w-full object-cover ${className}`}
      />
    </picture>
  );
}

function LocaleSelect() {
  const save = useGame((s) => s.save)!;
  const start = useGame((s) => s.expedStart);
  const toast = useGame((s) => s.toast);
  const gate = canStartExpedition(save);
  const left = expeditionsLeft(save);

  return (
    <>
      <Panel variant="primary">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-gold-bright">
              {t('exped.title')}
            </h1>
            <p className="text-sm text-ink-muted">{t('exped.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
              {t('exped.left')}
            </span>
            {Array.from({ length: Math.max(left, 1) }, (_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full border border-black/50 ${i < left ? 'bg-vigor' : 'bg-panel-inset'}`}
              />
            ))}
          </div>
        </div>
      </Panel>
      <div className="grid gap-3 sm:grid-cols-2">
        {LOCALES.map((locale) => (
          <div key={locale.id} className="frame-secondary panel-fill overflow-hidden p-1.5">
            <div className="relative h-32 overflow-hidden md:h-40">
              <LocaleArt bg={locale.bg} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-2 left-3">
                <div className="font-display text-lg font-bold text-ink [text-shadow:0_2px_5px_#000]">
                  {t(locale.nameKey as I18nKey)}
                </div>
                <div className="text-[11px] text-ink-muted [text-shadow:0_1px_3px_#000]">
                  {/* "usually" because the reserves can hold the slot instead
                      (content/expeditions.ts) — the card should not promise a
                      name the run may not deliver. */}
                  {t('exped.minibossUsually', {
                    name: t(`miniboss.${locale.minibossSlug}.name` as I18nKey),
                  })}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-2 py-2">
              <span className="text-[11px] font-bold text-vigor">
                {t('exped.cost', { vigor: EXPEDITION_COST })}
              </span>
              <FButton
                size="sm"
                disabled={!gate.ok}
                onClick={() => {
                  if (gate.ok) start(locale.id);
                  else if (gate.reason === 'vigor') toast(t('exped.reasonVigor'));
                }}
              >
                {t('exped.embark')}
              </FButton>
            </div>
          </div>
        ))}
      </div>
      {!gate.ok && gate.reason === 'limit' && (
        <p className="text-center text-sm text-ink-faint">{t('exped.reasonLimit')}</p>
      )}
    </>
  );
}

const CARD_META: Record<
  ExpeditionCard['kind'],
  { icon: IconId; labelKey: I18nKey; buttonKey: I18nKey }
> = {
  fight: { icon: 'wolf', labelKey: 'exped.card.fight', buttonKey: 'exped.fight' },
  miniboss: { icon: 'crown', labelKey: 'exped.card.miniboss', buttonKey: 'exped.fight' },
  treasure: { icon: 'gold', labelKey: 'exped.card.treasure', buttonKey: 'exped.open' },
  event: { icon: 'map-pin', labelKey: 'exped.card.event', buttonKey: 'exped.open' },
};

function CardFace({ card, index }: { card: ExpeditionCard; index: number }) {
  const resolve = useGame((s) => s.expedResolve);
  const meta = CARD_META[card.kind];
  return (
    <div className="frame-secondary panel-fill flex min-h-44 flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <Icon id={meta.icon} size={20} className={card.kind === 'miniboss' ? 'text-gold' : 'text-ink-muted'} />
        <span className="text-sm font-bold text-ink">{t(meta.labelKey)}</span>
      </div>
      {card.kind === 'fight' && (
        <p className="text-xs text-ink-muted italic">{t(`exped.foe.${card.foe}` as I18nKey)}</p>
      )}
      {card.kind === 'event' && (
        <p className="text-xs leading-relaxed text-ink-muted">
          {t(`exped.event.${card.eventIndex}.prompt` as I18nKey)}
        </p>
      )}
      <div className="mt-auto flex flex-col gap-1.5">
        {card.kind === 'event' ? (
          <>
            <FButton size="sm" variant="quiet" onClick={() => resolve(index, 'safe')}>
              {t(`exped.event.${card.eventIndex}.safe` as I18nKey)}
            </FButton>
            <FButton size="sm" onClick={() => resolve(index, 'bold')}>
              {t(`exped.event.${card.eventIndex}.bold` as I18nKey)}
            </FButton>
          </>
        ) : (
          <FButton size="sm" onClick={() => resolve(index)}>
            {t(meta.buttonKey)}
          </FButton>
        )}
      </div>
    </div>
  );
}

function ActiveRun() {
  const save = useGame((s) => s.save)!;
  const outcome = useGame((s) => s.expedOutcome);
  const closeOutcome = useGame((s) => s.closeExpedOutcome);
  const abandon = useGame((s) => s.expedAbandon);
  const ensure = useGame((s) => s.expedEnsureCards);
  const exp = save.activities.expedition!;
  const locale = getLocale(exp.localeId);

  useEffect(() => {
    if (!exp.cards) ensure();
  }, [exp.cards, ensure]);

  const tier = chestTier(exp.heroism);
  const nextTier =
    exp.heroism >= HEROISM_GOLD
      ? null
      : exp.heroism >= HEROISM_SILVER
        ? { name: t('exped.tier.gold'), missing: HEROISM_GOLD - exp.heroism }
        : { name: t('exped.tier.silver'), missing: HEROISM_SILVER - exp.heroism };
  // The run ends inside a resolution (step advances past 4) — while the final
  // outcome is open we keep rendering its reward panel, not the card table.
  const finished = outcome !== null && outcome.chest !== null;
  const inlineOutcome = outcome !== null && outcome.result === null;

  return (
    <>
      <Panel variant="primary" className="overflow-hidden p-1.5">
        <div className="relative h-36 overflow-hidden md:h-44">
          <LocaleArt bg={locale.bg} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
          <div className="absolute right-3 bottom-2 left-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="font-display text-xl font-bold text-gold-bright [text-shadow:0_2px_5px_#000]">
                  {t(locale.nameKey as I18nKey)}
                </div>
                <div className="text-xs font-bold text-ink [text-shadow:0_1px_3px_#000]">
                  {t('exped.step', { step: Math.min(exp.step + 1, 5) })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-extrabold tracking-wider text-ink-muted uppercase [text-shadow:0_1px_3px_#000]">
                  {t('exped.heroism')} · {exp.heroism} · {t(`exped.tier.${tier}` as I18nKey)}
                </div>
                <div className="mt-1 flex items-center gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={`h-2 w-8 rounded-sm border border-black/50 ${i < exp.step ? 'bg-honor' : 'bg-panel-inset/80'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {nextTier && (
        <p className="text-center text-[11px] font-semibold text-ink-faint">
          {t('exped.tierPreview', { n: nextTier.missing, tier: nextTier.name })}
        </p>
      )}
      {!nextTier && (
        <p className="text-center text-[11px] font-semibold text-gold">{t('exped.tierMax')}</p>
      )}

      {inlineOutcome ? (
        <Panel variant="secondary">
          <ExpedRewards outcome={outcome} />
          <div className="mt-3 flex justify-end">
            <FButton onClick={closeOutcome}>
              {finished ? t('exped.finish') : t('exped.continue')}
            </FButton>
          </div>
        </Panel>
      ) : (
        exp.cards && (
          <div className="grid gap-3 sm:grid-cols-3">
            {exp.cards.map((card, i) => (
              <CardFace key={`${exp.step}-${i}`} card={card} index={i} />
            ))}
          </div>
        )
      )}

      {!finished && (
        <div className="flex justify-center">
          <FButton variant="quiet" size="sm" onClick={abandon}>
            {t('exped.abandon')}
          </FButton>
        </div>
      )}
    </>
  );
}

export function ExpeditionScreen() {
  const save = useGame((s) => s.save);
  const active = useGame((s) => Boolean(s.save?.activities.expedition));
  const outcome = useGame((s) => s.expedOutcome);
  if (!save) return null;
  // After the run's final card the expedition is null but its chest is still
  // on screen — keep the run view until the player closes it.
  const holdingFinal = outcome !== null && outcome.chest !== null && outcome.result === null;
  return (
    <div className="flex flex-col gap-4">
      {active || holdingFinal ? <FinalOrActive /> : <LocaleSelect />}
    </div>
  );
}

/** Chooses between the live run and the lingering final-chest panel. */
function FinalOrActive() {
  const save = useGame((s) => s.save)!;
  const outcome = useGame((s) => s.expedOutcome);
  const closeOutcome = useGame((s) => s.closeExpedOutcome);
  if (save.activities.expedition) return <ActiveRun />;
  if (!outcome) return null;
  return (
    <Panel variant="secondary">
      <ExpedRewards outcome={outcome} />
      <div className="mt-3 flex justify-end">
        <FButton onClick={closeOutcome}>{t('exped.finish')}</FButton>
      </div>
    </Panel>
  );
}
