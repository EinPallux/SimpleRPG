/**
 * Global game store (TECHNICAL_ARCHITECTURE.md §3): zustand + immer, one store,
 * all mutations via named actions that call engine functions and schedule
 * persistence. Components never mutate state directly.
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createNewSave, deriveEmblem } from '@/engine/newSave';
import { systemClock } from '@/engine/clock';
import {
  acceptTavernOffer,
  canStartMission,
  claimMission,
  getTavernOffers,
  isMissionComplete,
  rerollTavernOffers,
  tavernRerollCost,
  type MissionRewards,
} from '@/engine/missions';
import { canStartPatrol, collectPatrol, startPatrol, stopPatrol } from '@/engine/patrol';
import { applyTimePassage } from '@/engine/timePassage';
import { buyAle, canBuyAle, canClaimSecondWind, claimSecondWind } from '@/engine/vigor';
import { attrCost, buyAttributePoint } from '@/engine/economy';
import { dismantleItem, dismantlesLeft, upgradeItem, type ItemLocation } from '@/engine/forge';
import { canEquip, equipItem, sellItem, unequipItem } from '@/engine/inventoryOps';
import { buyElixir, canBuyElixir } from '@/engine/potions';
import { getElixir } from '@/content/elixirs';
import { buyShopItem, getShopStock, rerollShopStock, shopRerollCost } from '@/engine/shops';
import { itemName } from '@/ui/itemName';
import { fmt } from '@/ui/format';
import type {
  AttributeId,
  ClassId,
  EmblemSpec,
  EquipSlot,
  GameSave,
  ShopId,
  SlotSummary,
} from '@/engine/types';
import { CodecError, decodeSave, encodeSave } from '@/persist/codec';
import {
  deleteSlot as dbDeleteSlot,
  getActiveSlot,
  listSlotSummaries,
  loadSlot,
  persistSlot,
  randomWorldSeed,
  setActiveSlot,
} from '@/persist/saves';
import { t } from '@/i18n';

export type ScreenId =
  | 'tavern'
  | 'expeditions'
  | 'patrol'
  | 'arena'
  | 'dungeons'
  | 'hallOfFame'
  | 'shops'
  | 'forge'
  | 'stable'
  | 'menagerie'
  | 'well'
  | 'wheel'
  | 'character'
  | 'quests'
  | 'achievements'
  | 'codex'
  | 'calendar';

export interface Toast {
  id: number;
  text: string;
}

export type Phase = 'boot' | 'title' | 'ingame';

interface GameStore {
  phase: Phase;
  slots: (SlotSummary | null)[];
  lastActiveSlot: number | null;
  activeSlot: number | null;
  save: GameSave | null;
  screen: ScreenId;
  settingsOpen: boolean;
  toasts: Toast[];
  /** true while the device clock sits behind the save's high-water mark */
  timeFrozen: boolean;
  /** pending mission rewards to present in the RewardReveal modal */
  reveal: MissionRewards | null;

  bootstrap(): Promise<void>;
  /** Run offline catch-up / clock-guard check against the wall clock. */
  catchUp(): void;

  // Tavern & vigor (M2)
  tavernEnsureOffers(): void;
  tavernAccept(index: number): void;
  tavernClaim(): void;
  tavernReroll(): void;
  setZonePin(zoneIndex: number | null): void;
  secondWind(): void;
  ale(): void;
  closeReveal(): void;

  // Patrol (M2)
  patrolStart(): void;
  patrolCollect(): void;
  patrolStop(): void;

  // Hero economy (M3)
  buyAttr(attr: AttributeId, times?: number): void;
  equip(backpackIndex: number): void;
  unequip(slot: EquipSlot): void;
  sell(backpackIndex: number): void;
  shopEnsureStock(shopId: ShopId): void;
  shopBuy(shopId: ShopId, index: number): void;
  shopReroll(shopId: ShopId): void;
  elixir(elixirId: string): void;
  forgeUpgrade(loc: ItemLocation): void;
  forgeDismantle(backpackIndex: number): void;
  refreshSlots(): Promise<void>;
  createHero(
    slot: number,
    input: { name: string; classId: ClassId; emblem?: EmblemSpec },
  ): Promise<void>;
  continueSlot(slot: number): Promise<void>;
  exitToTitle(): Promise<void>;
  setScreen(screen: ScreenId): void;
  setSettingsOpen(open: boolean): void;
  toast(text: string): void;
  dismissToast(id: number): void;
  saveNow(): Promise<void>;
  exportActive(): string | null;
  importCode(slot: number, code: string): Promise<{ ok: true } | { ok: false; message: string }>;
  deleteSlot(slot: number): Promise<void>;
  touchLastSeen(): void;
}

let toastCounter = 0;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

export const useGame = create<GameStore>()(
  immer((set, get) => {
    /** Debounced write-behind; flushed by saveNow() and on visibility loss. */
    function scheduleAutosave() {
      if (autosaveTimer) clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(() => {
        void get().saveNow();
      }, 1000);
    }

    return {
      phase: 'boot',
      slots: [],
      lastActiveSlot: null,
      activeSlot: null,
      save: null,
      screen: 'tavern',
      settingsOpen: false,
      toasts: [],
      timeFrozen: false,
      reveal: null,

      catchUp() {
        set((s) => {
          if (!s.save) return;
          const result = applyTimePassage(s.save, systemClock.now());
          s.timeFrozen = result.frozen;
        });
        scheduleAutosave();
      },

      tavernEnsureOffers() {
        // Fills the board when empty — called from an effect, never during render.
        set((s) => {
          if (s.save && !s.save.activities.tavernOffers) getTavernOffers(s.save);
        });
        scheduleAutosave();
      },

      tavernAccept(index) {
        set((s) => {
          if (!s.save) return;
          const offer = getTavernOffers(s.save)[index];
          if (!offer || !canStartMission(s.save, offer)) return;
          acceptTavernOffer(s.save, index, systemClock.now());
        });
        scheduleAutosave();
      },

      tavernClaim() {
        set((s) => {
          if (!s.save || !isMissionComplete(s.save, systemClock.now())) return;
          s.reveal = claimMission(s.save, systemClock.now());
        });
        scheduleAutosave();
      },

      tavernReroll() {
        set((s) => {
          if (!s.save || s.save.hero.gems < tavernRerollCost(s.save)) return;
          rerollTavernOffers(s.save);
        });
        scheduleAutosave();
      },

      setZonePin(zoneIndex) {
        set((s) => {
          if (s.save) s.save.progress.zonePinned = zoneIndex;
        });
        scheduleAutosave();
      },

      secondWind() {
        set((s) => {
          if (s.save && canClaimSecondWind(s.save)) claimSecondWind(s.save);
        });
        scheduleAutosave();
      },

      ale() {
        set((s) => {
          if (s.save && canBuyAle(s.save)) buyAle(s.save);
        });
        scheduleAutosave();
      },

      closeReveal() {
        set((s) => {
          s.reveal = null;
        });
      },

      patrolStart() {
        set((s) => {
          if (s.save && canStartPatrol(s.save)) startPatrol(s.save, systemClock.now());
        });
        scheduleAutosave();
      },

      patrolCollect() {
        set((s) => {
          if (s.save?.activities.patrol) collectPatrol(s.save, systemClock.now());
        });
        scheduleAutosave();
      },

      patrolStop() {
        set((s) => {
          if (s.save?.activities.patrol) stopPatrol(s.save, systemClock.now());
        });
        scheduleAutosave();
      },

      buyAttr(attr, times = 1) {
        let boughtTo: number | null = null;
        set((s) => {
          if (!s.save) return;
          for (let i = 0; i < times; i++) {
            if (s.save.hero.gold < attrCost(s.save.hero.attrsBought[attr] + 1)) break;
            buyAttributePoint(s.save, attr);
            boughtTo = s.save.hero.attrsBought[attr];
          }
        });
        if (boughtTo !== null) {
          get().toast(t('toast.attrBought', { attr: t(`attr.${attr}.name`), value: boughtTo }));
        }
        scheduleAutosave();
      },

      equip(backpackIndex) {
        set((s) => {
          const item = s.save?.inventory.backpack[backpackIndex];
          if (!s.save || !item || !canEquip(s.save, item)) return;
          equipItem(s.save, backpackIndex);
        });
        scheduleAutosave();
      },

      unequip(slot) {
        set((s) => {
          if (!s.save?.inventory.equipped[slot]) return;
          if (s.save.inventory.backpack.length >= s.save.inventory.capacity) return;
          unequipItem(s.save, slot);
        });
        scheduleAutosave();
      },

      sell(backpackIndex) {
        let text: string | null = null;
        set((s) => {
          const item = s.save?.inventory.backpack[backpackIndex];
          if (!s.save || !item) return;
          const name = itemName(item);
          const gold = sellItem(s.save, backpackIndex);
          text = t('toast.sold', { name, gold: fmt(gold) });
        });
        if (text) get().toast(text);
        scheduleAutosave();
      },

      shopEnsureStock(shopId) {
        set((s) => {
          if (s.save && !s.save.town.shops[shopId].stock) getShopStock(s.save, shopId);
        });
        scheduleAutosave();
      },

      shopBuy(shopId, index) {
        let text: string | null = null;
        set((s) => {
          if (!s.save) return;
          const item = getShopStock(s.save, shopId)[index];
          if (!item) return;
          if (s.save.inventory.backpack.length >= s.save.inventory.capacity) {
            text = t('toast.backpackFull');
            return;
          }
          try {
            buyShopItem(s.save, shopId, index);
            text = t('toast.bought', { name: itemName(item) });
          } catch {
            /* insufficient gold — the button disables, this is belt-and-braces */
          }
        });
        if (text) get().toast(text);
        scheduleAutosave();
      },

      shopReroll(shopId) {
        set((s) => {
          if (!s.save || s.save.hero.gems < shopRerollCost(s.save, shopId)) return;
          rerollShopStock(s.save, shopId);
        });
        scheduleAutosave();
      },

      elixir(elixirId) {
        let text: string | null = null;
        set((s) => {
          if (!s.save || !canBuyElixir(s.save, elixirId).ok) return;
          const potion = buyElixir(s.save, elixirId, systemClock.now());
          const def = getElixir(potion.elixirId);
          text = t('toast.elixir', { name: t(def.nameKey as Parameters<typeof t>[0]) });
        });
        if (text) get().toast(text);
        scheduleAutosave();
      },

      forgeUpgrade(loc) {
        let text: string | null = null;
        set((s) => {
          if (!s.save) return;
          try {
            const item = upgradeItem(s.save, loc);
            text = t('toast.upgraded', { name: itemName(item) });
          } catch {
            /* cost gates — buttons disable */
          }
        });
        if (text) get().toast(text);
        scheduleAutosave();
      },

      forgeDismantle(backpackIndex) {
        let text: string | null = null;
        set((s) => {
          const item = s.save?.inventory.backpack[backpackIndex];
          if (!s.save || !item || dismantlesLeft(s.save) === 0) return;
          const name = itemName(item);
          const yields = dismantleItem(s.save, backpackIndex);
          text = t('toast.dismantled', {
            name,
            scraps: yields.scraps,
            dust: yields.dust > 0 ? t('toast.dismantledDust', { n: yields.dust }) : '',
          });
        });
        if (text) get().toast(text);
        scheduleAutosave();
      },

      async bootstrap() {
        const [slots, lastActive] = await Promise.all([listSlotSummaries(), getActiveSlot()]);
        set((s) => {
          s.slots = slots;
          s.lastActiveSlot = lastActive;
          s.phase = 'title';
        });
      },

      async refreshSlots() {
        const slots = await listSlotSummaries();
        set((s) => {
          s.slots = slots;
        });
      },

      async createHero(slot, input) {
        const emblem = input.emblem ?? deriveEmblem(input.name, input.classId);
        const save = createNewSave(
          { name: input.name, classId: input.classId, emblem, worldSeed: randomWorldSeed() },
          systemClock.now(),
        );
        await persistSlot(slot, save);
        await setActiveSlot(slot);
        set((s) => {
          s.save = save;
          s.activeSlot = slot;
          s.lastActiveSlot = slot;
          s.phase = 'ingame';
          s.screen = 'tavern';
        });
        await get().refreshSlots();
      },

      async continueSlot(slot) {
        const save = await loadSlot(slot);
        if (!save) return;
        // Offline catch-up: bank patrol, apply crossed daily/weekly/monthly
        // resets, honor the clock-rollback guard (engine/timePassage.ts).
        const passage = applyTimePassage(save, systemClock.now());
        await persistSlot(slot, save);
        await setActiveSlot(slot);
        set((s) => {
          s.save = save;
          s.activeSlot = slot;
          s.lastActiveSlot = slot;
          s.phase = 'ingame';
          s.screen = 'tavern';
          s.timeFrozen = passage.frozen;
        });
      },

      async exitToTitle() {
        await get().saveNow();
        await get().refreshSlots();
        set((s) => {
          s.save = null;
          s.activeSlot = null;
          s.phase = 'title';
          s.settingsOpen = false;
        });
      },

      setScreen(screen) {
        set((s) => {
          s.screen = screen;
        });
      },

      setSettingsOpen(open) {
        set((s) => {
          s.settingsOpen = open;
        });
      },

      toast(text) {
        const id = ++toastCounter;
        set((s) => {
          s.toasts.push({ id, text });
          if (s.toasts.length > 3) s.toasts.shift();
        });
        setTimeout(() => get().dismissToast(id), 4000);
      },

      dismissToast(id) {
        set((s) => {
          s.toasts = s.toasts.filter((toast) => toast.id !== id);
        });
      },

      async saveNow() {
        if (autosaveTimer) {
          clearTimeout(autosaveTimer);
          autosaveTimer = null;
        }
        const { save, activeSlot } = get();
        if (save && activeSlot) await persistSlot(activeSlot, save);
      },

      exportActive() {
        const { save } = get();
        return save ? encodeSave(save) : null;
      },

      async importCode(slot, code) {
        try {
          const save = decodeSave(code);
          await persistSlot(slot, save);
          await get().refreshSlots();
          return { ok: true };
        } catch (err) {
          const reason = err instanceof CodecError ? err.reason : 'invalid';
          return { ok: false, message: t(`toast.importFail.${reason}`) };
        }
      },

      async deleteSlot(slot) {
        await dbDeleteSlot(slot);
        if (get().activeSlot === slot) {
          set((s) => {
            s.save = null;
            s.activeSlot = null;
            s.phase = 'title';
          });
        }
        if (get().lastActiveSlot === slot) {
          set((s) => {
            s.lastActiveSlot = null;
          });
        }
        await get().refreshSlots();
      },

      touchLastSeen() {
        set((s) => {
          if (s.save) s.save.lastSeenAt = new Date(systemClock.now()).toISOString();
        });
        scheduleAutosave();
      },
    };
  }),
);

/**
 * Tab lifecycle: flush writes when hiding, run offline catch-up when returning
 * — the classic browser-game pair.
 */
export function attachLifecyclePersistence(): () => void {
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') void useGame.getState().saveNow();
    else useGame.getState().catchUp();
  };
  document.addEventListener('visibilitychange', onVisibility);
  return () => document.removeEventListener('visibilitychange', onVisibility);
}
