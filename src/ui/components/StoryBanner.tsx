import { CHAPTERS } from '@/content/story';
import {
  activeChapter,
  chapterProgress,
  chapterUnlocked,
  currentStep,
  stepComplete,
  stepGoalProgress,
} from '@/engine/story';
import { t, type I18nKey } from '@/i18n';
import { useGame, type ScreenId } from '@/state/store';
import { fmt } from '../format';
import { FButton } from './FButton';
import { Icon } from './Icon';
import { Panel } from './Panel';

/**
 * The ballad's current beat (GAME_DESIGN §12.1 / UI_DESIGN §6-17): what you're
 * doing, why, and a guided arrow to the screen that does it.
 */
export function StoryBanner() {
  const save = useGame((s) => s.save);
  const claim = useGame((s) => s.storyClaim);
  const setScreen = useGame((s) => s.setScreen);
  if (!save) return null;

  const chapter = activeChapter(save);
  if (chapter === null) return null;
  const def = CHAPTERS.find((c) => c.chapter === chapter);
  if (!def) return null;

  const step = currentStep(save, chapter);
  const done = chapterProgress(save, chapter);

  // Every unlocked chapter finished — the v1.0 ballad rests.
  if (!step) {
    return (
      <Panel variant="special">
        <div className="flex items-center gap-3">
          <Icon id="quests" size={20} className="shrink-0 text-gold" />
          <div>
            <div className="font-display text-sm font-bold text-gold-bright">
              {t('story.title')}
            </div>
            <p className="text-xs text-ink-muted">{t('story.allDone')}</p>
          </div>
        </div>
      </Panel>
    );
  }

  const locked = !chapterUnlocked(save, chapter) || save.hero.level < step.minLevel;
  const ready = stepComplete(save, step);
  const progress = Math.min(stepGoalProgress(save, step), step.goal.target);

  return (
    <Panel variant="special">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-extrabold tracking-[0.14em] text-ink-faint uppercase">
            {t('story.title')} · {t('story.chapterLabel', { n: chapter })} ·{' '}
            {t('story.stepLabel', { step: done + 1 })}
          </div>
          <div className="mt-0.5 font-display text-lg font-bold text-gold-bright">
            {t(`${step.keyBase}.title` as I18nKey)}
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">
            {t(`${step.keyBase}.body` as I18nKey)}
          </p>
          {locked ? (
            <p className="mt-1 text-[11px] font-bold text-ink-faint">
              {t('story.locked', { n: chapter, level: step.minLevel })}
            </p>
          ) : (
            !ready && (
              <p className="mt-1 text-[11px] font-bold text-ink-faint">
                {t('story.waiting', {
                  current: fmt(progress),
                  target: fmt(step.goal.target),
                })}
              </p>
            )
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {ready ? (
            <FButton onClick={() => claim(chapter)}>{t('story.claim')}</FButton>
          ) : (
            <FButton
              variant="quiet"
              size="sm"
              disabled={locked}
              onClick={() => setScreen(step.screen as ScreenId)}
            >
              {t('story.goTo')} <Icon id="chevron-right" size={14} />
            </FButton>
          )}
        </div>
      </div>
    </Panel>
  );
}
