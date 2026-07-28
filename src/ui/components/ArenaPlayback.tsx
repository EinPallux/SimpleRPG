import type { ArenaOutcome } from '@/engine/arena';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { fmt } from '../format';
import { CombatPlayback } from './CombatPlayback';
import { Icon } from './Icon';
import { ItemCard } from './ItemCard';

function RewardStrip({ outcome }: { outcome: ArenaOutcome }) {
  if (outcome.sparring) {
    return <p className="mt-3 text-sm text-ink-muted italic">{t('arena.reward.sparNote')}</p>;
  }
  const defeatLine = t(
    `arena.defeatLine.${Math.abs(outcome.result.seed[0] ?? 0) % 5}` as I18nKey,
  );
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold">
        <span className={`inline-flex items-center gap-1 ${outcome.honorDelta >= 0 ? 'text-honor' : 'text-[#e08a7a]'}`}>
          <Icon id="honor" size={14} />
          {t('arena.reward.honor', {
            honor: `${outcome.honorDelta >= 0 ? '+' : '−'}${Math.abs(outcome.honorDelta)}`,
          })}
        </span>
        {outcome.gold > 0 && (
          <span className="inline-flex items-center gap-1 text-gold">
            <Icon id="gold" size={14} /> {t('arena.reward.gold', { gold: fmt(outcome.gold) })}
          </span>
        )}
        {outcome.xp && (
          <span className="text-xp">{t('arena.reward.xp', { xp: fmt(outcome.xp.gained) })}</span>
        )}
      </div>
      <p className="text-xs font-semibold text-ink-muted">
        {t('arena.rankNow', { rank: outcome.newRank })}
      </p>
      {!outcome.won && <p className="text-xs text-ink-faint italic">{defeatLine}</p>}
      {outcome.chest && outcome.chestAutoSoldGold === 0 && (
        <div>
          <p className="mb-1.5 text-xs font-bold text-gold-bright">{t('arena.reward.chest')}</p>
          <ItemCard item={outcome.chest} />
        </div>
      )}
      {outcome.chestAutoSoldGold > 0 && (
        <p className="text-xs font-semibold text-ink-muted">
          {t('arena.reward.chestSold', { gold: fmt(outcome.chestAutoSoldGold) })}
        </p>
      )}
    </div>
  );
}

/**
 * Shell-level playback for arena bouts: whatever screen started the fight
 * (Arena offers or a Hall of Fame profile), the theater plays here.
 */
export function ArenaPlayback() {
  const save = useGame((s) => s.save);
  const outcome = useGame((s) => s.arenaOutcome);
  const close = useGame((s) => s.closeArenaOutcome);
  if (!save || !outcome) return null;
  return (
    <CombatPlayback
      a={{
        combatant: outcome.heroCombatant,
        emblem: save.hero.portrait,
        classId: save.hero.classId,
      }}
      b={{
        combatant: outcome.opponentCombatant,
        emblem: outcome.opponent.emblem,
        classId: outcome.opponent.classId,
      }}
      result={outcome.result}
      onDone={close}
    >
      <RewardStrip outcome={outcome} />
    </CombatPlayback>
  );
}
