/// <reference types="vite-plugin-pwa/react" />
/**
 * The patch toast (TECHNICAL_ARCHITECTURE.md §12: "update prompt toast … driven
 * by service-worker version bump").
 *
 * The service worker is registered with `registerType: 'prompt'`, so a new build
 * sits in the waiting state until someone says go. That is deliberate: an
 * auto-reload halfway through a dungeon floor is indistinguishable from a crash,
 * and this game is played in ninety-second visits. `updateServiceWorker()` sends
 * the skip-waiting message and reloads once the new worker has control.
 *
 * Silent by construction — until `needRefresh` flips there is nothing to render,
 * so mounting this costs a hook and no pixels.
 */
import { useRegisterSW } from 'virtual:pwa-register/react';
import { t } from '@/i18n';
import { FButton } from './FButton';
import { Panel } from './Panel';

export function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    // role=status, not alert: a patch is news, not an emergency, and the player
    // keeps whatever they were doing until they choose to reload.
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[55] flex justify-center px-3 lg:bottom-6"
    >
      <Panel
        variant="special"
        title={t('pwa.update.title')}
        className="toast-enter pointer-events-auto w-full max-w-md"
      >
        <p className="text-sm leading-relaxed text-ink-muted">{t('pwa.update.body')}</p>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <FButton variant="quiet" size="sm" onClick={() => setNeedRefresh(false)}>
            {t('pwa.update.later')}
          </FButton>
          <FButton size="sm" onClick={() => void updateServiceWorker()}>
            {t('pwa.update.reload')}
          </FButton>
        </div>
      </Panel>
    </div>
  );
}
