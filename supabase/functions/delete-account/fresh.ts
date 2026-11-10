// Hardening V-11: deleting the account is irreversible, so it needs a RECENT sign-in, not just
// a valid session (a stolen or long-lived session alone must not be enough).
//
// Supabase access tokens carry `amr`: how and when the user actually authenticated
// ([{ method: 'otp' | 'oauth' | …, timestamp: <unix seconds> }]). Refreshing the session issues
// new tokens but keeps the original timestamps, so this is the time of the last real sign-in.
//
// Pure code with no Deno or npm imports: the Edge Function uses it, and the app imports this very
// file (src/core/data/deleteEverything.ts) to check before deleting anything, so the two can't
// disagree. Only read claims AFTER the token was verified (auth.getUser) — decoding is not proof.

/** How recent "recent" is. */
export const FRESH_SIGN_IN_SECONDS = 10 * 60;

/** The latest authentication time in an access token (unix seconds), or null. */
export function signedInAt(accessToken: string): number | null {
  const part = accessToken.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const claims = JSON.parse(atob(padded)) as { amr?: unknown };
    if (!Array.isArray(claims.amr)) return null;
    const times = claims.amr
      .map((m: unknown) => (m as { timestamp?: unknown } | null)?.timestamp)
      .filter((t): t is number => typeof t === 'number' && Number.isFinite(t));
    return times.length > 0 ? Math.max(...times) : null;
  } catch {
    return null;
  }
}

/** Did the user sign in within the last FRESH_SIGN_IN_SECONDS? (A time in the future is not.) */
export function isFreshSignIn(accessToken: string, nowSeconds: number): boolean {
  const at = signedInAt(accessToken);
  if (at === null) return false;
  const age = nowSeconds - at;
  return age >= -60 && age <= FRESH_SIGN_IN_SECONDS; // a minute of clock skew is fine
}
