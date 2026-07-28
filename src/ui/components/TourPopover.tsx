/**
 * The fifteen-second contextual tour (GAME_DESIGN.md §17, final beat).
 *
 * Deliberately not a modal: no backdrop, no focus trap, no dimming. The screen
 * behind it is fully usable while it sits there, because a first-visit
 * paragraph is an offer of context, not a toll gate — the player who already
 * knows how the Forge works should be able to ignore it entirely and start
 * upgrading.
 *
 * `role="status"` is the accessible shape of the same idea: a screen reader
 * hears it in passing instead of being dragged to it (UI_DESIGN.md §8).
 */
import { tourKey } from '@/content/onboarding';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { FButton } from './FButton';
import { Panel } from './Panel';
import { useModalOpen } from '../hooks/useModalOpen';

export function TourPopover() {
  const modalOpen = useModalOpen();
  const screen = useGame((s) => s.tourScreen);
  const dismiss = useGame((s) => s.dismissTour);
  if (!screen || modalOpen) return null;

  return (
    // Clears the mobile tab bar; the layer itself never eats a click.
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[45] flex justify-center px-3 lg:bottom-6"
    >
      <Panel
        variant="special"
        title={t('tour.title')}
        className="toast-enter pointer-events-auto w-full max-w-md"
      >
        <p className="text-sm leading-relaxed text-ink-muted">{t(tourKey(screen) as I18nKey)}</p>
        <div className="mt-3 flex justify-end">
          <FButton size="sm" onClick={dismiss}>
            {t('tour.dismiss')}
          </FButton>
        </div>
      </Panel>
    </div>
  );
}
