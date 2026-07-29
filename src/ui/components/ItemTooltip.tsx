import { classFitness, suitsClass } from '@/engine/inventoryOps';
import { itemArmor, sellPrice, slotOf, weaponDamage } from '@/engine/items';
import type { GameSave, ItemInstance } from '@/engine/types';
import { t, type I18nKey } from '@/i18n';
import { fmt } from '../format';
import { itemName, lineText, uniqueEffectText } from '../itemName';
import { RARITY_TEXT } from '../rarity';
import { Icon } from './Icon';

/** The one number that stands in for "how good is this piece, roughly". */
function headline(item: ItemInstance): { label: string; value: number } | null {
  const slot = slotOf(item);
  if (slot === 'weapon' || (slot === 'offhand' && item.classId === 'assassin')) {
    const d = weaponDamage(item);
    return { label: t('tooltip.damage'), value: Math.round((d.min + d.max) / 2) };
  }
  const armor = itemArmor(item);
  return armor > 0 ? { label: t('tooltip.armor'), value: armor } : null;
}

/** A signed delta, coloured by whether it is good news. */
function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="font-bold text-ink-faint">=</span>;
  return (
    <span className={`font-bold ${value > 0 ? 'text-success' : 'text-[#e08a7a]'}`}>
      {value > 0 ? '+' : '−'}
      {fmt(Math.abs(value))}
    </span>
  );
}

/**
 * Everything about an item, on hover.
 *
 * The comparison is the point. A backpack full of numbers is unreadable
 * without knowing what the piece would REPLACE, so when something is already
 * in the slot this shows the delta rather than making the player hold two sets
 * of stats in their head. Since B1 nothing is class-locked, so it also has to
 * say plainly how much of an off-class piece is going to waste.
 */
export function ItemTooltip({
  item,
  save,
  compare = true,
}: {
  item: ItemInstance;
  save: GameSave;
  compare?: boolean;
}) {
  const slot = slotOf(item);
  const equipped = save.inventory.equipped[slot];
  const versus = compare && equipped && equipped.id !== item.id ? equipped : null;
  const mine = headline(item);
  const theirs = versus ? headline(versus) : null;
  const fx = uniqueEffectText(item);
  const suits = suitsClass(save, item);
  const fitness = Math.round(classFitness(save, item) * 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className={`font-display text-sm font-bold ${RARITY_TEXT[item.rarity]}`}>
        {itemName(item)}
      </div>
      <div className="text-[10px] font-bold tracking-wide text-ink-faint uppercase">
        {t(`item.rarity.${item.rarity}` as I18nKey)} · {t(`slot.${slot}` as I18nKey)} ·{' '}
        {t('item.ilvl', { ilvl: item.ilvl })}
      </div>

      {item.setId && (
        <div className="text-[11px] font-bold text-[#35c99a]">
          {t(`set.${item.setId}` as I18nKey)}
        </div>
      )}

      {mine && (
        <div className="flex items-baseline gap-2 text-xs">
          <span className="text-ink-muted">{mine.label}</span>
          <span className="font-bold text-ink">{fmt(mine.value)}</span>
          {theirs && <Delta value={mine.value - theirs.value} />}
        </div>
      )}

      {item.lines.length > 0 && (
        <ul className="space-y-0.5">
          {item.lines.map((line, i) => (
            <li key={i} className="text-[11px] font-semibold text-[#7fd1c8]">
              {lineText(line)}
            </li>
          ))}
        </ul>
      )}

      {fx && <div className={`text-[11px] font-bold ${RARITY_TEXT.legendary}`}>{fx}</div>}

      {!suits && (
        <div className="rounded-sm bg-panel-inset px-2 py-1 text-[11px] leading-snug text-[#e0b45a]">
          {t('tooltip.offClass', {
            cls: t(`class.${item.classId}.name` as I18nKey),
            pct: fitness,
          })}
        </div>
      )}

      {versus && (
        <div className="mt-0.5 border-t border-ink-faint/25 pt-1.5 text-[10px] text-ink-faint">
          {t('tooltip.comparedTo', { name: itemName(versus) })}
        </div>
      )}

      <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-gold">
        <Icon id="gold" size={11} />
        {t('tooltip.sellsFor', { gold: fmt(sellPrice(item)) })}
      </div>
    </div>
  );
}
