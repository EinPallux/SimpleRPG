/**
 * Shell-level playback wrappers for PvE bouts: dungeon walls and expedition
 * skirmishes replay through the shared CombatPlayback theater, each with its
 * own reward strip. Loss feedback turns the wall's numbers into words
 * (UI_DESIGN §6-13).
 */
import { getDungeon } from '@/content/dungeons';
import { expeditionMiniboss } from '@/engine/expeditions';
import type { BossTrait } from '@/content/dungeons';
import type { DungeonOutcome } from '@/engine/dungeons';
import type { ExpeditionStepOutcome } from '@/engine/expeditions';
import type { ExpeditionState } from '@/engine/types';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import type { IconId } from '../icons.gen';
import { FOE_ICON } from '../foeIcon';
import { fmt } from '../format';
import { CombatPlayback } from './CombatPlayback';
import { Icon } from './Icon';
import { ItemCard } from './ItemCard';

const TRAIT_ICON: Record<BossTrait, IconId> = {
  none: 'dungeon',
  swift: 'raven',
  caster: 'mage',
  brute: 'dragon',
  elite: 'crown',
};

function wallLine(hint: NonNullable<DungeonOutcome['wallHint']>): string {
  const hpLeft = Math.round(hint.bossHpLeftPct * 100);
  if (hpLeft <= 25) return t('dungeon.wall.close', { pct: hpLeft });
  if (hint.bossDr >= 0.35) return t('dungeon.wall.armor', { pct: Math.round(hint.bossDr * 100) });
  return t('dungeon.wall.hp', { pct: 100 - hpLeft });
}

function DungeonRewards({ outcome }: { outcome: DungeonOutcome }) {
  if (!outcome.won) {
    return (
      <div className="mt-3">
        <p className="text-sm font-bold text-[#e08a7a]">{t('dungeon.wall.title')}</p>
        {outcome.wallHint && (
          <p className="mt-1 text-xs text-ink-muted italic">{wallLine(outcome.wallHint)}</p>
        )}
      </div>
    );
  }
  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="text-sm font-bold text-gold-bright">
        {t('dungeon.reward.floor', { floor: outcome.floor, gems: outcome.gems })}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold">
        <span className="inline-flex items-center gap-1 text-gold">
          <Icon id="gold" size={14} /> {t('arena.reward.gold', { gold: fmt(outcome.gold) })}
        </span>
        {outcome.xp && (
          <span className="text-xp">{t('arena.reward.xp', { xp: fmt(outcome.xp.gained) })}</span>
        )}
        <span className="inline-flex items-center gap-1 text-gem">
          <Icon id="gem" size={14} /> +{outcome.gems}
        </span>
      </div>
      {outcome.drop && outcome.autoSoldGold === 0 && <ItemCard item={outcome.drop} />}
      {outcome.autoSoldGold > 0 && (
        <p className="text-xs font-semibold text-ink-muted">
          {t('arena.reward.chestSold', { gold: fmt(outcome.autoSoldGold) })}
        </p>
      )}
      {outcome.dungeonCleared && (
        <p className="text-xs font-bold text-teal">
          {t('dungeon.reward.wing', {
            dungeon: t(getDungeon(outcome.dungeonId).nameKey as I18nKey),
          })}
        </p>
      )}
    </div>
  );
}

export function DungeonPlayback() {
  const save = useGame((s) => s.save);
  const outcome = useGame((s) => s.dungeonOutcome);
  const close = useGame((s) => s.closeDungeonOutcome);
  if (!save || !outcome) return null;
  const trait = getDungeon(outcome.dungeonId).bosses[outcome.floor - 1]!.trait;
  return (
    <CombatPlayback
      a={{
        combatant: outcome.heroCombatant,
        emblem: save.hero.portrait,
        classId: save.hero.classId,
      }}
      b={{ combatant: outcome.boss, icon: TRAIT_ICON[trait] }}
      result={outcome.result}
      onDone={close}
    >
      <DungeonRewards outcome={outcome} />
    </CombatPlayback>
  );
}



/** Display copy of the expedition foe with a human-facing name. */
function expedFoeName(outcome: ExpeditionStepOutcome, exp: ExpeditionState | undefined): string {
  if (outcome.card.kind === 'miniboss') {
    // The run's own mini-boss, which may be one of the reserves rather than the
    // locale's regular (content/expeditions.ts MINIBOSS_RESERVES).
    return exp ? t(`miniboss.${expeditionMiniboss(exp)}.name` as I18nKey) : t('exped.card.miniboss');
  }
  if (outcome.card.kind === 'fight') return t(`exped.foe.${outcome.card.foe}` as I18nKey);
  return '';
}

/** Rewards from one resolved card — shared by the playback overlay (fights)
 * and the inline panel on the Expedition screen (treasure/events). */
export function ExpedRewards({ outcome }: { outcome: ExpeditionStepOutcome }) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold">
        <span className="text-honor">{t('exped.gainHeroism', { n: outcome.heroismGained })}</span>
        {outcome.gold > 0 && (
          <span className="inline-flex items-center gap-1 text-gold">
            <Icon id="gold" size={14} /> {t('exped.gainGold', { gold: fmt(outcome.gold) })}
          </span>
        )}
        {outcome.xp && (
          <span className="text-xp">{t('exped.gainXp', { xp: fmt(outcome.xp.gained) })}</span>
        )}
      </div>
      {outcome.chest && (
        <div className="mt-1 border-t border-ink-faint/20 pt-2">
          <p className="mb-1.5 text-sm font-bold text-gold-bright">
            {t('exped.chestTitle', { tier: t(`exped.tier.${outcome.chest.tier}` as I18nKey) })}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold">
            <span className="inline-flex items-center gap-1 text-gold">
              <Icon id="gold" size={14} />{' '}
              {t('exped.gainGold', { gold: fmt(outcome.chest.gold) })}
            </span>
            <span className="text-xp">
              {t('exped.gainXp', { xp: fmt(outcome.chest.xp.gained) })}
            </span>
          </div>
          {outcome.chest.item && outcome.chest.autoSoldGold === 0 && (
            <div className="mt-2">
              <ItemCard item={outcome.chest.item} />
            </div>
          )}
          {outcome.chest.autoSoldGold > 0 && (
            <p className="mt-1 text-xs font-semibold text-ink-muted">
              {t('arena.reward.chestSold', { gold: fmt(outcome.chest.autoSoldGold) })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ExpedPlayback() {
  const save = useGame((s) => s.save);
  const outcome = useGame((s) => s.expedOutcome);
  const close = useGame((s) => s.closeExpedOutcome);
  if (!save || !outcome || !outcome.result || !outcome.foe || !outcome.heroCombatant) return null;
  const exp = outcome.state ?? save.activities.expedition ?? undefined;
  const icon: IconId =
    outcome.card.kind === 'miniboss'
      ? 'crown'
      : outcome.card.kind === 'fight'
        ? (FOE_ICON[outcome.card.foe] ?? 'wolf')
        : 'wolf';
  return (
    <CombatPlayback
      a={{
        combatant: outcome.heroCombatant,
        emblem: save.hero.portrait,
        classId: save.hero.classId,
      }}
      b={{ combatant: { ...outcome.foe, name: expedFoeName(outcome, exp) }, icon }}
      result={outcome.result}
      onDone={close}
    >
      <ExpedRewards outcome={outcome} />
    </CombatPlayback>
  );
}
