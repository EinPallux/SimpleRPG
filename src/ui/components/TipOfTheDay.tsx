import { TIPS_POOL, tipKey } from '@/content/flavor';
import { fnv1a } from '@/engine/hash';
import { t } from '@/i18n';
import { useGame } from '@/state/store';
import { Icon } from './Icon';

/**
 * One of the §13 tips, rotating at the daily reset.
 *
 * Keyed off `daily.dayKey` rather than a render counter or a clock read: the
 * tip has to be the same all day (a line that reshuffles whenever the vigor bar
 * ticks is noise, not advice), and it has to differ between days. Hashing the
 * day key gives both, and stays deterministic the way everything else here is.
 */
export function TipOfTheDay() {
  const dayKey = useGame((s) => s.save?.daily.dayKey);
  if (!dayKey) return null;

  return (
    <p className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-ink-faint">
      <Icon id="help" size={13} className="mt-px shrink-0" />
      <span>
        <span className="font-bold">{t('tips.label')}</span> {t(tipKey(fnv1a(dayKey) % TIPS_POOL))}
      </span>
    </p>
  );
}
