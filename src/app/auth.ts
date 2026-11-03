import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { ANDROID_AUTH_REDIRECT } from '@/config/cloud';
import { logError } from '@/core/errorLog';
import { getSupabase } from '@/core/sync/client';
import { isNativeApp } from './platform';

/**
 * Sign-in (DECISIONS: email magic link + Google, no passwords).
 * Web: Supabase sends you back to /settings with ?code=…, which the client exchanges itself.
 * Android: Google refuses to sign in inside an app's WebView, so Google opens in the system
 * browser (Custom Tab); both it and the email link come back through the app link
 * `app.ascend.rishi://auth?code=…`, and the code is exchanged here.
 */
const webRedirect = () => `${window.location.origin}/settings`;
const redirectTo = () => (isNativeApp() ? ANDROID_AUTH_REDIRECT : webRedirect());

export class AuthError extends Error {}

function client() {
  const c = getSupabase();
  if (!c) throw new AuthError('Sign-in isn’t available in this version of the app.');
  return c;
}

export async function sendMagicLink(email: string): Promise<void> {
  const { error } = await client().auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirectTo(), shouldCreateUser: true },
  });
  if (error) {
    throw new AuthError(
      error.status === 429
        ? 'Too many sign-in emails — wait a minute and try again.'
        : 'Couldn’t send the email. Check the address and your connection.',
    );
  }
}

export async function signInWithGoogle(): Promise<void> {
  const c = client();
  if (!isNativeApp()) {
    const { error } = await c.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: webRedirect() },
    });
    if (error) throw new AuthError('Couldn’t open Google sign-in. Check your connection.');
    return; // the browser navigates to Google
  }
  const { data, error } = await c.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: ANDROID_AUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error || !data.url)
    throw new AuthError('Couldn’t open Google sign-in. Check your connection.');
  await Browser.open({ url: data.url, presentationStyle: 'popover' });
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut();
}

/** Android: finish a sign-in when the app is opened through app.ascend.rishi://auth. */
export async function completeAuthRedirect(url: string): Promise<string | null> {
  if (!url.startsWith(ANDROID_AUTH_REDIRECT)) return null;
  void Browser.close().catch(() => undefined);
  const params = new URL(url.replace(ANDROID_AUTH_REDIRECT, 'https://auth.invalid/')).searchParams;
  const failure = params.get('error_description');
  if (failure) return failure;
  const code = params.get('code');
  if (!code) return 'The sign-in link was incomplete. Please try again.';
  const { error } = await client().auth.exchangeCodeForSession(code);
  return error
    ? 'That sign-in link has expired or was opened on another device. Send a new one from this device.'
    : null;
}

/** Android: listen for the sign-in app link (call once at startup). */
export function startAuthRedirects(onResult: (message: string | null) => void): void {
  if (!isNativeApp()) return;
  void App.addListener('appUrlOpen', ({ url }) => {
    void completeAuthRedirect(url)
      .then((m) => {
        if (url.startsWith(ANDROID_AUTH_REDIRECT)) onResult(m);
      })
      .catch((error: unknown) => logError(error, 'auth.redirect'));
  });
}
