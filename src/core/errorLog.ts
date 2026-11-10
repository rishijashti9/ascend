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

/**
 * Hardening V-15: the log is kept on the device and copied by hand when reporting a problem, so
 * it must never hold sign-in tokens, keys, one-time codes or email addresses — even if an
 * error message or a URL in a stack happens to contain one.
 */
const SCRUBS: [RegExp, string][] = [
  [/\beyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]+/g, '[token]'], // JWTs (access / refresh tokens)
  [/\bBearer\s+[\w.~+/=-]+/gi, 'Bearer [token]'],
  [/\bsb_(?:publishable|secret)_[\w-]+/g, '[key]'],
  [/\bsk-(?:or-v1|ant)-[\w-]+/g, '[key]'],
  [/([?&#](?:code|access_token|refresh_token|token|provider_token)=)[^&#\s]+/gi, '$1[redacted]'],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]'],
];

export function scrubSecrets(text: string): string {
  return SCRUBS.reduce((t, [re, to]) => t.replace(re, to), text);
}

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
    message: scrubSecrets(err.message),
    appVersion: APP_VERSION,
    ...(err.stack ? { stack: scrubSecrets(err.stack) } : {}),
    ...(context ? { context: scrubSecrets(context) } : {}),
  };
  try {
    const entries = [...read(), entry].slice(-MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Storage full or blocked: nothing more we can safely do.
  }
  // Scrubbed too: on Android the WebView's console goes to the system log (logcat).
  console.error(entry.context ? `[${entry.context}]` : '[error]', entry.stack ?? entry.message);
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
