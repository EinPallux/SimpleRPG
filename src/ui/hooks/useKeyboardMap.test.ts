/**
 * The global keyboard map (UI_DESIGN.md §8) ships a `window` keydown listener
 * that sees every keystroke in the game, so the interesting assertions are all
 * about what it must NOT do: never steal a digit from a text field, never fight
 * a modal for Escape, never react to a browser shortcut.
 *
 * These were written after review pointed out the hook was live in the Shell
 * with no coverage at all — the typing guard in particular is the difference
 * between a working hero-name field and one that teleports you to the Forge.
 */
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAV_GROUPS } from '@/ui/nav';
import { useGame } from '@/state/store';
import { useKeyboardMap } from './useKeyboardMap';

function press(key: string, init: KeyboardEventInit = {}, target?: EventTarget) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  (target ?? window).dispatchEvent(event);
  return event;
}

/** The screens a hero of `level` can reach, in the order the map numbers them. */
function reachable(level: number): string[] {
  return NAV_GROUPS.flatMap((g) => g.entries)
    .filter((e) => level >= e.unlockLevel)
    .slice(0, 9)
    .map((e) => e.screen);
}

const setScreen = vi.fn();
const dismissTour = vi.fn();

/**
 * Mount the hook and guarantee it is torn down.
 *
 * The listener lives on `window`, which is shared across the whole file — a
 * hook left mounted keeps answering keystrokes in every later test, and the
 * symptom (one Escape dismissing a tour four times) looks like a bug in the
 * hook rather than in the test.
 */
let mounted: { unmount: () => void }[] = [];
function mount() {
  const handle = renderHook(() => useKeyboardMap());
  mounted.push(handle);
  return handle;
}

beforeEach(() => {
  setScreen.mockClear();
  dismissTour.mockClear();
  // The hook reads the live store, so stub only the surface it touches.
  vi.spyOn(useGame, 'getState').mockReturnValue({
    save: { hero: { level: 1 } },
    tourScreen: null,
    setScreen,
    dismissTour,
  } as unknown as ReturnType<typeof useGame.getState>);
});

afterEach(() => {
  for (const handle of mounted) handle.unmount();
  mounted = [];
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function withLevel(level: number, tourScreen: string | null = null) {
  vi.spyOn(useGame, 'getState').mockReturnValue({
    save: { hero: { level } },
    tourScreen,
    setScreen,
    dismissTour,
  } as unknown as ReturnType<typeof useGame.getState>);
}

describe('digit navigation', () => {
  it('numbers the unlocked nav entries 1..9 and jumps to them', () => {
    withLevel(100); // everything open
    mount();
    const screens = reachable(100);

    press('1');
    expect(setScreen).toHaveBeenCalledWith(screens[0]);

    press('5');
    expect(setScreen).toHaveBeenLastCalledWith(screens[4]);
  });

  it('renumbers as things unlock, rather than pointing at a locked screen', () => {
    withLevel(1); // a brand new hero has only a couple of entries
    mount();
    const open = reachable(1);

    press('1');
    expect(setScreen).toHaveBeenCalledWith(open[0]);

    // A digit past the unlocked count is not a silent mis-navigation.
    setScreen.mockClear();
    press('9');
    expect(open.length).toBeLessThan(9);
    expect(setScreen).not.toHaveBeenCalled();
  });
});

describe('it stays out of the way', () => {
  it.each([
    ['input', () => document.createElement('input')],
    ['textarea', () => document.createElement('textarea')],
    ['select', () => document.createElement('select')],
  ])('ignores digits typed into a %s', (_label, make) => {
    withLevel(100);
    mount();
    const el = make();
    document.body.append(el);

    press('3', {}, el);
    // The regression this guards: naming a hero "Grimble3" must not navigate.
    expect(setScreen).not.toHaveBeenCalled();
  });

  it('ignores digits inside a contenteditable', () => {
    withLevel(100);
    mount();
    const el = document.createElement('div');
    el.contentEditable = 'true';
    // jsdom does not implement isContentEditable from the attribute alone.
    Object.defineProperty(el, 'isContentEditable', { value: true });
    document.body.append(el);

    press('3', {}, el);
    expect(setScreen).not.toHaveBeenCalled();
  });

  it('leaves browser and OS shortcuts alone, and ignores auto-repeat', () => {
    withLevel(100);
    mount();

    press('1', { ctrlKey: true });
    press('1', { metaKey: true }); // Cmd-1 is "first tab", not "first screen"
    press('1', { altKey: true });
    press('1', { repeat: true }); // a held-down finger is one intent, not forty
    expect(setScreen).not.toHaveBeenCalled();
  });

  it('stands down entirely while a modal is open', () => {
    withLevel(100, 'wheel');
    mount();
    const modal = document.createElement('div');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    document.body.append(modal);

    press('2');
    press('Escape');
    // A modal owns its own Escape (Modal.tsx, CombatPlayback.tsx); two handlers
    // racing for one keystroke is how an overlay closes something behind it.
    expect(setScreen).not.toHaveBeenCalled();
    expect(dismissTour).not.toHaveBeenCalled();
  });
});

describe('Escape', () => {
  it('dismisses an open tour', () => {
    withLevel(100, 'wheel');
    mount();

    const event = press('Escape');
    expect(dismissTour).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does nothing — and does not swallow the key — when nothing is open', () => {
    withLevel(100, null);
    mount();

    const event = press('Escape');
    expect(dismissTour).not.toHaveBeenCalled();
    // Not preventing default matters: the browser may still want Escape.
    expect(event.defaultPrevented).toBe(false);
  });
});

it('unhooks the listener on unmount', () => {
  withLevel(100);
  const { unmount } = mount();
  unmount();

  press('1');
  expect(setScreen).not.toHaveBeenCalled();
});
