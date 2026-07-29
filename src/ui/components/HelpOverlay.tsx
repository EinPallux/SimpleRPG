/**
 * The permanent "?" page (GAME_DESIGN.md §17: every screen keeps a help overlay
 * forever — static, hand-written, no video).
 *
 * It is a plain `Modal` on purpose. The onboarding coach marks are spotlights
 * that never block the game (UI_DESIGN §5.3); help is the opposite gesture —
 * the player stopped playing to read, so it takes the screen, closes on Esc or
 * anywhere outside, and gives the whole page back.
 *
 * Content comes from `content/help.ts`, which guarantees an entry per screen,
 * so this component never needs a "no help for this screen" branch.
 */
import { useState } from 'react';
import { getHelp } from '@/content/help';
import { t, type I18nKey } from '@/i18n';
import type { ScreenId } from '@/state/store';
import { findNavEntry } from '../nav';
import { FButton } from './FButton';
import { Icon } from './Icon';
import { Modal } from './Modal';

export function HelpOverlay({ screen, onClose }: { screen: ScreenId; onClose: () => void }) {
  const entry = getHelp(screen);
  const nav = findNavEntry(screen);

  return (
    <Modal title={t('help.title', { screen: nav ? t(nav.labelKey) : '' })} onClose={onClose}>
      <p className="text-sm leading-relaxed text-ink-muted">{t(entry.introKey as I18nKey)}</p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-muted marker:text-gold">
        {entry.bulletKeys.map((key) => (
          <li key={key}>{t(key as I18nKey)}</li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end">
        <FButton variant="quiet" onClick={onClose}>
          {t('help.close')}
        </FButton>
      </div>
    </Modal>
  );
}

/**
 * The "?" affordance itself. It owns the open state so any header can drop it
 * in next to the screen it describes without wiring anything through the store
 * — help is a device-local reading gesture, not game state worth persisting.
 */
export function HelpButton({ screen, className = '' }: { screen: ScreenId; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={t('help.open')}
        title={t('help.open')}
        onClick={() => setOpen(true)}
        // UI_DESIGN §8: hit areas >= 44px. The glyph stays 20px; the button
        // grows around it, so the target is finger-sized without the icon
        // looking oversized next to the HUD bars.
        className={`-m-3 grid h-11 w-11 place-items-center text-ink-muted transition-colors hover:text-ink ${className}`}
      >
        <Icon id="help" size={20} />
      </button>
      {open && <HelpOverlay screen={screen} onClose={() => setOpen(false)} />}
    </>
  );
}
