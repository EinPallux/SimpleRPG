import { useEffect } from 'react';
import type { Cadence, MetaReward, QuestDef } from '@/content/meta';
import { getQuest } from '@/content/quests';
import { ACTIVITY_MAX, QUESTS_UNLOCK_LEVEL } from '@/engine/constants';
import {
  activityTotal,
  canClaimActivityChest,
  canClaimQuest,
  canSwapDaily,
  questBlock,
  questComplete,
  questProgress,
} from '@/engine/quests';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { EmptyState } from '../components/EmptyState';
import { FButton } from '../components/FButton';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';
import { ProgressBar } from '../components/ProgressBar';
import { StoryBanner } from '../components/StoryBanner';
import { fmt } from '../format';

/** A reward package as a short, scannable line of chips. */
function RewardChips({ reward }: { reward: MetaReward }) {
  const chips: string[] = [];
  if (reward.gems) chips.push(t('quests.reward.gems', { n: reward.gems }));
  if (reward.scraps) chips.push(t('quests.reward.scraps', { n: reward.scraps }));
  if (reward.dust) chips.push(t('quests.reward.dust', { n: reward.dust }));
  if (reward.treats) chips.push(t('quests.reward.treats', { n: reward.treats }));
  if (reward.item) chips.push(t('quests.reward.item'));
  if (reward.setPiece) chips.push(t('quests.reward.setPiece'));
  if (reward.frameId) chips.push(t('quests.reward.frame'));
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-ink-muted">
      {reward.gold ? (
        <span className="inline-flex items-center gap-1 text-gold">
          <Icon id="gold" size={12} /> ×{reward.gold}
        </span>
      ) : null}
      {reward.xp ? <span className="text-xp">XP ×{reward.xp}</span> : null}
      {chips.map((chip) => (
        <span key={chip}>{chip}</span>
      ))}
    </div>
  );
}

function QuestRow({ quest }: { quest: QuestDef }) {
  const save = useGame((s) => s.save)!;
  const claim = useGame((s) => s.questClaim);
  const swap = useGame((s) => s.questSwap);
  const current = questProgress(save, quest);
  const done = questComplete(save, quest);
  const claimed = questBlock(save, quest.cadence).questsClaimed.includes(quest.id);
  const claimable = canClaimQuest(save, quest);
  const swappable = canSwapDaily(save, quest.id);

  return (
    <div
      className={`frame-secondary panel-fill flex flex-col gap-2 p-3 ${claimed ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-bold text-ink">{t(quest.nameKey as I18nKey)}</span>
        {claimed ? (
          <span className="shrink-0 rounded-sm bg-panel-inset px-1.5 py-0.5 text-[10px] font-extrabold text-success">
            {t('quests.claimedChip')}
          </span>
        ) : (
          quest.activity !== undefined && (
            <span className="shrink-0 rounded-sm bg-panel-inset px-1.5 py-0.5 text-[10px] font-extrabold text-honor">
              +{quest.activity}
            </span>
          )
        )}
      </div>
      <ProgressBar
        variant={done ? 'xp' : 'vigor'}
        value={current}
        max={quest.target}
        className="h-3"
        label={t('quests.progress', { current: fmt(current), target: fmt(quest.target) })}
      />
      <RewardChips reward={quest.reward} />
      <div className="mt-auto flex items-center gap-2">
        <FButton
          size="sm"
          className="flex-1"
          disabled={!claimable}
          onClick={() => claim(quest.id)}
        >
          {claimed ? t('quests.claimedChip') : t('quests.claim')}
        </FButton>
        {quest.cadence === 'daily' && !claimed && (
          <FButton
            size="sm"
            variant="quiet"
            disabled={!swappable}
            title={swappable ? undefined : t('quests.swapSpent')}
            onClick={() => swap(quest.id)}
          >
            {t('quests.swap')}
          </FButton>
        )}
      </div>
    </div>
  );
}

function Board({ cadence, titleKey }: { cadence: Cadence; titleKey: I18nKey }) {
  const save = useGame((s) => s.save)!;
  const ids = questBlock(save, cadence).questIds;
  return (
    <Panel variant="secondary" title={t(titleKey)}>
      {ids.length === 0 ? (
        <p className="py-2 text-sm text-ink-faint">{t('quests.empty')}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {ids.map((id) => (
            <QuestRow key={id} quest={getQuest(id)} />
          ))}
        </div>
      )}
    </Panel>
  );
}

export function QuestBoardScreen() {
  const save = useGame((s) => s.save);
  const ensure = useGame((s) => s.questsEnsureBoards);
  const claimChest = useGame((s) => s.activityChestClaim);

  useEffect(() => {
    ensure();
  }, [ensure]);

  if (!save) return null;
  if (save.hero.level < QUESTS_UNLOCK_LEVEL) {
    return (
      <Panel variant="secondary">
        <EmptyState
          icon="quests"
          title={t('quests.title')}
          body={t('quests.lockedHint', { level: QUESTS_UNLOCK_LEVEL })}
        />
      </Panel>
    );
  }

  const activity = activityTotal(save);
  const chestReady = canClaimActivityChest(save);

  return (
    <div className="flex flex-col gap-4">
      <Panel variant="primary">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-gold-bright">
              {t('quests.title')}
            </h1>
            <p className="text-sm text-ink-muted">{t('quests.subtitle')}</p>
          </div>
          <div className="min-w-56 flex-1 sm:max-w-xs">
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold tracking-wider text-ink-faint uppercase">
              <span>{t('quests.activity')}</span>
              <span>
                {activity}/{ACTIVITY_MAX}
              </span>
            </div>
            <ProgressBar variant="vigor" value={activity} max={ACTIVITY_MAX} className="h-3" />
            <div className="mt-2">
              {save.daily.activityChestClaimed ? (
                <p className="text-[11px] font-semibold text-success">
                  {t('quests.chestClaimed')}
                </p>
              ) : (
                <FButton size="sm" disabled={!chestReady} onClick={claimChest}>
                  <Icon id="gold" size={14} /> {t('quests.chest')}
                </FButton>
              )}
            </div>
            {!chestReady && !save.daily.activityChestClaimed && (
              <p className="mt-1 text-[11px] text-ink-faint">{t('quests.activityHint')}</p>
            )}
          </div>
        </div>
      </Panel>

      <StoryBanner />

      <Board cadence="daily" titleKey="quests.daily" />
      <Board cadence="weekly" titleKey="quests.weekly" />
      <Board cadence="monthly" titleKey="quests.monthly" />
    </div>
  );
}
