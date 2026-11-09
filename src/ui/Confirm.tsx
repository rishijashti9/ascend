import type { ReactNode } from 'react';
import { Button } from './Button';

/**
 * An inline confirmation (Phase 12): an inset block that names what will happen, with the
 * confirm button first and a calm way out. `danger` (deleting or resetting for good) gives it the
 * theme's error outline and a red confirm button; otherwise it's a quiet inset with the primary
 * button. Rendered in place of the button that opened it, so nothing pops over the screen.
 */
export function Confirm({
  label,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  busy = false,
  danger = false,
  className = '',
}: {
  /** Accessible name of the confirmation, e.g. "Delete forever?". */
  label: string;
  /** What will happen, in one or two plain sentences (and any extra choices). */
  children: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  danger?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alertdialog"
      aria-label={label}
      className={`inset flex flex-col gap-3 p-4 ${danger ? 'outline-error outline-2' : ''} ${className}`}
    >
      <div className="flex flex-col gap-2 text-sm">{children}</div>
      <div className="flex flex-wrap gap-2">
        <Button variant={danger ? 'danger' : 'primary'} disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}
