/**
 * The install nudge (UI_DESIGN.md §8: "after day-2 login — never on first
 * session").
 *
 * The gate is the whole point. A browser fires `beforeinstallprompt` the moment
 * it decides the site qualifies, which for a first-time visitor is roughly
 * thirty seconds in — exactly when they are still deciding whether they like
 * this at all. So the event is caught, the default banner suppressed, and the
 * card held back until the save says the player has come back on their own.
 *
 * It asks once per device, ever — but the flag is written when the ask is
 * ANSWERED, not when the card mounts. Writing it on mount looked equivalent and
 * was not: `beforeinstallprompt` arrives at a moment the app does not control,
 * so if it landed while a reward reveal or the Settings sheet was open, the card
 * painted under the scrim, was never seen, and by its own once-ever rule was
 * never offered again. The card now waits for a clear screen, and only a real
 * answer spends the one ask. Nagging is what shops do; so is asking invisibly.
 */
import { useEffect, useState } from 'react';
import { INSTALL_PROMPT_MIN_DAYS } from '@/engine/constants';
import { t } from '@/i18n';
import { useGame } from '@/state/store';
import { useModalOpen } from '../hooks/useModalOpen';
import {
  clearInstallOffer,
  currentInstallOffer,
  onInstallOffer,
  type BeforeInstallPromptEvent,
} from '../installOffer';
import { FButton } from './FButton';
import { Panel } from './Panel';

export function InstallPrompt() {
  const save = useGame((s) => s.save);
  const seen = useGame((s) => s.prefs.installPromptSeen);
  const setPrefs = useGame((s) => s.setPrefs);
  const modalOpen = useModalOpen();
  // The event is caught before React renders (installOffer.ts); it may already
  // be here, or may still be coming.
  const [offer, setOffer] = useState<BeforeInstallPromptEvent | null>(currentInstallOffer);
  const [open, setOpen] = useState(false);

  useEffect(() => onInstallOffer(setOffer), []);

  const daysPlayed = save?.stats.daysPlayed ?? 0;

  useEffect(() => {
    if (!offer || open || seen) return;
    if (daysPlayed < INSTALL_PROMPT_MIN_DAYS) return;
    // Hold the ask until nothing is covering the screen — an unseen ask still
    // spends the only one we get.
    if (modalOpen) return;
    setOpen(true);
  }, [offer, open, seen, daysPlayed, modalOpen]);

  if (!open || !offer) return null;

  /** Spend the one ask — whichever way it was answered. */
  const answered = () => {
    setOpen(false);
    setPrefs({ installPromptSeen: true });
    clearInstallOffer();
  };

  const accept = () => {
    answered();
    // Nothing reads `userChoice`: whether they installed is between them and
    // their launcher, and there is nowhere for that answer to go (invariant 1).
    void offer.prompt();
    setOffer(null);
  };

  return (
    // Announced, never forced: the card sits over the game without taking focus
    // or blocking a single click behind it (UI_DESIGN.md §8).
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[46] flex justify-center px-3 lg:bottom-6"
    >
      <Panel
        variant="secondary"
        title={t('pwa.install.title')}
        className="toast-enter pointer-events-auto w-full max-w-md"
      >
        <p className="text-sm leading-relaxed text-ink-muted">{t('pwa.install.body')}</p>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <FButton variant="quiet" size="sm" onClick={answered}>
            {t('pwa.install.dismiss')}
          </FButton>
          <FButton size="sm" onClick={accept}>
            {t('pwa.install.accept')}
          </FButton>
        </div>
      </Panel>
    </div>
  );
}
