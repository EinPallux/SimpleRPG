import { useState } from 'react';
import { getClass } from '@/content/classes';
import { getElixir } from '@/content/elixirs';
import { getTitle } from '@/content/titles';
import { CRIT_PER_LUCK, DR_CAP, DR_DIVISOR, POTION_SLOTS } from '@/engine/constants';
import { attrCost } from '@/engine/economy';
import { heroToCombatant } from '@/engine/combatants';
import { slotOf } from '@/engine/items';
import { ATTRIBUTE_IDS, type AttributeId, type EquipSlot, type GameSave } from '@/engine/types';
import { heroMaxHp, totalAttribute } from '@/engine/stats';
import { xpToNext } from '@/engine/xp';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { EmblemAvatar } from '../components/EmblemAvatar';
import { FButton } from '../components/FButton';
import { Icon } from '../components/Icon';
import { ItemActionModal } from '../components/ItemActionModal';
import { ItemSlot } from '../components/ItemSlot';
import { Panel } from '../components/Panel';
import { ProgressBar } from '../components/ProgressBar';
import { fmt, formatCountdown } from '../format';
import { useGameClock } from '../hooks/useGameClock';
import { itemName } from '../itemName';

const LEFT_SLOTS: EquipSlot[] = ['helmet', 'chest', 'gloves', 'boots'];
const RIGHT_SLOTS: EquipSlot[] = ['amulet', 'belt', 'ring', 'talisman'];
const BOTTOM_SLOTS: EquipSlot[] = ['weapon', 'offhand'];

function GearSlot({ save, slot }: { save: GameSave; slot: EquipSlot }) {
  const unequip = useGame((s) => s.unequip);
  const item = save.inventory.equipped[slot];
  if (!item) {
    return (
      <div
        className="frame-slot panel-fill-inset flex h-14 w-14 items-center justify-center md:h-16 md:w-16"
        style={{ ['--frame-w' as string]: '8px' }}
        title={`${slot} — ${t('screen.character.emptySlot')}`}
      >
        <Icon id="plus" size={16} className="text-ink-faint/50" />
      </div>
    );
  }
  return (
    <div className="relative">
      <ItemSlot item={item} size={60} onClick={() => unequip(slot)} />
      <span className="sr-only">{itemName(item)}</span>
    </div>
  );
}

function AttrRow({ save, attr }: { save: GameSave; attr: AttributeId }) {
  const buyAttr = useGame((s) => s.buyAttr);
  const total = totalAttribute(save, attr);
  const nextCost = attrCost(save.hero.attrsBought[attr] + 1);
  const affordable = save.hero.gold >= nextCost;
  return (
    <div className="flex items-center gap-2 border-b border-ink-faint/20 py-2 last:border-0">
      <span className="w-24 text-sm font-bold text-ink">{t(`attr.${attr}.name` as I18nKey)}</span>
      <span className="font-display text-lg font-semibold text-gold">{total}</span>
      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-[10px] text-ink-faint">
          {t('character.nextCost', { cost: fmt(nextCost) })}
        </span>
        <FButton size="sm" disabled={!affordable} onClick={() => buyAttr(attr, 1)}>
          +
        </FButton>
        <FButton size="sm" variant="quiet" disabled={!affordable} onClick={() => buyAttr(attr, 10)}>
          {t('character.buyTen')}
        </FButton>
      </div>
    </div>
  );
}

function DerivedPanel({ save }: { save: GameSave }) {
  const fighter = heroToCombatant(save);
  const avgWeapon = (fighter.weapon.min + fighter.weapon.max) / 2;
  const strikes = fighter.strikes > 1 ? 1 + fighter.strikeMult : 1;
  const avgHit = Math.round(
    avgWeapon * (1 + fighter.attrs[fighter.mainAttr] / 10) * fighter.dmgMult * strikes,
  );
  const dr = Math.min(DR_CAP, fighter.armor / (save.hero.level * DR_DIVISOR));
  const crit = Math.min(
    fighter.critCap,
    (fighter.attrs.lck * CRIT_PER_LUCK) / save.hero.level / 100,
  );

  const rows: [string, string][] = [
    [t('character.derived.damage'), fmt(avgHit)],
    [t('character.derived.armor'), fmt(fighter.armor)],
    [t('character.derived.dr'), `${Math.round(dr * 100)}%`],
    [t('character.derived.crit'), `${(crit * 100).toFixed(1)}%`],
    [t('character.derived.block'), `${Math.round(fighter.blockChance * 100)}%`],
    [t('character.derived.evade'), `${Math.round(fighter.evadeChance * 100)}%`],
  ];
  return (
    <div className="mt-3 grid grid-cols-2 gap-1.5">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex items-center justify-between rounded-sm bg-panel-inset px-2.5 py-1.5"
        >
          <span className="text-[11px] font-bold text-ink-muted">{label}</span>
          <span className="font-display text-sm font-semibold text-ink">{value}</span>
        </div>
      ))}
    </div>
  );
}

function PotionSockets({ save }: { save: GameSave }) {
  const now = useGameClock(30_000);
  return (
    <div className="mt-3">
      <h3 className="mb-1.5 text-xs font-extrabold tracking-[0.18em] text-ink-faint uppercase">
        {t('character.potions')}
      </h3>
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: POTION_SLOTS }, (_, i) => {
          const potion = save.hero.potions[i];
          if (!potion) {
            return (
              <div
                key={i}
                className="rounded-sm bg-panel-inset px-2.5 py-1.5 text-[11px] text-ink-faint"
              >
                {t('character.potionEmpty')}
              </div>
            );
          }
          const def = getElixir(potion.elixirId);
          const left = Math.max(0, (Date.parse(potion.expiresAt) - now) / 1000);
          return (
            <div
              key={i}
              className="rounded-sm bg-panel-inset px-2.5 py-1.5 text-[11px] font-bold text-gem"
            >
              {t('character.potionExpires', {
                name: t(def.nameKey as I18nKey),
                time: formatCountdown(left),
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BackpackTab({ save }: { save: GameSave }) {
  const [sort, setSort] = useState<'rarity' | 'ilvl' | 'newest'>('newest');
  const [selected, setSelected] = useState<number | null>(null);
  const order = { common: 0, uncommon: 1, rare: 2, epic: 3, set: 4, legendary: 5 };

  const indexed = save.inventory.backpack.map((item, index) => ({ item, index }));
  const sorted = [...indexed].sort((a, b) => {
    if (sort === 'rarity')
      return order[b.item.rarity] - order[a.item.rarity] || b.item.ilvl - a.item.ilvl;
    if (sort === 'ilvl') return b.item.ilvl - a.item.ilvl;
    return b.index - a.index;
  });

  return (
    <Panel
      variant="primary"
      title={t('backpack.capacity', {
        n: save.inventory.backpack.length,
        cap: save.inventory.capacity,
      })}
      headerRight={
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          aria-label="sort"
          className="rounded-sm border border-ink-faint/40 bg-panel-inset px-2 py-1 text-xs font-bold text-ink"
        >
          <option value="newest">{t('backpack.sort.newest')}</option>
          <option value="rarity">{t('backpack.sort.rarity')}</option>
          <option value="ilvl">{t('backpack.sort.ilvl')}</option>
        </select>
      }
    >
      {sorted.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-faint italic">{t('backpack.empty')}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
          {sorted.map(({ item, index }) => (
            <ItemSlot key={item.id} item={item} onClick={() => setSelected(index)} />
          ))}
        </div>
      )}
      {selected !== null && save.inventory.backpack[selected] && (
        <ItemActionModal save={save} backpackIndex={selected} onClose={() => setSelected(null)} />
      )}
    </Panel>
  );
}

/** Equip one earned title (GAME_DESIGN §13 — pure prestige). */
function TitlePicker({ save }: { save: GameSave }) {
  const equip = useGame((s) => s.equipTitle);
  const owned = save.progress.titles;
  if (owned.length === 0) return null;
  return (
    <label className="flex items-center gap-2 text-[11px] font-bold text-ink-faint">
      <span className="sr-only">{t('title.picker')}</span>
      <select
        value={save.hero.titleId ?? ''}
        onChange={(e) => equip(e.target.value === '' ? null : e.target.value)}
        className="rounded-sm border border-black/40 bg-panel-inset px-2 py-1 text-[11px] font-bold text-ink"
      >
        <option value="">{t('title.none')}</option>
        {owned.map((id) => (
          <option key={id} value={id}>
            {t(getTitle(id).nameKey as I18nKey)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CharacterScreen() {
  const save = useGame((s) => s.save);
  const [tab, setTab] = useState<'equipment' | 'backpack'>('equipment');
  if (!save) return null;
  const cls = getClass(save.hero.classId);
  const next = xpToNext(save.hero.level);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {(['equipment', 'backpack'] as const).map((id) => (
          <FButton
            key={id}
            variant={tab === id ? 'primary' : 'quiet'}
            size="sm"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
          >
            {t(`character.tab.${id}` as I18nKey)}
            {id === 'backpack' && ` (${save.inventory.backpack.length})`}
          </FButton>
        ))}
      </div>

      {tab === 'backpack' ? (
        <BackpackTab save={save} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
          <Panel variant="primary" title={t('screen.character.equipment')}>
            <div className="flex items-start justify-center gap-3 md:gap-5">
              <div className="flex flex-col gap-2">
                {LEFT_SLOTS.map((s) => (
                  <GearSlot key={s} save={save} slot={s} />
                ))}
              </div>
              <div className="flex flex-col items-center gap-2 pt-2">
                <EmblemAvatar emblem={save.hero.portrait} classId={save.hero.classId} size={110} />
                <div className="text-center">
                  <div className="font-display text-xl font-bold text-ink">
                    {save.hero.name}
                    {save.hero.titleId && (
                      <span className="ml-1.5 font-body text-sm font-bold text-gold">
                        {t(getTitle(save.hero.titleId).nameKey as I18nKey)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold" style={{ color: `var(${cls.colorVar})` }}>
                    <Icon
                      id={cls.icon as never}
                      size={14}
                      className="mr-1 inline-block align-[-2px]"
                    />
                    {t(`class.${cls.id}.name` as I18nKey)} ·{' '}
                    {t('common.levelShort', { level: save.hero.level })}
                  </div>
                </div>
                <TitlePicker save={save} />
                <ProgressBar
                  variant="xp"
                  value={save.hero.xp}
                  max={next}
                  className="h-3 w-40"
                  title={t('hud.xpTooltip', { xp: fmt(save.hero.xp), next: fmt(next) })}
                />
                <div className="mt-1 flex gap-2">
                  {BOTTOM_SLOTS.map((s) => (
                    <GearSlot key={s} save={save} slot={s} />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {RIGHT_SLOTS.map((s) => (
                  <GearSlot key={s} save={save} slot={s} />
                ))}
              </div>
            </div>
            <p className="mt-3 text-center text-[10px] text-ink-faint">
              {Object.values(save.inventory.equipped)
                .filter((i): i is NonNullable<typeof i> => Boolean(i))
                .map((i) => `${slotOf(i)}: ${itemName(i)}`)
                .join(' · ')}
            </p>
          </Panel>

          <Panel variant="primary" title={t('screen.character.attributes')}>
            <div>
              {ATTRIBUTE_IDS.map((attr) => (
                <AttrRow key={attr} save={save} attr={attr} />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-sm bg-panel-inset px-3 py-2">
              <span className="text-sm font-bold text-ink-muted">{t('create.hp')}</span>
              <span className="font-display text-lg font-semibold text-[#e08a7a]">
                {fmt(heroMaxHp(save))}
              </span>
            </div>
            <DerivedPanel save={save} />
            <PotionSockets save={save} />
          </Panel>
        </div>
      )}
    </div>
  );
}
