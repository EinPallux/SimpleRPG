/**
 * Procedural item naming & display strings (CONTENT_CATALOG.md §13 pools).
 * Deterministic per item seed; every part is an i18n key (invariant 8).
 *
 * The eight named legendaries (§6.2) are the exception the whole system exists
 * to make special: they skip the generator entirely and keep their own name,
 * which is the point of having one.
 */
import { fnv1a } from '@/engine/hash';
import { MISSION_GENERIC_POOL, MISSION_ZONE_POOL } from '@/content/flavor';
import { uniqueNameKey, uniqueOrNull } from '@/content/uniques';
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
  // A unique is called what it is called. An upgrade still shows, because a
  // +7 Ladle is a thing a player wants to be told about.
  if (item.uniqueId) {
    const upgraded = item.upgrade > 0 ? ` +${item.upgrade}` : '';
    return `${t(uniqueNameKey(item.uniqueId) as I18nKey)}${upgraded}`;
  }
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

/**
 * "Mission flavor" line for an offer: prefers zone-specific pools, falls back
 * to generic. All ten zones carry a full six-line pool as of M9, so the
 * `hasKey` guard is now belt-and-braces rather than the common path — it stays
 * because a zone added in a later patch should degrade to generic prose rather
 * than render a raw key.
 */
export function missionFlavor(zoneIndex: number, flavor: number): string {
  const zoneKey = `mission.z${zoneIndex}.${flavor % MISSION_ZONE_POOL}`;
  if (flavor % 5 >= 2 && hasKey(zoneKey)) return t(zoneKey);
  return t(`mission.generic.${flavor % MISSION_GENERIC_POOL}` as I18nKey);
}

/**
 * The bespoke effect of a named legendary, in words (null for any other item).
 *
 * Uniques carry their effect OUTSIDE the `lines` array — it is a behaviour, not
 * a stat roll — so without this the card would show a legendary whose whole
 * reason for existing is invisible.
 */
export function uniqueEffectText(item: ItemInstance): string | null {
  const def = uniqueOrNull(item.uniqueId);
  if (!def) return null;
  const fx = def.effect;
  switch (fx.kind) {
    case 'firstStrikeAlwaysCrit':
      return t('unique.fx.firstStrikeAlwaysCrit');
    case 'attrPerLevels':
      return t('unique.fx.attrPerLevels', { per: fx.per });
    case 'evadePP':
      return t('unique.fx.evadePP', { pp: fx.pp });
    case 'wheelGemPP':
      return t('unique.fx.wheelGemPP', { pp: fx.pp });
    default:
      // The remaining four are all "a percentage of something".
      return t(`unique.fx.${fx.kind}` as I18nKey, { pct: Math.round(fx.pct * 100) });
  }
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
