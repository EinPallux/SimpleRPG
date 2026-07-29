/**
 * Global game store (TECHNICAL_ARCHITECTURE.md §3): zustand + immer, one store,
 * all mutations via named actions that call engine functions and schedule
 * persistence. Components never mutate state directly.
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { canFight, fightArena, skipCooldown, type ArenaOutcome } from '@/engine/arena';
import { ARENA_COOLDOWN_SKIP_GEMS, QUESTS_UNLOCK_LEVEL } from '@/engine/constants';
import { bossNameKey, getDungeon } from '@/content/dungeons';
import { getQuest } from '@/content/quests';
import { canClaimAchievement, claimAchievement, claimAllAchievements } from '@/engine/achievements';
import { canClaimCalendar, claimCalendarDay } from '@/engine/calendar';
import { readLore } from '@/engine/codex';
import {
  canClaimActivityChest,
  canClaimQuest,
  canSwapDaily,
  claimActivityChest,
  claimQuest,
  ensureQuestBoard,
  swapDaily,
} from '@/engine/quests';
import type { GrantedReward } from '@/engine/rewards';
import { canClaimStep, claimStep } from '@/engine/story';
import { attemptFloor, canAttemptFloor, type DungeonOutcome } from '@/engine/dungeons';
import {
  abandonExpedition,
  canStartExpedition,
  ensureCards,
  resolveCard,
  startExpedition,
  type ExpeditionStepOutcome,
} from '@/engine/expeditions';
import { canSpinWheel, spinWheel, type WheelOutcome } from '@/engine/wheel';
import type { BannerId } from '@/content/collectibles';
import { canToss, toss, type TossResult } from '@/engine/gacha';
import { buyMount, canBuyMount } from '@/engine/mounts';
import { canFeedPet, equipPet, feedPet, feedPetMax, petOwned } from '@/engine/pets';
import { isoWeekNumber } from '@/engine/time';
import {
  advanceOnboarding,
  currentOnboardingStep,
  markTourSeen,
  skipOnboarding,
  stepSatisfied,
  tourDue,
} from '@/engine/onboarding';
import { loadPrefs, savePrefs, type Prefs } from '@/persist/prefs';
import { setAudioPrefs } from '@/ui/audio';
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
import { t, type I18nKey } from '@/i18n';

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
  /** finished arena bout awaiting playback (Shell renders the overlay) */
  arenaOutcome: ArenaOutcome | null;
  /** finished dungeon attempt awaiting playback */
  dungeonOutcome: DungeonOutcome | null;
  /** resolved expedition card (fights carry a combat log for playback) */
  expedOutcome: ExpeditionStepOutcome | null;
  /** landed wheel spin awaiting the reveal */
  wheelOutcome: WheelOutcome | null;
  /** the tosses of the last visit to the well, awaiting their reveal (M7) */
  tossOutcome: { bannerId: BannerId; results: TossResult[] } | null;
  /** device settings (M8) — localStorage, not the save: a pref is a device */
  prefs: Prefs;
  /** the screen whose 15-second first-visit tour is showing, if any */
  tourScreen: string | null;
  /** a meta-layer payout (quest, story step, chest, calendar) awaiting its reveal */
  metaReward: { titleKey: I18nKey; reward: GrantedReward } | null;

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

  // Arena (M4)
  arenaFight(offerIndex: number): void;
  arenaSkipCooldown(): void;
  closeArenaOutcome(): void;

  // Meta layer (M6)
  questsEnsureBoards(): void;
  questClaim(questId: string): void;
  questSwap(questId: string): void;
  activityChestClaim(): void;
  storyClaim(chapter: number): void;
  achievementClaim(id: string): void;
  achievementClaimAll(): void;
  calendarClaim(): void;
  equipTitle(titleId: string | null): void;
  codexReadLore(monsterId: string): void;
  closeMetaReward(): void;

  // Dungeons, expeditions, wheel (M5)
  dungeonFight(dungeonId: string): void;
  closeDungeonOutcome(): void;
  expedStart(localeId: string): void;
  expedEnsureCards(): void;
  expedResolve(cardIndex: number, choice?: 'safe' | 'bold'): void;
  expedAbandon(): void;
  closeExpedOutcome(): void;
  wheelSpin(): void;
  closeWheelOutcome(): void;

  // Onboarding, prefs & help (M8)
  setPrefs(patch: Partial<Prefs>): void;
  onboardingAck(): void;
  onboardingSkip(): void;
  dismissTour(): void;

  // Menagerie, Stable & the Wishing Well (M7)
  petEquip(petId: string | null): void;
  petFeed(petId: string): void;
  petFeedMax(petId: string): void;
  mountBuy(tier: number): void;
  wellToss(bannerId: BannerId, count?: number): void;
  closeTossOutcome(): void;

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
      arenaOutcome: null,
      dungeonOutcome: null,
      expedOutcome: null,
      wheelOutcome: null,
      tossOutcome: null,
      prefs: loadPrefs(),
      tourScreen: null,
      metaReward: null,

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

      arenaFight(offerIndex) {
        let milestone: { rank: number; gems: number } | null = null;
        set((s) => {
          if (!s.save || !canFight(s.save, systemClock.now())) return;
          const outcome = fightArena(s.save, offerIndex, systemClock.now());
          s.arenaOutcome = outcome;
          if (outcome.milestoneGems > 0) {
            milestone = { rank: outcome.newRank, gems: outcome.milestoneGems };
          }
        });
        if (milestone) {
          get().toast(t('toast.rankMilestone', milestone));
        }
        scheduleAutosave();
      },

      arenaSkipCooldown() {
        set((s) => {
          if (!s.save || s.save.hero.gems < ARENA_COOLDOWN_SKIP_GEMS) return;
          if (!s.save.activities.arena.cooldownUntil) return;
          skipCooldown(s.save);
        });
        scheduleAutosave();
      },

      closeArenaOutcome() {
        set((s) => {
          s.arenaOutcome = null;
        });
      },

      dungeonFight(dungeonId) {
        let toastText: string | null = null;
        set((s) => {
          if (!s.save || !canAttemptFloor(s.save, dungeonId, systemClock.now()).ok) return;
          const floor = (s.save.progress.dungeonFloors[dungeonId] ?? 0) + 1;
          const slug = getDungeon(dungeonId).bosses[floor - 1]!.slug;
          const outcome = attemptFloor(
            s.save,
            dungeonId,
            systemClock.now(),
            t(bossNameKey(slug) as I18nKey),
          );
          s.dungeonOutcome = outcome;
          if (outcome.won && outcome.setDrop && outcome.drop) {
            toastText = t('toast.setDrop', { name: itemName(outcome.drop) });
          }
        });
        if (toastText) get().toast(toastText);
        scheduleAutosave();
      },

      closeDungeonOutcome() {
        set((s) => {
          s.dungeonOutcome = null;
        });
      },

      expedStart(localeId) {
        set((s) => {
          if (!s.save || !canStartExpedition(s.save).ok) return;
          startExpedition(s.save, localeId);
          ensureCards(s.save);
        });
        scheduleAutosave();
      },

      expedEnsureCards() {
        // Rolls the current encounter's cards when missing — effect-driven.
        set((s) => {
          if (s.save?.activities.expedition && !s.save.activities.expedition.cards) {
            ensureCards(s.save);
          }
        });
        scheduleAutosave();
      },

      expedResolve(cardIndex, choice) {
        let toastText: string | null = null;
        set((s) => {
          if (!s.save?.activities.expedition) return;
          const outcome = resolveCard(s.save, cardIndex, choice);
          s.expedOutcome = outcome;
          if (outcome.chest?.setDrop && outcome.chest.item) {
            toastText = t('toast.setDrop', { name: itemName(outcome.chest.item) });
          }
        });
        if (toastText) get().toast(toastText);
        scheduleAutosave();
      },

      expedAbandon() {
        set((s) => {
          if (!s.save?.activities.expedition) return;
          abandonExpedition(s.save);
          s.expedOutcome = null;
        });
        get().toast(t('exped.abandoned'));
        scheduleAutosave();
      },

      closeExpedOutcome() {
        set((s) => {
          s.expedOutcome = null;
        });
      },

      wheelSpin() {
        set((s) => {
          if (!s.save || !canSpinWheel(s.save)) return;
          s.wheelOutcome = spinWheel(s.save);
        });
        scheduleAutosave();
      },

      closeWheelOutcome() {
        set((s) => {
          s.wheelOutcome = null;
        });
      },

      petEquip(petId) {
        set((s) => {
          if (!s.save) return;
          if (petId !== null && !petOwned(s.save, petId)) return;
          equipPet(s.save, petId);
        });
        scheduleAutosave();
      },

      petFeed(petId) {
        set((s) => {
          if (!s.save || !canFeedPet(s.save, petId)) return;
          feedPet(s.save, petId);
        });
        scheduleAutosave();
      },

      petFeedMax(petId) {
        let fed = 0;
        set((s) => {
          if (!s.save) return;
          fed = feedPetMax(s.save, petId);
        });
        if (fed > 0) get().toast(t('menagerie.fedLevels', { n: fed }));
        scheduleAutosave();
      },

      mountBuy(tier) {
        let bought: { name: string } | null = null;
        set((s) => {
          if (!s.save || !canBuyMount(s.save, tier)) return;
          const purchase = buyMount(s.save, tier);
          bought = { name: t(`${purchase.mount.nameKey}` as I18nKey) };
        });
        if (bought) get().toast(t('stable.bought', bought));
        scheduleAutosave();
      },

      wellToss(bannerId, count = 1) {
        set((s) => {
          if (!s.save || !canToss(s.save, bannerId, count)) return;
          const week = isoWeekNumber(systemClock.now());
          s.tossOutcome = {
            bannerId,
            results: toss(s.save, bannerId, week, count, systemClock.now()),
          };
        });
        scheduleAutosave();
      },

      closeTossOutcome() {
        set((s) => {
          s.tossOutcome = null;
        });
      },

      setPrefs(patch) {
        let next: Prefs | null = null;
        set((s) => {
          s.prefs = { ...s.prefs, ...patch };
          next = s.prefs;
        });
        if (next) {
          savePrefs(next);
          // The audio graph reads prefs directly so a slider is audible while
          // you are still dragging it, not one interaction later.
          setAudioPrefs(next);
        }
      },

      /**
       * Finish an `acknowledge` step, or step past a goal step the player has
       * already satisfied. Goal steps that are NOT yet satisfied ignore this —
       * the coach mark stays up until the deed is done.
       */
      onboardingAck() {
        set((s) => {
          if (!s.save) return;
          const step = currentOnboardingStep(s.save);
          if (!step) return;
          if (step.goal.kind === 'acknowledge' || stepSatisfied(s.save, step)) {
            advanceOnboarding(s.save);
          }
        });
        scheduleAutosave();
      },

      onboardingSkip() {
        set((s) => {
          if (s.save) skipOnboarding(s.save);
        });
        get().toast(t('ob.skipped'));
        scheduleAutosave();
      },

      dismissTour() {
        set((s) => {
          if (s.save && s.tourScreen) markTourSeen(s.save, s.tourScreen);
          s.tourScreen = null;
        });
        scheduleAutosave();
      },

      questsEnsureBoards() {
        // Effect-driven: fills any empty board on first visit of the period.
        set((s) => {
          if (!s.save || s.save.hero.level < QUESTS_UNLOCK_LEVEL) return;
          ensureQuestBoard(s.save, 'daily');
          ensureQuestBoard(s.save, 'weekly');
          ensureQuestBoard(s.save, 'monthly');
        });
        scheduleAutosave();
      },

      questClaim(questId) {
        set((s) => {
          if (!s.save) return;
          const quest = getQuest(questId);
          if (!canClaimQuest(s.save, quest)) return;
          const claim = claimQuest(s.save, questId, systemClock.now());
          s.metaReward = { titleKey: 'quests.claimed', reward: claim.reward };
        });
        scheduleAutosave();
      },

      questSwap(questId) {
        set((s) => {
          if (!s.save || !canSwapDaily(s.save, questId)) return;
          swapDaily(s.save, questId);
        });
        scheduleAutosave();
      },

      activityChestClaim() {
        set((s) => {
          if (!s.save || !canClaimActivityChest(s.save)) return;
          const reward = claimActivityChest(s.save, systemClock.now());
          s.metaReward = { titleKey: 'quests.chestOpened', reward };
        });
        scheduleAutosave();
      },

      storyClaim(chapter) {
        set((s) => {
          if (!s.save || !canClaimStep(s.save, chapter)) return;
          const claim = claimStep(s.save, chapter, systemClock.now());
          s.metaReward = {
            titleKey: claim.chapterComplete ? 'story.chapterDone' : 'story.stepDone',
            reward: claim.reward,
          };
        });
        scheduleAutosave();
      },

      achievementClaim(id) {
        let text: string | null = null;
        set((s) => {
          if (!s.save || !canClaimAchievement(s.save, id)) return;
          const claim = claimAchievement(s.save, id, systemClock.now());
          text = t('toast.achievement', {
            name: t(`achv.${claim.def.id}.name` as I18nKey),
            attrs: claim.attrGained,
          });
        });
        if (text) get().toast(text);
        scheduleAutosave();
      },

      achievementClaimAll() {
        let count = 0;
        let attrs = 0;
        set((s) => {
          if (!s.save) return;
          for (const claim of claimAllAchievements(s.save, systemClock.now())) {
            count += 1;
            attrs += claim.attrGained;
          }
        });
        if (count > 0) get().toast(t('toast.achievementAll', { n: count, attrs }));
        scheduleAutosave();
      },

      calendarClaim() {
        set((s) => {
          if (!s.save || !canClaimCalendar(s.save, systemClock.now())) return;
          const claim = claimCalendarDay(s.save, systemClock.now());
          s.metaReward = { titleKey: 'calendar.claimed', reward: claim.reward };
        });
        scheduleAutosave();
      },

      equipTitle(titleId) {
        set((s) => {
          if (!s.save) return;
          if (titleId !== null && !s.save.progress.titles.includes(titleId)) return;
          s.save.hero.titleId = titleId;
        });
        scheduleAutosave();
      },

      codexReadLore(monsterId) {
        set((s) => {
          if (s.save) readLore(s.save, monsterId);
        });
        scheduleAutosave();
      },

      closeMetaReward() {
        set((s) => {
          s.metaReward = null;
        });
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
          // First visit to a screen with something non-obvious to say (§17).
          // Never while the scripted sequence is still pointing — `tourDue`
          // enforces the one-finger rule.
          s.tourScreen = s.save && tourDue(s.save, screen) ? screen : null;
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
