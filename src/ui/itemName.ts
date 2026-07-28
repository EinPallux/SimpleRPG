/**
 * Procedural item naming & display strings (CONTENT_CATALOG.md §13 pools).
 * Deterministic per item seed; every part is an i18n key (invariant 8).
 * Named set/legendary catalog pieces (M5/M7) will override via their defIds.
 */
import { fnv1a } from '@/engine/hash';
import { slotOf } from '@/engine/items';
import type { ItemInstance } from '@/engine/types';
import { hasKey, t, type I18nKey } from '@/i18n';

const QUALITY_COUNT = 3;

function pick(prefix: string, count: number, hash: number): string {
  for (let i = 0; i < count; i++) {
    const key = `${prefix}.${(hash + i) % count}`;
    if (hasKey(key)) return t(key);
  }
  return t(`${prefix}.0` as I18nKey); // valid pools always define index 0
}

export function itemName(item: ItemInstance): string {
  const slot = slotOf(item);
  const h = fnv1a(`name|${item.seed}`);
  const quality = pick(`item.q.${item.rarity}`, QUALITY_COUNT, h);

  let basePrefix: string;
  if (slot === 'weapon' || slot === 'offhand') {
    const cls = item.classId ?? 'any';
    basePrefix = `item.base.${slot}.${cls}`;
  } else {
    basePrefix = `item.base.${slot}`;
  }
  // Pool sizes vary (2–3); probe from the hash until a key exists.
  const base = pick(basePrefix, QUALITY_COUNT, h >>> 8);

  const upgrade = item.upgrade > 0 ? ` +${item.upgrade}` : '';
  return `${quality} ${base}${upgrade}`;
}

/** "Mission flavor" line for an offer: prefers zone-specific pools, falls back to generic. */
export function missionFlavor(zoneIndex: number, flavor: number): string {
  const zoneKey = `mission.z${zoneIndex}.${flavor % 6}`;
  if (flavor % 5 >= 2 && hasKey(zoneKey)) return t(zoneKey);
  return t(`mission.generic.${flavor % 12}` as I18nKey);
}

export function lineText(line: ItemInstance['lines'][number]): string {
  switch (line.attr) {
    case 'all':
      return t('item.line.all', { value: line.value });
    case 'critDmg':
      return t('item.line.critDmg', { value: line.value });
    case 'goldFind':
      return t('item.line.goldFind', { value: line.value });
    case 'xp':
      return t('item.line.xp', { value: line.value });
    default:
      return t('item.line.attr', {
        value: line.value,
        attr: t(`attr.${line.attr}.name` as I18nKey),
      });
  }
}
