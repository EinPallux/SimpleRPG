import { useState } from 'react';
import { ACHIEVEMENTS, achievementsOfCategory } from '@/content/achievements';
import type { AchievementCategory, AchievementDef } from '@/content/meta';
import {
  achievementAttrBonus,
  claimableAchievements,
  tiersClaimed,
  tiersEarned,
} from '@/engine/achievements';
import { metricValue } from '@/engine/metrics';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { FButton } from '../components/FButton';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';
import { ProgressBar } from '../components/ProgressBar';
import { fmt } from '../format';

const CATEGORIES: readonly AchievementCategory[] = [
  'progression',
  'combat',
  'collection',
  'economy',
  'exploration',
  'mastery',
  'secrets',
];

function AchievementCard({ def }: { def: AchievementDef }) {
  const save = useGame((s) => s.save)!;
  const claim = useGame((s) => s.achievementClaim);
  const claimed = tiersClaimed(save, def.id);
  const earned = tiersEarned(save, def);
  const claimable = earned > claimed;
  const maxed = claimed >= def.tiers.length;
  // The tier being worked toward (or the last one, when finished).
  const tierIndex = Math.min(claimed, def.tiers.length - 1);
  const target = def.tiers[tierIndex]!;
  const value = metricValue(save, def.metric);

  return (
    <div
      className={`frame-secondary panel-fill flex flex-col gap-2 p-3 ${maxed ? 'opacity-75' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-bold text-ink">
          {t(`achv.${def.id}.name` as I18nKey)}
        </span>
        <span className="shrink-0 rounded-sm bg-panel-inset px-1.5 py-0.5 text-[10px] font-extrabold text-gold">
          {t('achv.tier', { tier: claimed, total: def.tiers.length })}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-ink-muted">
        {t(`achv.${def.id}.desc` as I18nKey)}
      </p>
      <ProgressBar
        variant={maxed ? 'xp' : 'vigor'}
        value={Math.min(value, target)}
        max={target}
        className="h-2.5"
        label={
          maxed
            ? t('achv.completed', { done: def.tiers.length, total: def.tiers.length })
            : t('achv.progress', { current: fmt(Math.min(value, target)), target: fmt(target) })
        }
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] font-bold text-ink-faint">
          {def.gems ? (
            <span className="inline-flex items-center gap-1 text-gem">
              <Icon id="gem" size={11} /> {def.gems}
            </span>
          ) : null}
          {def.titleId ? <Icon id="crown" size={11} className="text-gold" /> : null}
        </div>
        <FButton size="sm" disabled={!claimable} onClick={() => claim(def.id)}>
          {claimable ? t('achv.claim') : maxed ? t('quests.claimedChip') : t('achv.locked')}
        </FButton>
      </div>
    </div>
  );
}

export function AchievementsScreen() {
  const save = useGame((s) => s.save);
  const claimAll = useGame((s) => s.achievementClaimAll);
  const [category, setCategory] = useState<AchievementCategory>('progression');
  if (!save) return null;

  const pending = claimableAchievements(save).length;
  const claimedTotal = Object.values(save.progress.achievements).reduce((a, b) => a + b, 0);
  const tierTotal = ACHIEVEMENTS.reduce((sum, a) => sum + a.tiers.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <Panel variant="primary">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-gold-bright">{t('achv.title')}</h1>
            <p className="text-sm text-ink-muted">{t('achv.subtitle')}</p>
            <p className="mt-1 text-sm font-bold text-teal">
              {t('achv.attrSummary', { n: achievementAttrBonus(save) })}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-[11px] font-bold text-ink-faint">
              {t('achv.completed', { done: claimedTotal, total: tierTotal })}
            </span>
            <FButton disabled={pending === 0} onClick={claimAll}>
              <Icon id="achievements" size={16} /> {t('achv.claimAll')}
              {pending > 0 ? ` (${pending})` : ''}
            </FButton>
          </div>
        </div>
      </Panel>

      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => {
          const ready = achievementsOfCategory(cat).filter(
            (d) => tiersEarned(save, d) > tiersClaimed(save, d.id),
          ).length;
          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              aria-pressed={category === cat}
              className={`relative rounded-sm px-3 py-1.5 text-xs font-extrabold transition-colors ${
                category === cat
                  ? 'bg-panel-inset text-gold'
                  : 'text-ink-faint hover:text-ink'
              }`}
            >
              {t(`achv.category.${cat}` as I18nKey)}
              {ready > 0 && (
                <span className="ml-1.5 rounded-full bg-gold px-1 text-[9px] font-extrabold text-canvas">
                  {ready}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {achievementsOfCategory(category).map((def) => (
          <AchievementCard key={def.id} def={def} />
        ))}
      </div>
    </div>
  );
}
