import { useEffect, useState } from 'react';
import { ELIXIRS } from '@/content/elixirs';
import { shopPrice } from '@/engine/items';
import { canBuyElixir, elixirPrice } from '@/engine/potions';
import { shopRerollCost } from '@/engine/shops';
import { msUntilNextLocalMidnight } from '@/engine/time';
import type { GameSave, ShopId } from '@/engine/types';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { FButton } from '../components/FButton';
import { Icon } from '../components/Icon';
import { ItemCard } from '../components/ItemCard';
import { Panel } from '../components/Panel';
import { fmt, formatCountdown } from '../format';
import { useGameClock } from '../hooks/useGameClock';

const ARCANUM_UNLOCK = 12;

const SHOP_TABS: { id: ShopId; unlock: number }[] = [
  { id: 'weaponsmith', unlock: 10 },
  { id: 'armorer', unlock: 10 },
  { id: 'arcanum', unlock: ARCANUM_UNLOCK },
];

function StockGrid({ save, shopId }: { save: GameSave; shopId: ShopId }) {
  const buy = useGame((s) => s.shopBuy);
  const stock = save.town.shops[shopId].stock;
  if (!stock) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {stock.map((item, i) =>
        item ? (
          <div key={item.id} className="flex flex-col items-center gap-2">
            <ItemCard item={item} className="w-full" />
            <FButton
              className="w-full"
              disabled={
                save.hero.gold < shopPrice(item) ||
                save.inventory.backpack.length >= save.inventory.capacity
              }
              onClick={() => buy(shopId, i)}
            >
              {t('shops.buy', { gold: fmt(shopPrice(item)) })}
            </FButton>
          </div>
        ) : (
          <div
            key={`sold-${i}`}
            className="frame-secondary--muted panel-fill flex min-h-32 items-center justify-center opacity-50"
          >
            <span className="font-display text-sm font-bold text-ink-faint">{t('shops.sold')}</span>
          </div>
        ),
      )}
    </div>
  );
}

function ElixirRack({ save }: { save: GameSave }) {
  const drink = useGame((s) => s.elixir);
  return (
    <Panel variant="secondary" title={t('shops.elixirRack')} className="mt-4">
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {ELIXIRS.map((e) => {
          const check = canBuyElixir(save, e.id);
          return (
            <button
              key={e.id}
              onClick={() => drink(e.id)}
              disabled={!check.ok}
              className="flex items-center justify-between gap-2 rounded-sm bg-panel-inset px-2.5 py-1.5 text-left transition-[filter] enabled:hover:brightness-125 disabled:opacity-45"
            >
              <span className="text-[11px] font-bold text-gem">{t(e.nameKey as I18nKey)}</span>
              <span className="shrink-0 text-[11px] font-bold text-gold">
                {t('shops.elixirBuy', { price: fmt(elixirPrice(save, e.id)) })}
              </span>
            </button>
          );
        })}
      </div>
      {save.hero.potions.length >= 3 && (
        <p className="mt-2 text-[11px] text-ink-faint">{t('shops.elixirFull')}</p>
      )}
    </Panel>
  );
}

export function ShopsScreen() {
  const save = useGame((s) => s.save);
  const ensure = useGame((s) => s.shopEnsureStock);
  const reroll = useGame((s) => s.shopReroll);
  const toast = useGame((s) => s.toast);
  const now = useGameClock(30_000);
  const [tab, setTab] = useState<ShopId>('weaponsmith');

  const level = save?.hero.level ?? 1;
  const activeUnlocked = level >= (SHOP_TABS.find((s) => s.id === tab)?.unlock ?? 99);

  useEffect(() => {
    if (save && activeUnlocked) ensure(tab);
  }, [save, tab, activeUnlocked, ensure]);

  if (!save) return null;
  const cost = shopRerollCost(save, tab);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {SHOP_TABS.map(({ id, unlock }) => {
          const locked = level < unlock;
          return (
            <FButton
              key={id}
              size="sm"
              variant={tab === id ? 'primary' : 'quiet'}
              aria-pressed={tab === id}
              onClick={() => {
                if (locked) toast(t('shops.lockedTab', { level: unlock }));
                else setTab(id);
              }}
            >
              {locked && <Icon id="lock" size={12} />}
              {t(`shops.${id}.name` as I18nKey)}
            </FButton>
          );
        })}
        <span className="ml-auto self-center text-[11px] font-bold text-ink-faint">
          {t('shops.refresh', { time: formatCountdown(msUntilNextLocalMidnight(now) / 1000) })}
        </span>
      </div>

      {activeUnlocked ? (
        <Panel
          variant="primary"
          title={t(`shops.${tab}.name` as I18nKey)}
          headerRight={
            <FButton
              size="sm"
              variant={cost > 0 ? 'gem' : 'quiet'}
              disabled={save.hero.gems < cost}
              onClick={() => reroll(tab)}
            >
              {cost > 0 ? t('shops.rerollPaid') : t('shops.reroll')}
            </FButton>
          }
        >
          <p className="-mt-1 mb-3 text-xs text-ink-muted italic">
            {t(`shops.${tab}.npc` as I18nKey)}
          </p>
          <StockGrid save={save} shopId={tab} />
          {tab === 'arcanum' && <ElixirRack save={save} />}
        </Panel>
      ) : (
        <Panel variant="secondary">
          <p className="py-8 text-center text-sm text-ink-faint">
            {t('shops.lockedTab', { level: SHOP_TABS.find((s) => s.id === tab)?.unlock ?? 12 })}
          </p>
        </Panel>
      )}
    </div>
  );
}
