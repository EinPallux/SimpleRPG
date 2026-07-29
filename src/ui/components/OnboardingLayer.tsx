/**
 * The scripted first fifteen minutes, on screen (GAME_DESIGN.md §17).
 *
 * This layer only ever POINTS. A step names the screen it belongs to, and when
 * the player is standing somewhere else the mark offers a button instead of
 * teleporting them: auto-navigating would yank the UI out from under a hand
 * already reaching for something, which is exactly the feeling a tutorial is
 * supposed to prevent.
 *
 * Steps with a `metric` goal carry no button at all. They finish when the deed
 * lands in the stat ledger, so the layer watches `stepSatisfied` and
 * acknowledges on the player's behalf — the tutorial should feel like it
 * noticed, not like it wants one more click for its trouble.
 */
import { useEffect } from 'react';
import { useModalOpen } from '../hooks/useModalOpen';
import { onboardingBodyKey, onboardingTitleKey, ONBOARDING_STEPS } from '@/content/onboarding';
import { currentOnboardingStep, onboardingIndex, stepSatisfied } from '@/engine/onboarding';
import { t, type I18nKey } from '@/i18n';
import { useGame, type ScreenId } from '@/state/store';
import { CoachMark } from './CoachMark';

export function OnboardingLayer() {
  const save = useGame((s) => s.save);
  const screen = useGame((s) => s.screen);
  const ack = useGame((s) => s.onboardingAck);
  const skip = useGame((s) => s.onboardingSkip);
  const setScreen = useGame((s) => s.setScreen);

  // A reward reveal or a combat playback is a moment the player asked for;
  // the tutorial waits its turn rather than painting over it.
  const modalOpen = useModalOpen();
  const step = save ? currentOnboardingStep(save) : null;
  const satisfied = save !== null && step !== null && stepSatisfied(save, step);

  // The deed is done — retire the mark instead of waiting to be dismissed.
  //
  // `step.id` is in the deps on purpose. Two of the six beats are consecutive
  // metric goals (first-attribute, then first-arena), so a player who has
  // already bought an attribute AND fought a bout leaves `satisfied` true
  // across the advance. Keyed on the boolean alone the effect would not re-run,
  // and the sequence would wedge on the second one forever.
  useEffect(() => {
    if (satisfied) ack();
  }, [satisfied, ack, step?.id]);

  if (!save || !step || modalOpen) return null;

  const elsewhere = step.screen !== screen;

  // Three shapes of button, in order: fetch the player, ask them to read, or —
  // for a metric goal — nothing at all, because doing the thing is the button.
  const action = elsewhere
    ? { actionLabel: t('story.goTo'), onAction: () => setScreen(step.screen as ScreenId) }
    : step.goal.kind === 'acknowledge'
      ? { actionLabel: t('ob.next'), onAction: ack }
      : {};

  return (
    <CoachMark
      // Off-screen steps drop their anchor: a ring around nothing is worse than
      // an honest centred card.
      anchorId={elsewhere ? null : step.anchor}
      title={t(onboardingTitleKey(step.id) as I18nKey)}
      body={t(onboardingBodyKey(step.id) as I18nKey)}
      {...action}
      skipLabel={t('ob.skip')}
      onSkip={skip}
      // Only the two narrative beats own the screen; a "go here" prompt or a
      // step whose target is elsewhere gets out of the way instead.
      placement={!elsewhere && step.anchor === null ? 'centre' : 'dock'}
      progress={t('ob.step', { n: onboardingIndex(save) + 1, total: ONBOARDING_STEPS.length })}
    />
  );
}
