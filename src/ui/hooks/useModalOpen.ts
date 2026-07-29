/**
 * Is a real modal currently on screen?
 *
 * The guidance layers (coach marks, contextual tours) must stand down while one
 * is: a reward reveal, a combat playback or the Settings sheet is a moment the
 * player asked for, and pointing at the Character screen over the top of it is
 * both rude and — since both layers sit at the same z-index — literally in the
 * way of the button they are covering.
 *
 * Detected from the DOM rather than from the store because "a modal is open" is
 * a rendering fact spread across a dozen store fields, and every modal in the
 * codebase already announces itself the same way for accessibility. That makes
 * `aria-modal` the one honest source of truth, and it stays correct when the
 * next modal is added without anyone remembering to update a list.
 */
import { useEffect, useState } from 'react';

const SELECTOR = '[role="dialog"][aria-modal="true"]';

export function useModalOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const check = () => setOpen(document.querySelector(SELECTOR) !== null);
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'aria-modal'],
    });
    return () => observer.disconnect();
  }, []);

  return open;
}
