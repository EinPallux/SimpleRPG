import { useState } from 'react';
import { DISMANTLES_PER_DAY, UPGRADE_STAT_PER_LEVEL } from '@/engine/constants';
import { dismantlesLeft, itemAt, upgradeCost, type ItemLocation } from '@/engine/forge';
import { dismantleYield } from '@/engine/items';
import type { EquipSlot, GameSave } from '@/engine/types';
import { t } from '@/i18n';
import { useGame } from '@/state/store';
import { FButton } from '../components/FButton';
import { ItemCard } from '../components/ItemCard';
import { ItemSlot } from '../components/ItemSlot';
import { Panel } from '../components/Panel';
import { fmt } from '../format';
import { itemName } from '../itemName';

function sameLoc(a: ItemLocation | null, b: ItemLocation): boolean {
  if (!a) return false;
  if (a.kind === 'equipped' && b.kind === 'equipped') return a.slot === b.slot;
  if (a.kind === 'backpack' && b.kind === 'backpack') return a.index === b.index;
  return false;
}

function UpgradeBench({ save }: { save: GameSave }) {
  const forgeUpgrade = useGame((s) => s.forgeUpgrade);
  const [loc, setLoc] = useState<ItemLocation | null>(null);
  const item = loc ? itemAt(save, loc) : null;
  const cost = item ? upgradeCost(item) : null;

  const equippedLocs: ItemLocation[] = Object.keys(save.inventory.equipped).map((slot) => ({
    kind: 'equipped',
    slot: slot as EquipSlot,
  }));
  const backpackLocs: ItemLocation[] = save.inventory.backpack.map((_, index) => ({
    kind: 'backpack',
    index,
  }));
  const all = [...equippedLocs, ...backpackLocs];

  return (
    <Panel variant="primary" title={t('forge.upgradeBench')}>
      <p className="-mt-1 mb-3 text-xs text-ink-muted italic">{t('forge.npc')}</p>
      {all.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-faint">{t('forge.noItems')}</p>
      ) : (
        <>
          <p className="mb-1.5 text-[10px] font-bold tracking-wider text-ink-faint uppercase">
            {t('forge.pickItem')}
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {all.map((candidate) => {
              const it = itemAt(save, candidate)!;
              return (
                <ItemSlot
                  key={it.id}
                  item={it}
                  size={48}
                  selected={sameLoc(loc, candidate)}
                  onClick={() => setLoc(candidate)}
                />
              );
            })}
          </div>
          {item && (
            <div className="flex flex-wrap items-start gap-4">
              <ItemCard item={item} />
              <div className="flex min-w-44 flex-col gap-2">
                <div className="rounded-sm bg-panel-inset px-3 py-2 text-sm font-bold text-ink">
                  {t('forge.current', { n: item.upgrade })}
                </div>
                {cost ? (
                  <>
                    <div className="rounded-sm bg-panel-inset px-3 py-2 text-xs text-ink-muted">
                      {t('forge.next', {
                        n: item.upgrade + 1,
                        pct: Math.round((item.upgrade + 1) * UPGRADE_STAT_PER_LEVEL * 1000) / 10,
                      })}
                      <div className="mt-1 font-bold text-gold">
                        {t('forge.cost', { scraps: cost.scraps, gold: fmt(cost.gold) })}
                      </div>
                    </div>
                    <FButton
                      disabled={save.hero.scraps < cost.scraps || save.hero.gold < cost.gold}
                      onClick={() => forgeUpgrade(loc!)}
                    >
                      {t('forge.upgrade')}
                    </FButton>
                  </>
                ) : (
                  <p className="text-xs font-bold text-gold-bright">{t('forge.maxed')}</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function DismantleBench({ save }: { save: GameSave }) {
  const dismantle = useGame((s) => s.forgeDismantle);
  const [index, setIndex] = useState<number | null>(null);
  const left = dismantlesLeft(save);
  const item = index !== null ? save.inventory.backpack[index] : undefined;
  const yields = item ? dismantleYield(item) : null;

  return (
    <Panel
      variant="secondary"
      title={t('forge.dismantleBench')}
      headerRight={
        <span
          className="flex items-center gap-1"
          title={t('forge.dismantleLeft', { left, max: DISMANTLES_PER_DAY })}
        >
          {Array.from({ length: DISMANTLES_PER_DAY }, (_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full ${i < left ? 'bg-gold' : 'bg-ink-faint/40'}`}
            />
          ))}
        </span>
      }
    >
      {save.inventory.backpack.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-faint">{t('forge.noItems')}</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {save.inventory.backpack.map((it, i) => (
              <ItemSlot
                key={it.id}
                item={it}
                size={48}
                selected={index === i}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          {item && yields && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-bold text-ink">{itemName(item)}</span>
              <span className="text-xs text-ink-muted">
                {t('forge.dismantleYield', {
                  scraps: yields.scraps,
                  dust: yields.dust > 0 ? t('forge.dismantleDust', { n: yields.dust }) : '',
                })}
              </span>
              <FButton
                variant="danger"
                size="sm"
                disabled={left === 0}
                title={left === 0 ? t('forge.noneLeft') : undefined}
                onClick={() => {
                  dismantle(index!);
                  setIndex(null);
                }}
              >
                {t('forge.dismantle')}
              </FButton>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

export function ForgeScreen() {
  const save = useGame((s) => s.save);
  if (!save) return null;
  return (
    <div className="flex flex-col gap-4">
      <UpgradeBench save={save} />
      <DismantleBench save={save} />
    </div>
  );
}
