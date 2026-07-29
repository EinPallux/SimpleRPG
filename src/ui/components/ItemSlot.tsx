import type { ItemInstance } from '@/engine/types';
import { useGame } from '@/state/store';
import { itemName } from '../itemName';
import { ItemTooltip } from './ItemTooltip';
import { Tooltip } from './Tooltip';

/**
 * Compact inventory cell: rarity frame, ilvl, upgrade badge. Click for actions.
 *
 * Hovering — or focusing, or long-pressing — gives the full card with a live
 * compare against whatever is in that slot. A grid of item levels is not
 * information on its own, and before this the only way to read your own
 * backpack was to open a modal per item.
 */
export function ItemSlot({
  item,
  size = 56,
  onClick,
  selected = false,
  compare = true,
}: {
  item: ItemInstance;
  size?: number;
  onClick?: (() => void) | undefined;
  selected?: boolean;
  /** off on the equipped paper-doll, where a piece would compare with itself */
  compare?: boolean;
}) {
  const save = useGame((s) => s.save);
  const cell = (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={itemName(item)}
      className={`frame-slot--${item.rarity} panel-fill-inset hover-lift relative flex shrink-0 items-center justify-center ${selected ? 'brightness-150' : ''}`}
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

  // No save means the shell is still hydrating; the cell alone is still valid.
  if (!save) return cell;
  return (
    <Tooltip content={<ItemTooltip item={item} save={save} compare={compare} />}>{cell}</Tooltip>
  );
}
