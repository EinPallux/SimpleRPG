import { useId, useState, type ReactNode } from 'react';
import { t } from '@/i18n';
import type { Prefs, TimerFormat } from '@/persist/prefs';
import { useGame } from '@/state/store';
import { playSfx } from '../audio';
import { FButton } from '../components/FButton';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';

declare const __APP_VERSION__: string;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-extrabold tracking-[0.18em] text-ink-faint uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function VolumeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  /** 0..1, as stored */
  value: number;
  onChange: (next: number) => void;
}) {
  const id = useId();
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="w-32 shrink-0 text-sm text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={pct}
        aria-valuetext={t('settings.percent', { pct })}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        // You cannot hear a volume change in silence. One blip when the drag
        // (or the arrow key) settles — firing per change event would machine-gun.
        onPointerUp={() => playSfx('ui_click')}
        onKeyUp={() => playSfx('ui_click')}
        className="h-2 min-w-0 flex-1 accent-gold"
      />
      <span className="w-10 shrink-0 text-right text-sm text-ink">
        {t('settings.percent', { pct })}
      </span>
    </div>
  );
}

function Toggle({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const helpId = useId();
  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={checked}
          aria-describedby={help ? helpId : undefined}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 accent-gold"
        />
        {label}
      </label>
      {help && (
        <p id={helpId} className="mt-1 ml-6 text-xs text-ink-faint">
          {help}
        </p>
      )}
    </div>
  );
}

/**
 * Exclusive choice as real radios rather than a row of styled buttons: arrow
 * keys, the focus ring and the group announcement all come for free, and the
 * frame system stays reserved for chrome (invariant 10).
 */
function Choice<T extends string>({
  legend,
  help,
  options,
  value,
  onChange,
}: {
  legend: string;
  help?: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  const name = useId();
  const helpId = useId();
  return (
    <fieldset aria-describedby={help ? helpId : undefined}>
      <legend className="mb-1.5 text-sm text-ink-muted">{legend}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {options.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
              className="size-4 accent-gold"
            />
            {option.label}
          </label>
        ))}
      </div>
      {help && (
        <p id={helpId} className="mt-1 text-xs text-ink-faint">
          {help}
        </p>
      )}
    </fieldset>
  );
}

/**
 * The pref stores *reduced* motion, the control speaks *motion* — "reduced
 * motion: off" is a double negative nobody parses at a glance. `null` is the
 * honest default: whatever the OS was already asked for.
 */
type MotionChoice = 'system' | 'on' | 'off';

const MOTION_TO_PREF: Record<MotionChoice, Prefs['reducedMotion']> = {
  system: null,
  on: false,
  off: true,
};

function motionChoice(reducedMotion: Prefs['reducedMotion']): MotionChoice {
  if (reducedMotion === null) return 'system';
  return reducedMotion ? 'off' : 'on';
}

export function SettingsModal() {
  const open = useGame((s) => s.settingsOpen);
  const setOpen = useGame((s) => s.setSettingsOpen);
  const exportActive = useGame((s) => s.exportActive);
  const exitToTitle = useGame((s) => s.exitToTitle);
  const toast = useGame((s) => s.toast);
  const prefs = useGame((s) => s.prefs);
  const setPrefs = useGame((s) => s.setPrefs);
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
        <Section title={t('settings.audio')}>
          <div className="flex flex-col gap-3">
            <VolumeSlider
              label={t('settings.volMaster')}
              value={prefs.volMaster}
              onChange={(volMaster) => setPrefs({ volMaster })}
            />
            <VolumeSlider
              label={t('settings.volSfx')}
              value={prefs.volSfx}
              onChange={(volSfx) => setPrefs({ volSfx })}
            />
            <Toggle
              label={t('settings.mute')}
              checked={prefs.muted}
              onChange={(muted) => setPrefs({ muted })}
            />
            <p className="text-xs text-ink-faint">{t('settings.noMusic')}</p>
          </div>
        </Section>

        <Section title={t('settings.motion')}>
          <Choice
            legend={t('settings.motionLegend')}
            help={t('settings.motionHelp')}
            value={motionChoice(prefs.reducedMotion)}
            onChange={(choice) => setPrefs({ reducedMotion: MOTION_TO_PREF[choice] })}
            options={[
              { id: 'system', label: t('settings.motion.system') },
              { id: 'on', label: t('settings.motion.on') },
              { id: 'off', label: t('settings.motion.off') },
            ]}
          />
        </Section>

        <Section title={t('settings.gameplay')}>
          <div className="flex flex-col gap-3">
            <Toggle
              label={t('settings.instantCombat')}
              help={t('settings.instantCombatHelp')}
              checked={prefs.instantCombat}
              onChange={(instantCombat) => setPrefs({ instantCombat })}
            />
            <Choice<TimerFormat>
              legend={t('settings.timers')}
              help={t('settings.timersHelp')}
              value={prefs.timerFormat}
              onChange={(timerFormat) => setPrefs({ timerFormat })}
              options={[
                { id: 'relative', label: t('settings.timers.relative') },
                { id: 'absolute', label: t('settings.timers.absolute') },
              ]}
            />
          </div>
        </Section>

        <Section title={t('settings.saves')}>
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
        </Section>

        <Section title={t('settings.credits')}>
          <p className="mb-1 text-sm text-ink-muted">{t('settings.creditsIntro')}</p>
          <ul className="list-inside list-disc text-sm text-ink-muted">
            <li>{t('settings.credits.kenney')}</li>
            <li>{t('settings.credits.gameicons')}</li>
            <li>{t('settings.credits.fonts')}</li>
            <li>{t('settings.credits.backgrounds')}</li>
          </ul>
        </Section>

        <footer className="text-xs text-ink-faint">
          {t('settings.version', { version: __APP_VERSION__ })}
        </footer>
      </div>
    </Modal>
  );
}
