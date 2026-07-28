import { EMBLEM_PALETTES } from '@/content/emblems';
import { getClass } from '@/content/classes';
import type { ClassId, EmblemSpec } from '@/engine/types';
import { Icon } from './Icon';
import type { IconId } from '../icons.gen';
import { ICON_IDS } from '../icons.gen';

interface EmblemAvatarProps {
  emblem: EmblemSpec;
  classId: ClassId;
  size?: number;
  className?: string;
}

/** Procedural portrait: palette gradient + icon, framed in class color (9-slice). */
export function EmblemAvatar({ emblem, classId, size = 48, className = '' }: EmblemAvatarProps) {
  const palette = EMBLEM_PALETTES[emblem.palette] ?? EMBLEM_PALETTES[0]!;
  const iconId = (ICON_IDS as readonly string[]).includes(emblem.icon)
    ? (emblem.icon as IconId)
    : 'star';
  const cls = getClass(classId);
  return (
    <div
      className={`frame-slot--${classId} relative flex shrink-0 items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        ['--frame-w' as string]: `${Math.max(6, Math.round(size / 8))}px`,
        backgroundImage: `radial-gradient(120% 120% at 30% 20%, ${palette.from} 0%, ${palette.to} 100%)`,
        backgroundClip: 'padding-box',
      }}
    >
      <Icon
        id={iconId}
        size={Math.round(size * 0.56)}
        className="text-ink drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]"
      />
      <span className="sr-only">{cls.id}</span>
    </div>
  );
}
