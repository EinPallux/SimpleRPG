import type { IconId } from '../icons.gen';

interface IconProps {
  id: IconId;
  size?: number;
  className?: string;
  label?: string;
}

/** Sprite-backed icon (game-icons.net set, tinted via currentColor). */
export function Icon({ id, size = 20, className, label }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
    >
      <use href={`/assets/icons.svg#i-${id}`} />
    </svg>
  );
}
