import { useEffect } from 'react';
import { frontierZoneIndex, getZone, ZONES } from '@/content/zones';
import {
  ALE_COST_GEMS,
  ALE_MAX_PER_DAY,
  REFILL_SECOND_WIND,
  VIGOR_DAILY_BASE,
} from '@/engine/constants';
import { missionEndsAt, tavernRerollCost } from '@/engine/missions';
import { canBuyAle, canClaimSecondWind } from '@/engine/vigor';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { BackgroundArt } from '../components/BackgroundArt';
import { FButton } from '../components/FButton';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';
import { StoryBanner } from '../components/StoryBanner';
import { ProgressBar } from '../components/ProgressBar';
import { TimerBar } from '../components/TimerBar';
import { fmt } from '../format';
import { useGameClock } from '../hooks/useGameClock';
import { missionFlavor } from '../itemName';

function OfferCard({ index }: { index: number }) {
  const save = useGame((s) => s.save)!;
  const accept = useGame((s) => s.tavernAccept);
  const offer = save.activities.tavernOffers?.[index];
  if (!offer) return null;

  const zone = getZone(offer.zoneIndex);
  const affordable = save.daily.vigor >= offer.durationMin;
  const busy = save.activities.mission !== null || save.activities.patrol !== null;

  return (
    <div
      className={`${offer.lucky ? 'frame-special' : 'frame-secondary'} panel-fill relative flex flex-col overflow-hidden`}
    >
      <div className="relative h-20 shrink-0 overflow-hidden">
        <BackgroundArt name={zone.bg} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <span className="absolute bottom-1 left-2 text-xs font-bold text-ink [text-shadow:0_1px_3px_#000]">
          {t(zone.nameKey as I18nKey)}
        </span>
        {offer.lucky && (
          <span className="absolute top-1.5 right-1.5 rounded-sm bg-teal px-1.5 py-0.5 text-[9px] font-extrabold text-canvas">
            {t('tavern.offerLucky')}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="min-h-10 flex-1 text-xs leading-snug text-ink-muted italic">
          {missionFlavor(offer.zoneIndex, offer.flavor)}
        </p>
        <div className="flex items-center justify-between text-[11px] font-bold text-ink-faint">
          <span>{t('tavern.offerDuration', { min: offer.durationMin })}</span>
          <span className="text-gold">
            {t('tavern.rewards', { gold: fmt(offer.gold), xp: fmt(offer.xp) })}
          </span>
        </div>
        <FButton
          className="w-full"
          disabled={!affordable || busy}
          title={busy ? t('tavern.busy') : affordable ? undefined : t('tavern.cantAfford')}
          onClick={() => accept(index)}
        >
          {t('tavern.accept')}
        </FButton>
      </div>
    </div>
  );
}

function ActiveMission() {
  const save = useGame((s) => s.save)!;
  const claim = useGame((s) => s.tavernClaim);
  const now = useGameClock();
  const mission = save.activities.mission;
  if (!mission) return null;

  const zone = getZone(mission.payload.zoneIndex);
  const done = now >= missionEndsAt(mission);

  return (
    <Panel variant="primary" className="overflow-hidden p-1.5">
      <div className="relative h-44 overflow-hidden md:h-56">
        <BackgroundArt name={zone.bg} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute right-4 bottom-3 left-4">
          <h2 className="font-display text-lg font-bold text-gold-bright [text-shadow:0_2px_5px_#000]">
            {t('tavern.activeTitle')} · {t(zone.nameKey as I18nKey)}
          </h2>
          <p className="mb-2 text-xs text-ink/90 italic [text-shadow:0_1px_3px_#000]">
            {missionFlavor(mission.payload.zoneIndex, mission.payload.flavor)}
          </p>
          {done ? (
            <FButton size="lg" className="w-full animate-pulse" onClick={claim}>
              {t('tavern.claimReady')} — {t('tavern.claim')}
            </FButton>
          ) : (
            <TimerBar activity={mission} nowMs={now} />
          )}
        </div>
      </div>
    </Panel>
  );
}

function VigorPanel() {
  const save = useGame((s) => s.save)!;
  const secondWind = useGame((s) => s.secondWind);
  const ale = useGame((s) => s.ale);
  const { daily, hero } = save;

  return (
    <Panel variant="secondary" title={t('hud.vigor')}>
      <ProgressBar
        variant="vigor"
        value={daily.vigor}
        max={Math.max(VIGOR_DAILY_BASE, daily.vigor)}
        label={`${daily.vigor}`}
        className="h-5"
        title={t('hud.vigorTooltip')}
      />
      <div className="mt-3 flex flex-col gap-2">
        <FButton
          disabled={!canClaimSecondWind(save)}
          onClick={secondWind}
          title={t('tavern.secondWindHint')}
          className={canClaimSecondWind(save) ? 'animate-pulse' : ''}
        >
          <Icon id="tavern" size={16} />
          {canClaimSecondWind(save)
            ? `${t('tavern.secondWind')} +${REFILL_SECOND_WIND}`
            : t('tavern.secondWindClaimed')}
        </FButton>
        <FButton
          variant="gem"
          disabled={!canBuyAle(save)}
          onClick={ale}
          title={
            daily.aleUsed >= ALE_MAX_PER_DAY
              ? t('tavern.aleNone')
              : t('tavern.aleHint', { left: ALE_MAX_PER_DAY - daily.aleUsed })
          }
        >
          <Icon id="gem" size={15} />
          {t('tavern.ale')} · {ALE_COST_GEMS} 💎 ({ALE_MAX_PER_DAY - daily.aleUsed})
        </FButton>
        <p className="text-[11px] text-ink-faint">
          {fmt(hero.gems)} 💎 {t('hud.gems')}
        </p>
      </div>
    </Panel>
  );
}

function BoardControls() {
  const save = useGame((s) => s.save)!;
  const reroll = useGame((s) => s.tavernReroll);
  const setPin = useGame((s) => s.setZonePin);
  const cost = tavernRerollCost(save);
  const frontier = frontierZoneIndex(save.hero.level);
  const unlocked = ZONES.filter((z) => z.index <= frontier);

  return (
    <Panel variant="secondary" title={t('tavern.zonePin')}>
      <select
        value={save.progress.zonePinned ?? frontier}
        onChange={(e) => {
          const v = Number(e.target.value);
          setPin(v === frontier ? null : v);
        }}
        aria-label={t('tavern.zonePin')}
        className="w-full rounded-sm border border-ink-faint/40 bg-panel-inset px-2 py-1.5 text-sm font-bold text-ink"
      >
        {unlocked.map((zone) => (
          <option key={zone.id} value={zone.index}>
            {zone.index === frontier
              ? t('tavern.zoneFrontier', { zone: t(zone.nameKey as I18nKey) })
              : t(zone.nameKey as I18nKey)}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">{t('tavern.zoneDecayHint')}</p>
      <FButton
        variant={cost > 0 ? 'gem' : 'quiet'}
        size="sm"
        className="mt-3 w-full"
        disabled={save.hero.gems < cost}
        onClick={reroll}
      >
        {cost > 0 ? t('tavern.rerollPaid') : t('tavern.reroll')}
      </FButton>
    </Panel>
  );
}

export function TavernScreen() {
  const save = useGame((s) => s.save);
  const ensureOffers = useGame((s) => s.tavernEnsureOffers);
  const hasOffers = useGame((s) => s.save?.activities.tavernOffers !== null);
  const hasMission = useGame((s) => s.save?.activities.mission !== null);

  useEffect(() => {
    if (!hasOffers && !hasMission) ensureOffers();
  }, [hasOffers, hasMission, ensureOffers]);

  if (!save) return null;

  return (
    <div className="flex flex-col gap-4">
      <StoryBanner />
      {hasMission ? (
        <ActiveMission />
      ) : (
        <Panel variant="primary" title={t('screen.tavern.title')}>
          <p className="-mt-2 mb-3 text-xs text-ink-muted italic">{t('screen.tavern.welcome')}</p>
          <div className="grid gap-3 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <OfferCard
                key={`${i}-${save.activities.tavernOffers?.[i]?.flavor ?? 'x'}`}
                index={i}
              />
            ))}
          </div>
        </Panel>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <VigorPanel />
        <BoardControls />
      </div>
    </div>
  );
}
