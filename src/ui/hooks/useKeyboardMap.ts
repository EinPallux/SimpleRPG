/**
 * The global keyboard map (UI_DESIGN.md §8): `1`–`9` jump to the first nine
 * unlocked rail entries, `Esc` closes the topmost overlay. Mounted once by the
 * Shell.
 *
 * Three rules keep it out of everyone else's way.
 *
 * A key pressed into a field belongs to the field — the create dialog's name
 * box and the import textarea both take digits, and a quick-nav that stole them
 * would be worse than no quick-nav at all.
 *
 * A real modal dialog owns its own Escape (`components/Modal.tsx`, and the
 * combat theater). While one is on screen it IS the topmost overlay, so the map
 * stands down rather than racing it: otherwise a single press would close the
 * dialog *and* dismiss whatever was sitting behind it.
 *
 * And it reads the store through `getState()` instead of selecting, because
 * nothing here renders — a hook that re-subscribed on every timer tick would
 * rebind its listener a few times a second for no gain.
 */
import { useEffect } from 'react';
import { useGame, type ScreenId } from '@/state/store';
import { NAV_GROUPS } from '../nav';

type GameState = ReturnType<typeof useGame.getState>;

/**
 * The overlays this map is answerable for, topmost first.
 *
 * Everything that renders as `aria-modal` is deliberately absent: the guard
 * below stands down entirely while one is open, because those own their own
 * Escape handling (Modal.tsx, CombatPlayback.tsx).
 *
 * Deliberately absent for a different reason: `wheelOutcome` and `expedOutcome`.
 * Both render as INLINE result panels inside their screen, not as overlays —
 * so closing them on Escape does not dismiss something covering the game, it
 * silently throws away a result the player may not have read yet. Escape is for
 * "get this out of my way", and an inline panel is not in the way.
 */
const OVERLAYS: readonly {
  open: (s: GameState) => boolean;
  close: (s: GameState) => void;
}[] = [{ open: (s) => s.tourScreen !== null, close: (s) => s.dismissTour() }];

/** Is this keystroke part of something the player is writing? */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

/**
 * The doors a digit can open: rail order (UI_DESIGN §5), locked entries skipped.
 * Numbering the *unlocked* ones costs a stable map — 3 moves house as the town
 * opens up — and buys a keyboard where no digit is ever a dead key, which is the
 * half of that trade a player actually notices.
 */
function reachable(level: number): ScreenId[] {
  return NAV_GROUPS.flatMap((group) => group.entries)
    .filter((entry) => level >= entry.unlockLevel)
    .slice(0, 9)
    .map((entry) => entry.screen);
}

export function useKeyboardMap(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Modified keys and auto-repeat belong to the browser and to held-down
      // fingers respectively; neither means "take me to the Forge".
      if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
      if (typing(e.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;

      const state = useGame.getState();

      if (e.key === 'Escape') {
        const overlay = OVERLAYS.find((candidate) => candidate.open(state));
        if (!overlay) return;
        e.preventDefault();
        overlay.close(state);
        return;
      }

      if (!/^[1-9]$/.test(e.key)) return;
      const screen = reachable(state.save?.hero.level ?? 1)[Number(e.key) - 1];
      if (!screen) return;
      e.preventDefault();
      state.setScreen(screen);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
