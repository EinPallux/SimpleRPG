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
  label?: string;
  className?: string;
  title?: string;
}

export function ProgressBar({
  variant,
  value,
  max,
  label,
  className = '',
  title,
}: ProgressBarProps) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={`relative h-4 overflow-hidden rounded-sm border border-black/40 bg-panel-inset ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-label={label ?? variant}
      title={title}
    >
      <div
        className="h-full transition-[width] duration-(--motion-base)"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(180deg, color-mix(in srgb, ${COLOR[variant]} 100%, white 18%) 0%, ${COLOR[variant]} 55%, color-mix(in srgb, ${COLOR[variant]} 78%, black) 100%)`,
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
