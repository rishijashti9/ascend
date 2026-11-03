import { useEffect, useRef } from 'react';

/**
 * Keyboard basics for a full-screen dialog (SPEC 8, task 10.5): focus moves to its close button
 * when it opens, Escape closes it, and focus goes back where it was when it closes.
 */
export function useDialog<T extends HTMLElement = HTMLButtonElement>(onClose: () => void) {
  const closeRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (before?.isConnected) before.focus();
    };
  }, []);

  return closeRef;
}
