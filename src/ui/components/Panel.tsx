import type { ReactNode } from 'react';

type PanelVariant = 'primary' | 'secondary' | 'special' | 'danger' | 'inset';

const FRAME_CLASS: Record<PanelVariant, string> = {
  primary: 'frame-primary',
  secondary: 'frame-secondary',
  special: 'frame-special',
  danger: 'frame-danger',
  inset: 'frame-secondary--muted',
};

interface PanelProps {
  variant?: PanelVariant;
  title?: string;
  headerRight?: ReactNode;
  className?: string;
  /** skip the entrance — for panels that re-render on a timer */
  still?: boolean;
  children: ReactNode;
}

/**
 * The workhorse container: tinted Kenney 9-slice frame + panel gradient fill.
 *
 * Panels rise into place. Since every screen is built out of these, one class
 * here is what stops a navigation from being an instantaneous cut — and because
 * screens usually render several, the parent's `.stagger` makes them arrive in
 * sequence for free. Opt out with `still` where a panel re-renders constantly
 * (a live timer would otherwise re-animate on every tick).
 */
export function Panel({
  variant = 'primary',
  title,
  headerRight,
  className = '',
  still = false,
  children,
}: PanelProps) {
  const fill = variant === 'inset' ? 'panel-fill-inset' : 'panel-fill';
  return (
    <section className={`${FRAME_CLASS[variant]} ${fill} ${still ? '' : 'rise-in'} ${className}`}>
      {(title || headerRight) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title ? (
            <h2 className="font-display text-lg font-semibold text-gold">{title}</h2>
          ) : (
            <span />
          )}
          {headerRight}
        </header>
      )}
      {children}
    </section>
  );
}
