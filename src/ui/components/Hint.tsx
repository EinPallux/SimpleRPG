import type { ReactElement, ReactNode } from 'react';
import { Tooltip } from './Tooltip';

/**
 * The shape every *small* tooltip in the game shares: a name, a sentence of
 * what the thing is, an optional table of the numbers behind it, and an
 * optional highlighted footnote for the one thing worth acting on.
 *
 * `ItemTooltip` and `StatTooltip` are hand-laid because their content is
 * genuinely bespoke. Everything else — a currency, a nav entry, a meter, a
 * button that refuses to be pressed — is this. Having one body means the
 * fifteenth explanation added to the game looks like the first, instead of
 * fifteen people's ideas of what a tooltip is.
 */
export function TipBody({
  title,
  body,
  rows,
  footer,
  note,
}: {
  title: ReactNode;
  body?: ReactNode;
  /** label → value pairs, rendered as a small right-aligned table */
  rows?: readonly (readonly [ReactNode, ReactNode])[] | undefined;
  /** quiet trailing context — provenance, a comparison, a caveat */
  footer?: ReactNode;
  /** the one line worth acting on: a block, a cost, a warning */
  note?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-display text-sm font-bold text-gold">{title}</div>
      {body && <p className="text-[11px] leading-relaxed text-ink-muted">{body}</p>}
      {rows && rows.length > 0 && (
        <ul className="space-y-0.5 border-t border-ink-faint/25 pt-1.5">
          {rows.map(([label, value], i) => (
            <li key={i} className="flex items-baseline justify-between gap-4 text-[11px]">
              <span className="text-ink-faint">{label}</span>
              <span className="font-bold text-ink">{value}</span>
            </li>
          ))}
        </ul>
      )}
      {footer && (
        <div className="border-t border-ink-faint/25 pt-1.5 text-[10px] leading-snug text-ink-faint">
          {footer}
        </div>
      )}
      {note && (
        <div className="rounded-sm bg-panel-inset px-2 py-1 text-[11px] leading-snug text-[#e0b45a]">
          {note}
        </div>
      )}
    </div>
  );
}

/**
 * `Tooltip` + `TipBody`, which is what almost every call site actually wants.
 *
 * Use this instead of a `title` attribute. A `title` is invisible to touch,
 * unreachable by keyboard, unstyleable, and arrives after a delay the page does
 * not control — four reasons a game that explains itself cannot be built on it.
 */
export function Hint({
  title,
  body,
  rows,
  footer,
  note,
  placement = 'auto',
  className = 'inline-flex',
  children,
}: {
  title: ReactNode;
  body?: ReactNode;
  rows?: readonly (readonly [ReactNode, ReactNode])[] | undefined;
  footer?: ReactNode;
  note?: ReactNode;
  placement?: 'auto' | 'top' | 'bottom';
  className?: string;
  children: ReactElement<{ 'aria-describedby'?: string | undefined }>;
}) {
  return (
    <Tooltip
      placement={placement}
      className={className}
      content={<TipBody title={title} body={body} rows={rows} footer={footer} note={note} />}
    >
      {children}
    </Tooltip>
  );
}
