/**
 * Global game store (TECHNICAL_ARCHITECTURE.md §3): zustand + immer, one store,
 * all mutations via named actions that call engine functions and schedule
 * persistence. Components never mutate state directly.
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createNewSave, deriveEmblem } from '@/engine/newSave';
import { systemClock } from '@/engine/clock';
import type { ClassId, EmblemSpec, GameSave, SlotSummary } from '@/engine/types';
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

  bootstrap(): Promise<void>;
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
        save.lastSeenAt = new Date(systemClock.now()).toISOString();
        await persistSlot(slot, save);
        await setActiveSlot(slot);
        set((s) => {
          s.save = save;
          s.activeSlot = slot;
          s.lastActiveSlot = slot;
          s.phase = 'ingame';
          s.screen = 'tavern';
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

/** Flush pending writes when the tab hides — the classic browser-game lifesaver. */
export function attachLifecyclePersistence(): () => void {
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') void useGame.getState().saveNow();
  };
  document.addEventListener('visibilitychange', onVisibility);
  return () => document.removeEventListener('visibilitychange', onVisibility);
}
