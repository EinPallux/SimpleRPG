import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

/**
 * The tooltip primitive.
 *
 * Rules it exists to keep, all of which a `title` attribute breaks:
 *
 *  - **Keyboard reaches it.** Focus opens it, blur and Escape close it. A
 *    tooltip only a mouse can summon is information keyboard users simply do
 *    not have.
 *  - **Touch reaches it.** Phones have no hover, so a long press opens it and
 *    the next tap anywhere closes it — without that, every explanation in the
 *    game would be desktop-only.
 *  - **It escapes its container.** Rendered in a portal and positioned in
 *    viewport coordinates, so a panel with `overflow: hidden` cannot clip it.
 *  - **It stays on screen.** Flips above/below by available room and clamps
 *    horizontally, which matters most at 375 px where "just put it to the
 *    right" is not available.
 *  - **Screen readers get it.** `role="tooltip"` wired to the trigger through
 *    `aria-describedby`, so the content is announced rather than merely drawn.
 *
 * Content is a ReactNode, not a string: the interesting tooltips in this game
 * are item cards and stat breakdowns, not one-liners.
 */
export function Tooltip({
  content,
  children,
  placement = 'auto',
  delayMs = 120,
  className = 'inline-flex',
}: {
  content: ReactNode;
  children: ReactElement<{ 'aria-describedby'?: string | undefined }>;
  /** 'auto' picks by available room; the rest force a side */
  placement?: 'auto' | 'top' | 'bottom';
  delayMs?: number;
  /**
   * Layout classes for the anchor. The anchor is a real element in the flow, so
   * a trigger that was `w-full` or `flex-1` before being wrapped needs the
   * wrapper to carry that too — otherwise adding an explanation silently
   * reflows the thing it explains.
   */
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const hide = useCallback(() => {
    cancel();
    setOpen(false);
  }, [cancel]);

  const show = useCallback(
    (immediate = false) => {
      cancel();
      const run = () => setOpen(true);
      if (immediate || delayMs <= 0) run();
      else timer.current = setTimeout(run, delayMs);
    },
    [cancel, delayMs],
  );

  useEffect(() => cancel, [cancel]);

  // Measure AFTER the bubble exists, so the flip decision knows its real height.
  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const trigger = anchor.current?.getBoundingClientRect();
    const box = bubble.current?.getBoundingClientRect();
    if (!trigger) return;
    const height = box?.height ?? 0;
    const width = box?.width ?? 0;
    const GAP = 8;
    const roomAbove = trigger.top;
    const below =
      placement === 'bottom' ||
      (placement === 'auto' &&
        roomAbove < height + GAP &&
        window.innerHeight - trigger.bottom > roomAbove);
    const top = below ? trigger.bottom + GAP : trigger.top - height - GAP;
    const ideal = trigger.left + trigger.width / 2 - width / 2;
    const left = Math.max(8, Math.min(ideal, window.innerWidth - width - 8));
    setPos({ left, top: Math.max(8, top), below });
  }, [open, placement, content]);

  // Escape closes, and so does anything that moves the page under it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [open, hide]);

  return (
    <>
      <span
        ref={anchor}
        className={className}
        onPointerEnter={(e) => {
          if (e.pointerType !== 'touch') show();
        }}
        onPointerLeave={hide}
        onFocusCapture={() => show(true)}
        onBlurCapture={hide}
        // Touch has no hover: a long press stands in for it, and the tap that
        // follows anywhere else dismisses (the portal is not a child, so a tap
        // on the page cannot be swallowed by the bubble).
        onTouchStart={() => show()}
        onTouchEnd={hide}
        onTouchCancel={hide}
      >
        {cloneElement(children, open ? { 'aria-describedby': id } : {})}
      </span>
      {open &&
        createPortal(
          <div
            ref={bubble}
            id={id}
            role="tooltip"
            className="frame-secondary panel-fill pointer-events-none fixed z-[60] max-w-[min(20rem,calc(100vw-1rem))] p-2.5 text-left pop-in"
            style={{
              left: pos?.left ?? -9999,
              top: pos?.top ?? -9999,
              visibility: pos ? 'visible' : 'hidden',
              ['--frame-w' as string]: '10px',
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
