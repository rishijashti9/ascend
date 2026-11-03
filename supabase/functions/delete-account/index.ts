// Supabase Edge Function (Deno): delete the signed-in user's account (SPEC 6.7 D).
// The service-role key is provided by Supabase inside functions and never reaches the app.
// Deleting the auth user also removes every sync_records row (foreign key: on delete cascade).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST')
    return new Response('Method not allowed', { status: 405, headers: cors });
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const auth = req.headers.get('Authorization') ?? '';
  // Who is asking — from their own sign-in token, never from the request body.
  const asUser = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data, error } = await asUser.auth.getUser();
  if (error || !data.user) return new Response('Not signed in', { status: 401, headers: cors });
  const admin = createClient(url, service);
  const del = await admin.auth.admin.deleteUser(data.user.id);
  if (del.error)
    return new Response('Could not delete the account', { status: 500, headers: cors });
  return new Response(JSON.stringify({ deleted: true }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
