import { APP_VERSION } from '@/app/version';

/**
 * Local crash log. Kept in localStorage (not IndexedDB) on purpose: it must keep
 * working even when the database is what failed. Holds the newest 100 entries.
 */
export interface ErrorLogEntry {
  at: string; // ISO timestamp
  message: string;
  stack?: string;
  context?: string;
  appVersion: string;
}

const KEY = 'ascend.errorLog';
const MAX_ENTRIES = 100;

function read(): ErrorLogEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ErrorLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function logError(error: unknown, context?: string): ErrorLogEntry {
  const err = error instanceof Error ? error : new Error(String(error));
  const entry: ErrorLogEntry = {
    at: new Date().toISOString(),
    message: err.message,
    appVersion: APP_VERSION,
    ...(err.stack ? { stack: err.stack } : {}),
    ...(context ? { context } : {}),
  };
  try {
    const entries = [...read(), entry].slice(-MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Storage full or blocked: nothing more we can safely do.
  }
  console.error(context ? `[${context}]` : '[error]', err);
  return entry;
}

export function getErrorLog(): ErrorLogEntry[] {
  return read();
}

export function clearErrorLog(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Plain-text report for copying (newest first). */
export function formatErrorLog(entries: ErrorLogEntry[] = read()): string {
  return [...entries]
    .reverse()
    .map((e) =>
      [`${e.at}  v${e.appVersion}${e.context ? `  (${e.context})` : ''}`, e.message, e.stack ?? '']
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
}

/** Catches errors that happen outside React rendering. Call once at startup. */
export function installGlobalErrorHandlers(): void {
  window.addEventListener('error', (event) => logError(event.error ?? event.message, 'window'));
  window.addEventListener('unhandledrejection', (event) =>
    logError(event.reason, 'unhandledrejection'),
  );
}
