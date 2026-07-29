import { dismantlesLeft } from '@/engine/forge';
import { classFitness, suitsClass } from '@/engine/inventoryOps';
import { sellPrice, slotOf } from '@/engine/items';
import type { GameSave, ItemInstance } from '@/engine/types';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { fmt } from '../format';
import { FButton } from './FButton';
import { ItemCard } from './ItemCard';
import { Modal } from './Modal';

/** Backpack item actions with a live compare against the equipped piece. */
export function ItemActionModal({
  save,
  backpackIndex,
  onClose,
}: {
  save: GameSave;
  backpackIndex: number;
  onClose: () => void;
}) {
  const equip = useGame((s) => s.equip);
  const sell = useGame((s) => s.sell);
  const dismantle = useGame((s) => s.forgeDismantle);
  const item = save.inventory.backpack[backpackIndex];
  if (!item) return null;

  const equipped: ItemInstance | undefined = save.inventory.equipped[slotOf(item)];
  // Off-class gear equips fine; it is just a worse deal, so the modal advises
  // rather than refuses (engine/inventoryOps.ts `classFitness`).
  const suits = suitsClass(save, item);
  const fitness = classFitness(save, item);
  const forgeUnlocked = save.hero.level >= 15;
  const gate = dismantlesLeft(save);

  return (
    <Modal title={t(`item.rarity.${item.rarity}` as I18nKey)} onClose={onClose} wide>
      <div className="flex flex-wrap items-start justify-center gap-4">
        <ItemCard item={item} />
        {equipped && (
          <div>
            <p className="mb-1 text-center text-[10px] font-bold tracking-wider text-ink-faint uppercase">
              {t('itemAction.replaces')}
            </p>
            <ItemCard item={equipped} className="opacity-80" />
          </div>
        )}
      </div>
      {!suits && (
        <p className="mt-3 text-center text-xs font-bold text-[#e0b45a]">
          {t('itemAction.offClass', {
            cls: t(`class.${item.classId}.name` as I18nKey),
            pct: Math.round(fitness * 100),
          })}
        </p>
      )}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <FButton
          onClick={() => {
            equip(backpackIndex);
            onClose();
          }}
        >
          {t('itemAction.equip')}
        </FButton>
        <FButton
          variant="quiet"
          onClick={() => {
            sell(backpackIndex);
            onClose();
          }}
        >
          {t('itemAction.sell', { gold: fmt(sellPrice(item)) })}
        </FButton>
        {forgeUnlocked && (
          <FButton
            variant="danger"
            disabled={gate === 0}
            onClick={() => {
              dismantle(backpackIndex);
              onClose();
            }}
          >
            {t('itemAction.dismantle', { left: gate })}
          </FButton>
        )}
      </div>
    </Modal>
  );
}
