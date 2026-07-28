import { useEffect } from 'react';
import { t } from '@/i18n';
import { attachLifecyclePersistence, useGame } from '@/state/store';
import { Toasts } from '@/ui/components/Toasts';
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
    </ErrorBoundary>
  );
}
