import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A modal sheet (Phase 12): `full` covers the screen (planner, skill detail, photo viewer);
 * `bottom` rises from the bottom over a scrim (Ask). Escape and the close button close it; focus
 * moves into it and returns afterwards; the page behind doesn't scroll.
 */
export function Sheet({
  open = true,
  onClose,
  titleId,
  variant = 'full',
  children,
  closeLabel = 'Close',
}: {
  open?: boolean;
  onClose: () => void;
  titleId: string;
  variant?: 'full' | 'bottom';
  children: ReactNode;
  closeLabel?: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const close = (
    <button
      ref={closeRef}
      type="button"
      aria-label={closeLabel}
      onClick={onClose}
      className="bg-surface-2 text-text grid size-11 shrink-0 place-items-center rounded-full"
    >
      <X aria-hidden size={20} />
    </button>
  );

  if (variant === 'bottom') {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          className="bg-bg/70 absolute inset-0 cursor-default"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="bg-surface shadow-overlay animate-sheet-up relative flex max-h-[85dvh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-t-lg p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex justify-end">{close}</div>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="bg-bg fixed inset-0 z-40 overflow-y-auto"
    >
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-5 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="flex justify-end">{close}</div>
        {children}
      </div>
    </div>
  );
}
