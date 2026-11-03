/**
 * The Supabase project used for sign-in and sync (Phase 7).
 *
 * Only the PUBLIC values live here: the project URL and the publishable (anon) key. They are
 * meant to be shipped inside apps — what a signed-in user may do is enforced by Row Level
 * Security on the server, not by hiding this key. The secret / service-role key is never used
 * by the app and must never be added to this repository.
 *
 * `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` override these (tests, other projects).
 */
const DEFAULT_URL = 'https://cyvrymsjizkpvtyqqflu.supabase.co'; // project "ascend", eu-west-1
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_xmDn62_QEpmhqDwNJQcKSA_ZCKePYY3';

export const SUPABASE_URL: string =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? DEFAULT_URL;
export const SUPABASE_PUBLISHABLE_KEY: string =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? DEFAULT_PUBLISHABLE_KEY;

/** Where sign-in links and Google send you back to in the Android app. */
export const ANDROID_AUTH_REDIRECT = 'app.ascend.rishi://auth';

export const cloudConfigured = (): boolean =>
  SUPABASE_URL !== '' && SUPABASE_PUBLISHABLE_KEY !== '';
