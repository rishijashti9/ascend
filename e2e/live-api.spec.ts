import { expect, test } from '@playwright/test';

/**
 * Security regression checks against the LIVE Supabase project (hardening Phases 2–7), run after
 * every server deploy: `LIVE_API=1 npx playwright test e2e/live-api.spec.ts --project=laptop`.
 * Read-only and anonymous — only the public publishable key; it creates and changes nothing.
 * Skipped in the normal suite so everyday test runs never touch production.
 */
test.skip(!process.env.LIVE_API, 'set LIVE_API=1 to check the live server');

const URL = 'https://cyvrymsjizkpvtyqqflu.supabase.co';
const KEY = 'sb_publishable_xmDn62_QEpmhqDwNJQcKSA_ZCKePYY3';
const anon = { apikey: KEY, 'Content-Type': 'application/json' };

test('anonymous callers cannot read synced data or the Ask tables', async ({ request }) => {
  for (const table of ['sync_records', 'ask_usage', 'ask_cache']) {
    const res = await request.get(`${URL}/rest/v1/${table}?select=*&limit=1`, { headers: anon });
    expect(res.status(), table).toBe(401);
    expect((await res.json()).code, table).toBe('42501');
  }
});

test('anonymous callers can call no account function; only server_time answers', async ({
  request,
}) => {
  const calls: [string, unknown][] = [
    ['push_records', { p_records: [] }],
    ['reset_my_cloud_data', {}],
    ['compact_my_records', { p_cutoff: '2025-01-01' }],
    ['my_cloud_usage', {}],
    ['sync_server_version', {}],
    ['sync_row_limit', {}],
    ['sync_sort_key', { p_hlc: 'x', p_received_ms: 1 }],
    ['ask_take', { p_user: '00000000-0000-0000-0000-000000000000', p_limit: 1 }],
  ];
  for (const [fn, body] of calls) {
    const res = await request.post(`${URL}/rest/v1/rpc/${fn}`, { headers: anon, data: body });
    expect((await res.json()).code, fn).toBe('42501');
  }
  const time = await request.post(`${URL}/rest/v1/rpc/server_time`, { headers: anon, data: {} });
  expect(time.ok()).toBe(true);
  expect(Date.parse(await time.json())).toBeGreaterThan(Date.parse('2026-01-01'));
});

test('the sign-up allow-list is not reachable through the API', async ({ request }) => {
  const res = await request.get(`${URL}/rest/v1/signup_allowlist?select=*`, {
    headers: { ...anon, 'Accept-Profile': 'private' },
  });
  expect((await res.json()).code).toBe('PGRST106'); // schema not exposed
});

test('Edge Functions need a signed-in user and answer CORS only for ASCEND', async ({
  request,
}) => {
  for (const fn of ['ask', 'delete-account']) {
    const res = await request.post(`${URL}/functions/v1/${fn}`, {
      headers: { ...anon, Authorization: `Bearer ${KEY}` },
      data: { question: 'How do I learn ROS 2?' },
    });
    expect(res.status(), fn).toBe(401);
    expect((await res.json()).error, fn).toBe('signed_out');

    const own = await request.fetch(`${URL}/functions/v1/${fn}`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://ascend-vert-mu.vercel.app' },
    });
    expect(own.headers()['access-control-allow-origin'], fn).toBe(
      'https://ascend-vert-mu.vercel.app',
    );
    const stranger = await request.fetch(`${URL}/functions/v1/${fn}`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    });
    expect(stranger.headers()['access-control-allow-origin'], fn).toBeUndefined();
  }
});

test('the live site sends the security headers', async ({ request }) => {
  const res = await request.get('https://ascend-vert-mu.vercel.app/');
  const h = res.headers();
  expect(h['content-security-policy']).toContain("script-src 'self';");
  expect(h['strict-transport-security']).toContain('max-age=');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('DENY');
});

test('dashboard sign-up switch (informational until it is turned off)', async ({ request }) => {
  const res = await request.get(`${URL}/auth/v1/settings`, { headers: anon });
  const { disable_signup } = (await res.json()) as { disable_signup: boolean };
  test.info().annotations.push({
    type: disable_signup ? 'ok' : 'warning',
    description: disable_signup
      ? 'Sign-ups are off in the dashboard.'
      : 'Sign-ups are still ON in the dashboard — the database allow-list is the only lock.',
  });
  expect(typeof disable_signup).toBe('boolean');
});
