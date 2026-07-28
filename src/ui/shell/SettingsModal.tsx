import { useState } from 'react';
import { t } from '@/i18n';
import { useGame } from '@/state/store';
import { FButton } from '../components/FButton';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';

declare const __APP_VERSION__: string;

export function SettingsModal() {
  const open = useGame((s) => s.settingsOpen);
  const setOpen = useGame((s) => s.setSettingsOpen);
  const exportActive = useGame((s) => s.exportActive);
  const exitToTitle = useGame((s) => s.exitToTitle);
  const toast = useGame((s) => s.toast);
  const heroName = useGame((s) => s.save?.hero.name ?? 'hero');
  const [fallbackCode, setFallbackCode] = useState<string | null>(null);

  if (!open) return null;

  const handleCopy = async () => {
    const code = exportActive();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast(t('toast.exportCopied'));
    } catch {
      setFallbackCode(code);
      toast(t('toast.exportFailed'));
    }
  };

  const handleDownload = () => {
    const code = exportActive();
    if (!code) return;
    const blob = new Blob([code], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${heroName.replaceAll(/[^a-z0-9-_]/gi, '_')}.simplerpg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal title={t('settings.title')} onClose={() => setOpen(false)}>
      <div className="flex flex-col gap-5">
        <section>
          <h3 className="mb-2 text-xs font-extrabold tracking-[0.18em] text-ink-faint uppercase">
            {t('settings.saves')}
          </h3>
          <div className="flex flex-wrap gap-2">
            <FButton onClick={() => void handleCopy()}>
              <Icon id="export" size={16} />
              {t('settings.exportActive')}
            </FButton>
            <FButton variant="quiet" onClick={handleDownload}>
              {t('settings.exportDownload')}
            </FButton>
          </div>
          {fallbackCode && (
            <textarea
              readOnly
              value={fallbackCode}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-2 h-24 w-full rounded-sm border border-ink-faint/40 bg-panel-inset p-2 font-mono text-[10px] text-ink-muted"
            />
          )}
          <div className="mt-3">
            <FButton variant="quiet" onClick={() => void exitToTitle()}>
              {t('settings.backToTitle')}
            </FButton>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-extrabold tracking-[0.18em] text-ink-faint uppercase">
            {t('settings.audio')}
          </h3>
          <p className="text-sm text-ink-muted">{t('settings.audioSoon')}</p>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-extrabold tracking-[0.18em] text-ink-faint uppercase">
            {t('settings.credits')}
          </h3>
          <p className="mb-1 text-sm text-ink-muted">{t('settings.creditsIntro')}</p>
          <ul className="list-inside list-disc text-sm text-ink-muted">
            <li>{t('settings.credits.kenney')}</li>
            <li>{t('settings.credits.gameicons')}</li>
            <li>{t('settings.credits.fonts')}</li>
            <li>{t('settings.credits.backgrounds')}</li>
          </ul>
        </section>

        <footer className="text-xs text-ink-faint">
          {t('settings.version', { version: __APP_VERSION__ })}
        </footer>
      </div>
    </Modal>
  );
}
