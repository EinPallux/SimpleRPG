import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconId } from '../icons.gen';

interface EmptyStateProps {
  icon: IconId;
  title: string;
  body: string;
  action?: ReactNode;
}

/** Designed empty state — no screen ever shows a blank panel (UI_DESIGN.md §6). */
export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div
        className="frame-slot--gold panel-fill-inset flex h-16 w-16 items-center justify-center"
        style={{ ['--frame-w' as string]: '8px' }}
      >
        <Icon id={icon} size={32} className="text-gold" />
      </div>
      <h3 className="font-display text-lg font-semibold text-gold">{title}</h3>
      <p className="max-w-md text-sm leading-relaxed text-ink-muted">{body}</p>
      {action}
    </div>
  );
}
