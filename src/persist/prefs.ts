/**
 * Device preferences (UI_DESIGN.md §7/§8, screen 23).
 *
 * These live in localStorage rather than in the save, and that is a deliberate
 * split: a save is a HERO, a pref is a DEVICE. Muting the game on the office
 * laptop should not follow you home, and it certainly should not travel inside
 * an exported save code. It also means prefs survive "delete every slot" and
 * apply on the title screen, before any save is loaded.
 *
 * Invariant 1 still holds: nothing here leaves the machine.
 */

export type TimerFormat = 'relative' | 'absolute';

export interface Prefs {
  /** 0..1 — UI_DESIGN §7 defaults: master 70%, music 40% */
  volMaster: number;
  volMusic: number;
  volSfx: number;
  muted: boolean;
  /**
   * `null` follows the OS (`prefers-reduced-motion`), which is the honest
   * default; `true`/`false` is an explicit override the player chose.
   */
  reducedMotion: boolean | null;
  /** skip combat playback and jump straight to the result */
  instantCombat: boolean;
  timerFormat: TimerFormat;
  /** the PWA install nudge has been shown once and should not nag again */
  installPromptSeen: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  volMaster: 0.7,
  volMusic: 0.4,
  volSfx: 0.7,
  muted: false,
  reducedMotion: null,
  instantCombat: false,
  timerFormat: 'relative',
  installPromptSeen: false,
};

const KEY = 'simplerpg.prefs.v1';

function clamp01(n: unknown, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

function bool(n: unknown, fallback: boolean): boolean {
  return typeof n === 'boolean' ? n : fallback;
}

/**
 * Read prefs, healing anything malformed back to its default rather than
 * throwing. A corrupt pref must never be able to stop the game from starting —
 * it is a volume slider, not a save.
 */
export function loadPrefs(): Prefs {
  let raw: Record<string, unknown> = {};
  try {
    raw = (JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '{}') ?? {}) as Record<
      string,
      unknown
    >;
  } catch {
    raw = {};
  }
  return {
    volMaster: clamp01(raw.volMaster, DEFAULT_PREFS.volMaster),
    volMusic: clamp01(raw.volMusic, DEFAULT_PREFS.volMusic),
    volSfx: clamp01(raw.volSfx, DEFAULT_PREFS.volSfx),
    muted: bool(raw.muted, DEFAULT_PREFS.muted),
    reducedMotion:
      raw.reducedMotion === true || raw.reducedMotion === false ? raw.reducedMotion : null,
    instantCombat: bool(raw.instantCombat, DEFAULT_PREFS.instantCombat),
    timerFormat: raw.timerFormat === 'absolute' ? 'absolute' : 'relative',
    installPromptSeen: bool(raw.installPromptSeen, DEFAULT_PREFS.installPromptSeen),
  };
}

export function savePrefs(prefs: Prefs): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Private mode, quota, a hostile embed — none of it is worth a crash.
  }
}

/**
 * Should motion be suppressed? The explicit pref wins; otherwise ask the OS.
 * Called by the motion tokens and by every animated component.
 */
export function motionReduced(prefs: Prefs): boolean {
  if (prefs.reducedMotion !== null) return prefs.reducedMotion;
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
