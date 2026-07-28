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
  children: ReactNode;
}

/** The workhorse container: tinted Kenney 9-slice frame + panel gradient fill. */
export function Panel({
  variant = 'primary',
  title,
  headerRight,
  className = '',
  children,
}: PanelProps) {
  const fill = variant === 'inset' ? 'panel-fill-inset' : 'panel-fill';
  return (
    <section className={`${FRAME_CLASS[variant]} ${fill} ${className}`}>
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
