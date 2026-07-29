/**
 * The install offer, caught before React exists.
 *
 * `beforeinstallprompt` fires when the browser decides the site qualifies —
 * and on a returning visit, with the service worker already installed and the
 * engagement score banked, Chrome fires it within a few hundred milliseconds of
 * load. That races the Dexie open that gates the whole app tree, and losing the
 * race is worse than missing a card: the event is never `preventDefault()`ed,
 * so the browser shows its own mini-infobar — the exact thing the nudge exists
 * to replace.
 *
 * So the listener is installed at module scope from `main.tsx`, before the
 * first render, and the event is parked here for whichever component wants it.
 */

/** Not in lib.dom: Chromium's own extension to the install flow. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

let offer: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(e: BeforeInstallPromptEvent) => void>();

/** Called once from main.tsx, before React renders. */
export function captureInstallOffer(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    offer = e as BeforeInstallPromptEvent;
    for (const listener of listeners) listener(offer);
  });
}

/** The offer if it has already arrived — components mount long after it might. */
export function currentInstallOffer(): BeforeInstallPromptEvent | null {
  return offer;
}

/** Subscribe for the case where the component mounted first. */
export function onInstallOffer(listener: (e: BeforeInstallPromptEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Spent — an offer can only be prompted once. */
export function clearInstallOffer(): void {
  offer = null;
}
