import { t } from '@/i18n';
import { BackgroundArt } from '../components/BackgroundArt';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';

/**
 * The Gilded Tankard — M0 shows the framed shell with skeleton mission offers;
 * live missions, vigor spending and rewards land in M2 (ROADMAP.md).
 */
export function TavernScreen() {
  return (
    <div className="flex flex-col gap-4">
      <Panel variant="primary" className="overflow-hidden p-1.5">
        <div className="relative h-40 overflow-hidden md:h-56">
          <BackgroundArt name="mission_background_10" alt="" className="scale-[1.02]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <h1 className="font-display text-2xl font-bold text-gold-bright [text-shadow:0_2px_6px_rgba(0,0,0,.9)]">
              {t('screen.tavern.title')}
            </h1>
            <p className="text-sm text-ink/90 [text-shadow:0_1px_3px_rgba(0,0,0,.9)]">
              {t('screen.tavern.welcome')}
            </p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className="frame-secondary--muted panel-fill flex h-36 flex-col items-center justify-center gap-2 opacity-60"
          >
            <Icon id="map-pin" size={28} className="text-ink-faint" />
            <div className="h-2 w-24 rounded bg-panel-inset" />
            <div className="h-2 w-16 rounded bg-panel-inset" />
          </div>
        ))}
      </div>

      <Panel variant="secondary">
        <EmptyState
          icon="tavern"
          title={t('screen.tavern.placeholderTitle')}
          body={t('screen.tavern.placeholderBody')}
        />
      </Panel>
    </div>
  );
}
