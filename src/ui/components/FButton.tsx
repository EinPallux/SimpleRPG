import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { playSfx } from '../audio';

type ButtonVariant = 'primary' | 'quiet' | 'danger' | 'gem';

const FRAME: Record<ButtonVariant, string> = {
  primary: 'frame-button',
  quiet: 'frame-button--muted',
  danger: 'frame-button--danger',
  gem: 'frame-button--arcane',
};

const TEXT: Record<ButtonVariant, string> = {
  primary: 'text-gold-bright',
  quiet: 'text-ink-muted',
  danger: 'text-[#e08a7a]',
  gem: 'text-gem',
};

/** Each variant washes its own accent into the raised fill (styles/index.css). */
const FILL: Record<ButtonVariant, string> = {
  primary: 'btn-fill',
  quiet: 'btn-fill btn-fill--quiet',
  danger: 'btn-fill btn-fill--danger',
  gem: 'btn-fill btn-fill--gem',
};

interface FButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'lg' | 'sm';
  children: ReactNode;
}

/**
 * Framed button. Disabled buttons keep their frame but lose their shine.
 *
 * Every framed button in the game is a click surface, so `ui_click` lives here
 * once instead of in forty handlers. There is no `ui_deny` twin: the DOM never
 * delivers a click to a disabled button, so a refused press cannot be observed
 * from inside the component — that cue belongs to whoever refuses the action.
 */
export function FButton({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  onClick,
  ...rest
}: FButtonProps) {
  const pad =
    size === 'lg'
      ? 'px-6 py-3 text-base'
      : size === 'sm'
        ? 'px-3 py-1 text-xs'
        : 'px-4 py-2 text-sm';
  return (
    <button
      {...rest}
      onClick={(e) => {
        playSfx('ui_click');
        onClick?.(e);
      }}
      className={`${FRAME[variant]} ${FILL[variant]} ${TEXT[variant]} ${pad} btn-press inline-flex items-center justify-center gap-2 font-body font-bold tracking-wide disabled:opacity-50 disabled:saturate-50 ${className}`}
      style={{ ['--frame-w' as string]: '10px' }}
    >
      {children}
    </button>
  );
}
