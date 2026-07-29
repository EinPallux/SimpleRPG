import { useEffect, useRef, type ReactNode } from 'react';
import { t } from '@/i18n';
import { Icon } from './Icon';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  variant?: 'primary' | 'danger';
  wide?: boolean;
}

export function Modal({ title, onClose, children, variant = 'primary', wide = false }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${variant === 'danger' ? 'frame-danger' : 'frame-primary'} panel-fill max-h-[90dvh] w-full overflow-y-auto p-5 outline-none ${wide ? 'max-w-2xl' : 'max-w-md'} pop-in`}
      >
        <header className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-semibold text-gold">{title}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="text-ink-muted transition-colors hover:text-ink"
          >
            <Icon id="close" size={18} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
