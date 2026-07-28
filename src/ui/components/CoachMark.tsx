/**
 * The onboarding spotlight (UI_DESIGN.md §4 `CoachMark`, GAME_DESIGN.md §17).
 *
 * The rule that shapes this component: **it never blocks input outside its own
 * anchor** (UI_DESIGN §5.3). A coach mark is a ring and a sentence, not a modal
 * cage — the player can ignore it, click anywhere, and carry on. That is why
 * there is no backdrop that swallows clicks and no focus trap: the only thing
 * pointer-interactive here is the card itself.
 *
 * Anchoring is by element id and re-measured on resize/scroll, so a mark
 * follows its target through a responsive reflow instead of pointing at where
 * the button used to be. An anchor that is not on screen degrades to a centred
 * card rather than a mark floating over nothing.
 */
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measure(anchorId: string | null): Rect | null {
  if (!anchorId) return null;
  const el = document.getElementById(anchorId);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export interface CoachMarkProps {
  anchorId: string | null;
  title: string;
  body: string;
  /** the primary button; omitted when the step completes by doing the thing */
  actionLabel?: string;
  onAction?: () => void;
  /** the always-present escape hatch (§17) */
  skipLabel: string;
  onSkip: () => void;
  /** e.g. "Step 2 of 6" */
  progress?: string;
  children?: ReactNode;
}

export function CoachMark({
  anchorId,
  title,
  body,
  actionLabel,
  onAction,
  skipLabel,
  onSkip,
  progress,
}: CoachMarkProps) {
  const [rect, setRect] = useState<Rect | null>(() => measure(anchorId));

  useLayoutEffect(() => {
    setRect(measure(anchorId));
  }, [anchorId]);

  useEffect(() => {
    if (!anchorId) return;
    const update = () => setRect(measure(anchorId));
    // Re-measure on anything that can move the target. `true` catches scrolls
    // inside panels, not just the window.
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    // The anchor may mount a frame after the mark does.
    const timer = window.setInterval(update, 500);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.clearInterval(timer);
    };
  }, [anchorId]);

  const pad = 6;
  const ring = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  // Card goes under the anchor when there is room, otherwise above it.
  const below = ring ? ring.top + ring.height + 12 : 0;
  const roomBelow = typeof window !== 'undefined' ? window.innerHeight - below > 190 : true;

  return (
    // pointer-events-none on the layer: everything under the mark stays live.
    <div className="pointer-events-none fixed inset-0 z-50" data-testid="coach-layer">
      {ring && (
        <div
          aria-hidden="true"
          className="absolute rounded-md border-2 border-gold-bright transition-all duration-200"
          style={{
            top: ring.top,
            left: ring.left,
            width: ring.width,
            height: ring.height,
            boxShadow: '0 0 0 9999px rgba(6, 10, 16, 0.55)',
          }}
        />
      )}
      <div
        role="dialog"
        aria-label={title}
        className="frame-special panel-fill pointer-events-auto absolute w-[min(22rem,calc(100vw-2rem))] p-4"
        style={
          ring
            ? {
                top: roomBelow ? below : Math.max(12, ring.top - 190),
                left: Math.min(
                  Math.max(12, ring.left),
                  Math.max(12, (typeof window !== 'undefined' ? window.innerWidth : 360) - 360),
                ),
              }
            : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
        }
      >
        {progress && (
          <p className="text-[10px] font-extrabold tracking-[0.16em] text-ink-faint uppercase">
            {progress}
          </p>
        )}
        <h2 className="mt-0.5 font-display text-lg font-bold text-gold-bright">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="frame-button px-3 py-1.5 text-sm font-bold text-ink"
            >
              {actionLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onSkip}
            className="ml-auto text-xs font-semibold text-ink-faint underline underline-offset-2 hover:text-ink-muted"
          >
            {skipLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
