import { baseAttribute } from '@/engine/newSave';
import { totalAttribute } from '@/engine/stats';
import type { AttributeId, GameSave } from '@/engine/types';
import { t, type I18nKey } from '@/i18n';
import { fmt } from '../format';

/**
 * Where an attribute's number actually comes from.
 *
 * `totalAttribute` folds together six sources — the class base, levels, points
 * bought with gold, gear lines, set and pet bonuses, elixirs — and presents one
 * figure. That figure is the most important number on the screen and was
 * completely unexplained: a player buying points could not see what fraction of
 * their Strength they had paid for. The breakdown shows the two halves it can
 * state exactly (base+bought vs everything equipped and drunk) rather than
 * inventing a precision the stat pipeline does not expose.
 */
export function StatTooltip({ save, attr }: { save: GameSave; attr: AttributeId }) {
  const total = totalAttribute(save, attr);
  const bought = save.hero.attrsBought[attr];
  // `baseAttribute` is class start + bought, so the class's own contribution is
  // what is left after taking the purchases back out.
  const base = baseAttribute(save, attr) - bought;
  const fromGear = total - base - bought;

  const rows: [string, number][] = [
    [t('stat.fromBase'), base],
    [t('stat.fromBought'), bought],
    [t('stat.fromGear'), fromGear],
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-display text-sm font-bold text-gold">
        {t(`attr.${attr}.name` as I18nKey)}
      </div>
      <p className="text-[11px] leading-relaxed text-ink-muted">
        {t(`attr.${attr}.blurb` as I18nKey)}
      </p>
      <ul className="mt-0.5 space-y-0.5 border-t border-ink-faint/25 pt-1.5">
        {rows.map(([label, value]) => (
          <li key={label} className="flex items-baseline justify-between gap-4 text-[11px]">
            <span className="text-ink-faint">{label}</span>
            <span className="font-bold text-ink">{fmt(value)}</span>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-4 border-t border-ink-faint/25 pt-1 text-xs">
          <span className="font-bold text-ink-muted">{t('stat.total')}</span>
          <span className="font-display font-bold text-gold">{fmt(total)}</span>
        </li>
      </ul>
    </div>
  );
}
