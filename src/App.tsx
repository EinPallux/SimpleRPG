import { useEffect } from 'react';
import { t } from '@/i18n';
import { attachLifecyclePersistence, useGame } from '@/state/store';
import { Toasts } from '@/ui/components/Toasts';
import { UpdateToast } from '@/ui/components/UpdateToast';
import { ErrorBoundary } from '@/ui/ErrorBoundary';
import { TitleScreen } from '@/ui/screens/TitleScreen';
import { Shell } from '@/ui/shell/Shell';

function Boot() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="animate-pulse font-display text-lg tracking-[0.3em] text-gold uppercase">
        {t('app.loading')}
      </p>
    </div>
  );
}

export default function App() {
  const phase = useGame((s) => s.phase);
  const bootstrap = useGame((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
    return attachLifecyclePersistence();
  }, [bootstrap]);

  return (
    <ErrorBoundary>
      {phase === 'boot' && <Boot />}
      {phase === 'title' && <TitleScreen />}
      {phase === 'ingame' && <Shell />}
      <Toasts />
      {/* Mounted OUTSIDE the phase gate on purpose. `useRegisterSW` inside it is
          what registers the service worker, and the plugin suppresses its own
          injected registration as soon as that virtual module is imported — so
          mounting this in the Shell (rendered only for phase 'ingame') meant a
          visitor who opened the title screen and left installed nothing at all:
          no worker, no precache, no offline. */}
      <UpdateToast />
    </ErrorBoundary>
  );
}
