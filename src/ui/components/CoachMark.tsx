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
 * the button used to be. An anchor that is not on screen drops the ring and
 * docks the card out of the way, rather than pointing at nothing.
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
  /**
   * 'centre' is for the narrative beats that ARE the moment (the cold open,
   * the town reveal) — they own the screen for one click. Everything else
   * docks, so the card is never between the player and the game.
   */
  placement?: 'centre' | 'dock';
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
  placement = 'dock',
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

  /**
   * The card is pinned to whichever half of the viewport the anchor is NOT in.
   *
   * The obvious placement — "just under the target" — is wrong here: most steps
   * ring something the player has to CLICK, and an adjacent card next to a tall
   * element (the three-wide offer grid, the attribute rows) lands on top of it.
   * A coach mark that covers the button it is pointing at is worse than no
   * coach mark, so the card always retreats to the opposite side instead.
   */
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
  /**
   * With a ring: sit in the half the anchor is not in.
   *
   * WITHOUT a ring (the target is on another screen, or has not mounted): dock
   * to the TOP. The bottom of a screen is where the primary actions live — the
   * tavern's Second Wind and patrol buttons, the mobile tab bar — and a card
   * parked there is exactly the "blocks input" failure this component's own
   * docblock rules out. The top is titles and meters, which nobody clicks.
   */
  const dockBottom = ring !== null && ring.top + ring.height / 2 < viewportH / 2;

  /**
   * Centring is opt-in, and only the caller knows when it is right.
   *
   * Two things used to force it by accident: a step whose anchor is momentarily
   * off screen (`first-mission` rings the offer grid, which is replaced by the
   * active-mission panel the instant the player accepts), and a step that is
   * pointing at a DIFFERENT screen. Both would park the card dead centre, over
   * whatever the player was about to click — the Collect button and the Second
   * Wind button respectively. Neither is a moment; both dock.
   */
  const centred = placement === 'centre';

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
          centred
            ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
            : dockBottom
              ? { bottom: 16, left: '50%', transform: 'translateX(-50%)' }
              : { top: 16, left: '50%', transform: 'translateX(-50%)' }
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
