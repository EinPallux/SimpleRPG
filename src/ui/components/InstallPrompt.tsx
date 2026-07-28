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
 * It asks once per device, ever: `prefs.installPromptSeen` is written the frame
 * the card appears, not when it is answered, so a "not now" and a closed tab are
 * treated the same way. Nagging is what shops do.
 */
import { useEffect, useState } from 'react';
import { t } from '@/i18n';
import { useGame } from '@/state/store';
import { FButton } from './FButton';
import { Panel } from './Panel';

/**
 * Daily resets crossed since the hero was rolled (`stats.daysPlayed`). Two of
 * them means the player has slept on it and come back anyway — the earliest
 * moment "keep this around" is a favour rather than a sales pitch.
 */
const INSTALL_PROMPT_MIN_DAYS = 2;

/** Not in lib.dom: Chromium's own extension to the install flow. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

export function InstallPrompt() {
  const save = useGame((s) => s.save);
  const seen = useGame((s) => s.prefs.installPromptSeen);
  const setPrefs = useGame((s) => s.setPrefs);
  const [offer, setOffer] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stash = (e: Event) => {
      // Suppressing the browser's own mini-infobar is what buys us the right to
      // choose the moment; the event stays valid until it is used or the page
      // goes away.
      e.preventDefault();
      setOffer(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', stash);
    return () => window.removeEventListener('beforeinstallprompt', stash);
  }, []);

  const daysPlayed = save?.stats.daysPlayed ?? 0;

  useEffect(() => {
    if (!offer || open || seen) return;
    if (daysPlayed < INSTALL_PROMPT_MIN_DAYS) return;
    // Latched into `open` first: marking it seen immediately would otherwise
    // close the card in the same render it opened.
    setOpen(true);
    setPrefs({ installPromptSeen: true });
  }, [offer, open, seen, daysPlayed, setPrefs]);

  if (!open || !offer) return null;

  const accept = () => {
    setOpen(false);
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
          <FButton variant="quiet" size="sm" onClick={() => setOpen(false)}>
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
