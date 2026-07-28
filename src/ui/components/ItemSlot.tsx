import type { ItemInstance } from '@/engine/types';
import { itemName } from '../itemName';

/** Compact inventory cell: rarity frame, ilvl, upgrade badge. Click for actions. */
export function ItemSlot({
  item,
  size = 56,
  onClick,
  selected = false,
}: {
  item: ItemInstance;
  size?: number;
  onClick?: (() => void) | undefined;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={itemName(item)}
      aria-label={itemName(item)}
      className={`frame-slot--${item.rarity} panel-fill-inset relative flex shrink-0 items-center justify-center transition-[filter] enabled:hover:brightness-125 ${selected ? 'brightness-150' : ''}`}
      style={{ width: size, height: size, ['--frame-w' as string]: '8px' }}
    >
      <span className="font-display text-sm font-bold text-ink">{item.ilvl}</span>
      {item.upgrade > 0 && (
        <span className="absolute -top-1 -right-1 rounded-sm bg-gold px-0.5 text-[9px] font-extrabold text-canvas">
          +{item.upgrade}
        </span>
      )}
    </button>
  );
}
