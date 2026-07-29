import { useEffect, useRef, useState } from 'react';
import { t, type I18nKey } from '@/i18n';
import { fmt } from '../format';
import { Hint } from './Hint';
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
 *
 * It also EXPLAINS itself. Four currencies is three more than most players will
 * hold in their head, and the chip is the only place any of them is ever named
 * — so the hover says what the thing buys and where it comes from, and prints
 * the exact balance, which the chip itself cannot once `fmt` starts abbreviating
 * past 100k.
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
    <Hint
      title={t(cfg.labelKey)}
      body={t(`hud.tip.${kind}.body` as I18nKey)}
      rows={[[t('hud.tip.balance'), value.toLocaleString('en-US')]]}
      footer={t(`hud.tip.${kind}.from` as I18nKey)}
      placement="bottom"
    >
      {/* A tooltip trigger has to be focusable or it is mouse-only information
          (WAI-ARIA APG). The chip is not a control, so it takes the tab stop
          rather than pretending to be a button that does nothing — and the
          group carries the currency's name, so a reader announces "Gold, 1,234"
          instead of leaving the number floating next to a labelled glyph. */}
      <span
        role="group"
        aria-label={t(cfg.labelKey)}
        tabIndex={0}
        className="inline-flex items-center gap-1.5 rounded-sm bg-panel-inset/70 px-2 py-1"
      >
        <Icon id={cfg.icon} size={16} className={cfg.color} />
        <span key={beat} className={`count-flash inline-block text-sm font-bold ${cfg.color}`}>
          {fmt(value)}
        </span>
      </span>
    </Hint>
  );
}
