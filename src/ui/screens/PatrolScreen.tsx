import { patrolTickKey } from '@/content/flavor';
import { PATROL_CAP_HOURS, PATROL_TICK_MIN } from '@/engine/constants';
import { canStartPatrol, previewPatrol } from '@/engine/patrol';
import { t } from '@/i18n';
import { useGame } from '@/state/store';
import { FButton } from '../components/FButton';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';
import { fmt, formatCountdown, relativeTime } from '../format';
import { useGameClock } from '../hooks/useGameClock';

const MAX_TICKS = (PATROL_CAP_HOURS * 60) / PATROL_TICK_MIN;

function TickLog({ totalTicks }: { totalTicks: number }) {
  const lines = [0, 1, 2]
    .map((i) => totalTicks - i)
    .filter((n) => n > 0)
    .map((n) => t(patrolTickKey(n)));
  if (lines.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1.5">
      {lines.map((line, i) => (
        <li key={i} className={`text-xs italic ${i === 0 ? 'text-ink-muted' : 'text-ink-faint'}`}>
          ▸ {line}
        </li>
      ))}
    </ul>
  );
}

export function PatrolScreen() {
  const save = useGame((s) => s.save);
  const start = useGame((s) => s.patrolStart);
  const collect = useGame((s) => s.patrolCollect);
  const stop = useGame((s) => s.patrolStop);
  const now = useGameClock();
  if (!save) return null;

  const patrol = save.activities.patrol;
  const preview = previewPatrol(save, now);
  const startable = canStartPatrol(save);

  return (
    <div className="flex flex-col gap-4">
      <Panel variant="primary" className="overflow-hidden p-1.5">
        <div className="relative h-48 overflow-hidden md:h-64">
          <picture>
            <source
              type="image/avif"
              srcSet="/assets/bg/patrol_background-1280.avif 1280w, /assets/bg/patrol_background-1920.avif 1920w"
            />
            <img
              src="/assets/bg/patrol_background-1280.webp"
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <h1 className="font-display text-2xl font-bold text-gold-bright [text-shadow:0_2px_6px_#000]">
              {t('patrol.title')}
            </h1>
            <p className="text-sm text-ink/90 [text-shadow:0_1px_3px_#000]">
              {t('patrol.subtitle')}
            </p>
          </div>
        </div>
      </Panel>

      {!patrol ? (
        <Panel variant="secondary">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Icon id="patrol" size={36} className={startable ? 'text-gold' : 'text-ink-faint'} />
            {startable ? (
              <FButton size="lg" onClick={start}>
                {t('patrol.start')}
              </FButton>
            ) : (
              <p className="max-w-sm text-sm leading-relaxed text-ink-muted">
                {t('patrol.locked')}
              </p>
            )}
            <p className="text-[11px] text-ink-faint">{t('patrol.midnightNote')}</p>
          </div>
        </Panel>
      ) : (
        <Panel
          variant="secondary"
          title={t('patrol.onDuty', { time: relativeTime(patrol.startedAt, now) })}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-sm bg-panel-inset px-3 py-2 text-center">
              <div className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
                {t('patrol.uncollected', { ticks: preview.ticks, cap: MAX_TICKS })}
              </div>
              <div className="font-display text-xl font-bold text-gold">{fmt(preview.gold)} 🪙</div>
            </div>
            <div className="rounded-sm bg-panel-inset px-3 py-2 text-center">
              <div className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
                {t('patrol.nextTick', { time: formatCountdown(preview.nextTickInSec) })}
              </div>
              <div className="font-display text-xl font-bold text-ink-muted">
                +{PATROL_TICK_MIN} min
              </div>
            </div>
            <div className="flex flex-col justify-center gap-2">
              <FButton disabled={preview.ticks === 0} onClick={collect}>
                {preview.ticks > 0
                  ? t('patrol.collect', { gold: fmt(preview.gold) })
                  : t('patrol.nothingYet')}
              </FButton>
              <FButton variant="quiet" size="sm" onClick={stop}>
                {t('patrol.stop')}
              </FButton>
            </div>
          </div>
          {preview.capped && (
            <p className="mt-2 text-xs font-bold text-[#e08a7a]">{t('patrol.capWarning')}</p>
          )}
          <TickLog totalTicks={save.stats.patrolTicks ?? 0} />
          <p className="mt-3 text-[11px] text-ink-faint">{t('patrol.midnightNote')}</p>
        </Panel>
      )}
    </div>
  );
}
