// Supabase Edge Function (Deno): delete the signed-in user's account (SPEC 6.7 D).
// The service-role key is provided by Supabase inside functions and never reaches the app.
// Deleting the auth user also removes every sync_records row (foreign key: on delete cascade).
// Needs a sign-in from the last 10 minutes (hardening V-11, see fresh.ts).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { isFreshSignIn } from './fresh.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const auth = req.headers.get('Authorization') ?? '';
  // Who is asking — from their own sign-in token, never from the request body.
  const asUser = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data, error } = await asUser.auth.getUser();
  if (error || !data.user) return json({ error: 'signed_out' }, 401);
  // The token is verified above; now its sign-in time may be trusted.
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!isFreshSignIn(token, Math.floor(Date.now() / 1000))) return json({ error: 'reauth' }, 403);
  const admin = createClient(url, service);
  const del = await admin.auth.admin.deleteUser(data.user.id);
  if (del.error) {
    console.error(`delete-account: failed status=${del.error.status ?? '?'}`);
    return json({ error: 'failed' }, 500);
  }
  return json({ deleted: true });
});
