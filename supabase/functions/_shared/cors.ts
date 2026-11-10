// Hardening V-12: the Edge Functions answered every origin (`Access-Control-Allow-Origin: *`).
// Now only ASCEND's own origins get CORS headers, so other websites' scripts can't call them
// from a visitor's browser. (CORS is browser-side defence in depth — the real protection is the
// user's verified token, which every function still checks.)
//
// Pure code with no Deno or npm imports, so the app's tests can check it too.

/** Where ASCEND runs: the web app, the Android app (Capacitor's https://localhost), local dev. */
export const ALLOWED_ORIGINS: readonly string[] = [
  'https://ascend-vert-mu.vercel.app',
  'https://localhost',
  'http://localhost:5173',
  'http://localhost:4173',
];

/** CORS headers for a request from `origin` (none of the allow headers for a stranger). */
export function corsHeaders(origin: string | null): Record<string, string> {
  const base: Record<string, string> = { Vary: 'Origin' };
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return base;
  return {
    ...base,
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}
