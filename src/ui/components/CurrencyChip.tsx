import { useEffect, useRef, useState } from 'react';
import { t, type I18nKey } from '@/i18n';
import { fmt } from '../format';
import { Icon } from './Icon';
import type { IconId } from '../icons.gen';

export type CurrencyKind = 'gold' | 'gems' | 'scraps' | 'dust';

const CONFIG: Record<CurrencyKind, { icon: IconId; color: string; labelKey: I18nKey }> = {
  gold: { icon: 'gold', color: 'text-gold-bright', labelKey: 'hud.gold' },
  gems: { icon: 'gem', color: 'text-gem', labelKey: 'hud.gems' },
  scraps: { icon: 'scraps', color: 'text-ink-muted', labelKey: 'hud.scraps' },
  dust: { icon: 'dust', color: 'text-[#b48fd9]', labelKey: 'hud.dust' },
};

/**
 * A currency in the HUD.
 *
 * The number FLASHES when it changes. Currencies move constantly — a claim, a
 * purchase, a sale — and a figure that silently swaps digits is the single
 * easiest place for the game to feel like a spreadsheet. Keyed on a counter
 * rather than the value itself, so 100 → 90 → 100 re-fires on the way back
 * instead of being read as "no change".
 */
export function CurrencyChip({ kind, value }: { kind: CurrencyKind; value: number }) {
  const cfg = CONFIG[kind];
  const previous = useRef(value);
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setBeat((b) => b + 1);
  }, [value]);

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm bg-panel-inset/70 px-2 py-1"
      title={t(cfg.labelKey)}
    >
      <Icon id={cfg.icon} size={16} className={cfg.color} label={t(cfg.labelKey)} />
      <span key={beat} className={`count-flash inline-block text-sm font-bold ${cfg.color}`}>
        {fmt(value)}
      </span>
    </span>
  );
}
