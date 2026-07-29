type BarVariant = 'xp' | 'vigor' | 'hp';

const COLOR: Record<BarVariant, string> = {
  xp: 'var(--xp)',
  vigor: 'var(--vigor)',
  hp: 'var(--hp)',
};

interface ProgressBarProps {
  variant: BarVariant;
  value: number;
  max: number;
  /** text drawn INSIDE the bar; pass '' for a bare bar */
  label?: string;
  /**
   * The accessible name, when the visible `label` is not one. A bar labelled
   * `""` (bare) or `"100"` (the raw value) has no usable name of its own, and
   * an unnamed `role="progressbar"` is a serious axe finding — this is the
   * separation between what is drawn and what is announced.
   */
  name?: string;
  className?: string;
  title?: string;
  /**
   * Take a tab stop. A meter is not a control, so it is not focusable by
   * default — but a meter wrapped in a `Hint` is the trigger for an explanation,
   * and an explanation only a mouse can reach is not one.
   */
  tabbable?: boolean;
  'aria-describedby'?: string | undefined;
}

export function ProgressBar({
  variant,
  value,
  max,
  label,
  name,
  className = '',
  title,
  tabbable = false,
  'aria-describedby': describedBy,
}: ProgressBarProps) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={`meter-track relative h-4 overflow-hidden rounded-sm ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-label={name ?? (label || variant)}
      aria-describedby={describedBy}
      tabIndex={tabbable ? 0 : undefined}
      title={title}
    >
      <div
        className="meter-fill relative h-full transition-[width] duration-(--motion-slow) ease-(--ease-out-quart)"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(180deg, color-mix(in srgb, ${COLOR[variant]} 100%, white 18%) 0%, ${COLOR[variant]} 55%, color-mix(in srgb, ${COLOR[variant]} 78%, black) 100%)`,
          boxShadow: pct > 0 ? `0 0 10px -2px ${COLOR[variant]}` : undefined,
        }}
      />
      {label && (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold tracking-wide text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,.8)]">
          {label}
        </span>
      )}
    </div>
  );
}
