import { useGame } from '@/state/store';

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
    >
      {toasts.map((toast) => (
        <button
          key={toast.id}
          onClick={() => dismiss(toast.id)}
          className="toast-enter pointer-events-auto frame-secondary panel-fill max-w-md px-4 py-2 text-sm font-semibold text-ink shadow-lg"
          style={{ ['--frame-w' as string]: '10px' }}
        >
          {toast.text}
        </button>
      ))}
    </div>
  );
}
