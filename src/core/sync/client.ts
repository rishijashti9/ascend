import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cloudConfigured, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/config/cloud';

/**
 * The Supabase client (sign-in + sync), created on first use. Null when this build has no
 * project configured — then the app simply stays local-only.
 */
let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  client = cloudConfigured()
    ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: true,
          // Web: the sign-in link / Google come back to the app with ?code=… — handled here.
          detectSessionInUrl: true,
          storageKey: 'ascend.auth',
        },
      })
    : null;
  return client;
}

/** Tests: use a fake client (or reset with undefined). */
export function setSupabase(c: SupabaseClient | null | undefined): void {
  client = c;
}
