import { itemArmor, slotOf, weaponDamage } from '@/engine/items';
import type { ItemInstance } from '@/engine/types';
import { t, type I18nKey } from '@/i18n';
import { itemName, lineText } from '../itemName';
import { RARITY_TEXT } from '../rarity';

/** Compact item card: rarity frame, name, base stat, bonus lines, colorblind pips. */
export function ItemCard({ item, className = '' }: { item: ItemInstance; className?: string }) {
  const slot = slotOf(item);
  const isWeapon = slot === 'weapon' || (slot === 'offhand' && item.classId === 'assassin');
  const dmg = isWeapon ? weaponDamage(item) : null;
  const armor = itemArmor(item);
  const pipCount = { common: 0, uncommon: 1, rare: 2, epic: 3, set: 4, legendary: 5 }[item.rarity];

  return (
    <div
      className={`frame-slot--${item.rarity} panel-fill relative w-52 p-3 text-left ${className}`}
      style={{ ['--frame-w' as string]: '10px' }}
    >
      <div className={`font-display text-sm font-bold ${RARITY_TEXT[item.rarity]}`}>
        {itemName(item)}
      </div>
      <div className="mt-0.5 text-[10px] text-ink-faint">
        {t(`item.rarity.${item.rarity}` as I18nKey)} · {t('item.ilvl', { ilvl: item.ilvl })}
      </div>
      {item.setId && (
        <div className="text-[10px] font-bold text-[#35c99a]">
          {t(`set.${item.setId}` as I18nKey)}
        </div>
      )}
      {dmg && (
        <div className="mt-1.5 text-xs font-bold text-ink">
          {t('item.stat.damage', { min: dmg.min, max: dmg.max })}
        </div>
      )}
      {armor > 0 && (
        <div className="mt-1.5 text-xs font-bold text-ink">
          {t('item.stat.armor', { value: armor })}
        </div>
      )}
      {item.lines.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {item.lines.map((line, i) => (
            <li key={i} className="text-[11px] font-semibold text-[#7fd1c8]">
              {lineText(line)}
            </li>
          ))}
        </ul>
      )}
      {pipCount > 0 && (
        <div className="absolute top-1.5 right-2 flex gap-0.5" aria-hidden="true">
          {Array.from({ length: pipCount }, (_, i) => (
            <span key={i} className={`h-1.5 w-1.5 rounded-full ${RARITY_TEXT[item.rarity]}`}>
              <span className="block h-full w-full rounded-full bg-current" />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
