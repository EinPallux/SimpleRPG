import { useMemo, useState } from 'react';
import {
  arenaCooldownRemaining,
  fightsLeft,
  getArenaOffers,
  type ArenaOffer,
} from '@/engine/arena';
import { playerRank } from '@/engine/botworld';
import { systemClock } from '@/engine/clock';
import {
  ARENA_COOLDOWN_SKIP_GEMS,
  ARENA_FIGHTS_PER_DAY,
  ARENA_MILESTONES,
} from '@/engine/constants';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { BotProfileModal } from '../components/BotProfileModal';
import { EmblemAvatar } from '../components/EmblemAvatar';
import { FButton } from '../components/FButton';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';
import { fmt, formatCountdown } from '../format';
import { useGameClock } from '../hooks/useGameClock';

const TIER_KEYS = ['arena.tier.below', 'arena.tier.par', 'arena.tier.above'] as const;

function FightsPips({ left }: { left: number }) {
  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={`${t('arena.fightsLeft')}: ${left}/${ARENA_FIGHTS_PER_DAY}`}
    >
      {Array.from({ length: ARENA_FIGHTS_PER_DAY }, (_, i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-full border border-black/50 ${
            i < left ? 'bg-gold' : 'bg-panel-inset'
          }`}
        />
      ))}
    </div>
  );
}

function OfferCard({
  offer,
  tier,
  sparring,
  disabled,
  onFight,
  onPeek,
}: {
  offer: ArenaOffer;
  tier: number;
  sparring: boolean;
  disabled: boolean;
  onFight: () => void;
  onPeek: () => void;
}) {
  const bot = offer.bot;
  return (
    <div className="frame-secondary panel-fill flex flex-col gap-2.5 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-extrabold tracking-[0.14em] text-ink-faint uppercase">
          {t(TIER_KEYS[tier] as I18nKey)}
        </span>
        <span className="rounded-sm bg-panel-inset px-1.5 py-0.5 text-[10px] font-extrabold text-ink-muted">
          {t('arena.rank', { rank: offer.rank })}
        </span>
      </div>

      <button
        onClick={onPeek}
        className="flex items-center gap-2.5 text-left transition-[filter] hover:brightness-125"
        title={bot.name}
      >
        <EmblemAvatar emblem={bot.emblem} classId={bot.classId} size={44} />
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-ink">{bot.name}</div>
          <div className="truncate text-[11px] font-semibold text-ink-faint">
            {bot.guildTag ? `[${bot.guildTag}] ` : ''}
            {t(`class.${bot.classId}.name` as I18nKey)} ·{' '}
            {t('common.levelShort', { level: bot.level })}
          </div>
        </div>
      </button>

      <div className="flex items-center justify-between text-xs font-bold">
        <span className="inline-flex items-center gap-1 text-honor">
          <Icon id="honor" size={13} /> {fmt(bot.honor)}
        </span>
        <span
          className={
            offer.stance === 'risky'
              ? 'text-[#e08a7a]'
              : offer.stance === 'safe'
                ? 'text-success'
                : 'text-ink-muted'
          }
        >
          {t(`arena.stance.${offer.stance}` as I18nKey)}
        </span>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-ink-muted">
          {sparring ? t('arena.reward.sparNote') : t('arena.honorPreview', { honor: offer.honorOnWin })}
        </span>
      </div>
      <FButton onClick={onFight} disabled={disabled}>
        <Icon id="arena" size={15} /> {sparring ? t('arena.spar') : t('arena.fight')}
      </FButton>
    </div>
  );
}

export function ArenaScreen() {
  const save = useGame((s) => s.save);
  const fight = useGame((s) => s.arenaFight);
  const skipCooldown = useGame((s) => s.arenaSkipCooldown);
  const now = useGameClock();
  const [peek, setPeek] = useState<number | null>(null); // offer index being inspected

  // Offers are fixed for (dayKey, fightsToday) — recompute only when the save
  // object changes; the stance words cost a few rehearsal sims each time.
  const offers = useMemo(() => (save ? getArenaOffers(save, systemClock.now()) : []), [save]);
  const rank = useMemo(() => (save ? playerRank(save, systemClock.now()) : 0), [save]);

  if (!save) return null;

  const left = fightsLeft(save);
  const sparring = left === 0;
  const cooldownMs = arenaCooldownRemaining(save, now);
  const coolingDown = cooldownMs > 0;
  const nextMilestone = ARENA_MILESTONES.find(
    ([threshold]) => !save.progress.milestonesClaimed.includes(`arena-rank-${threshold}`),
  );
  const peekOffer = peek !== null ? offers[peek] : undefined;

  return (
    <div className="flex flex-col gap-4">
      <Panel variant="primary">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div>
            <h1 className="font-display text-2xl font-bold text-gold-bright">
              {t('arena.title')}
            </h1>
            <p className="text-sm text-ink-muted">{t('arena.subtitle')}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-3 text-sm font-bold">
              <span className="inline-flex items-center gap-1.5 text-honor">
                <Icon id="honor" size={16} /> {fmt(save.hero.honor)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-gold">
                <Icon id="crown" size={16} /> {t('arena.rank', { rank })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
                {t('arena.fightsLeft')}
              </span>
              <FightsPips left={left} />
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-ink-faint">
          {nextMilestone
            ? t('arena.nextMilestone', { rank: nextMilestone[0], gems: nextMilestone[1] })
            : t('arena.milestonesDone')}
        </p>
      </Panel>

      {coolingDown && (
        <Panel variant="secondary">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-bold text-ink-muted">
              {t('arena.cooldown', { time: formatCountdown(cooldownMs / 1000) })}
            </span>
            <FButton
              variant="gem"
              size="sm"
              disabled={save.hero.gems < ARENA_COOLDOWN_SKIP_GEMS}
              onClick={skipCooldown}
            >
              <Icon id="gem" size={14} /> {t('arena.skipGem')} ({ARENA_COOLDOWN_SKIP_GEMS})
            </FButton>
          </div>
        </Panel>
      )}

      {sparring && (
        <Panel variant="secondary">
          <p className="text-sm leading-relaxed text-ink-muted">
            <span className="mr-2 rounded-sm bg-panel-inset px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-teal uppercase">
              {t('arena.sparringChip')}
            </span>
            {t('arena.sparringBanner')}
          </p>
        </Panel>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {offers.map((offer, i) => (
          <OfferCard
            key={offer.bot.id}
            offer={offer}
            tier={i}
            sparring={sparring}
            disabled={coolingDown}
            onFight={() => fight(i)}
            onPeek={() => setPeek(i)}
          />
        ))}
      </div>

      {peekOffer && (
        <BotProfileModal
          bot={peekOffer.bot}
          rank={peekOffer.rank}
          save={save}
          nowMs={now}
          onClose={() => setPeek(null)}
          onFight={coolingDown ? undefined : () => fight(peek!)}
        />
      )}
    </div>
  );
}
