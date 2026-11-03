// deno test supabase/functions/ask/openrouter_test.ts — the provider with a stubbed fetch.
import { DEFAULT_MODEL, FALLBACK_MODEL, openRouterProvider } from './openrouter.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
type Reply = { status: number; body: unknown };
function stub(replies: Reply[]) {
  const seen: { model: string; auth: string }[] = [];
  const logs: string[] = [];
  const realFetch = globalThis.fetch;
  const realError = console.error;
  const realWarn = console.warn;
  console.error = (m: string) => void logs.push(m);
  console.warn = () => {};
  globalThis.fetch = ((_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    seen.push({ model: body.model, auth: (init.headers as Record<string, string>).Authorization });
    const r = replies.shift() ?? { status: 500, body: {} };
    return Promise.resolve(new Response(JSON.stringify(r.body), { status: r.status }));
  }) as typeof fetch;
  return {
    seen,
    logs,
    restore() {
      globalThis.fetch = realFetch;
      console.error = realError;
      console.warn = realWarn;
    },
  };
}
const ok = (text: string, model = DEFAULT_MODEL) => ({
  status: 200,
  body: { model, choices: [{ message: { content: text } }] },
});

Deno.test('answers with the default free model', async () => {
  const s = stub([ok('Hello')]);
  const r = await openRouterProvider('sk-secret').answer('sys', 'q');
  s.restore();
  assert(r.ok && r.text === 'Hello' && r.model === DEFAULT_MODEL, 'answer');
  assert(s.seen[0]?.model === DEFAULT_MODEL && s.seen[0]?.auth === 'Bearer sk-secret', 'request');
});

Deno.test('model unavailable → the fallback model; errors are logged without the key', async () => {
  const s = stub([
    { status: 404, body: { error: { code: 404, message: 'No endpoints found for model' } } },
    ok('From fallback', FALLBACK_MODEL),
  ]);
  const r = await openRouterProvider('sk-secret').answer('sys', 'q');
  s.restore();
  assert(r.ok && r.model === FALLBACK_MODEL, 'fallback used');
  assert(
    s.logs.some((l) => l.includes('404') && l.includes('No endpoints found')),
    'logged',
  );
  assert(!s.logs.some((l) => l.includes('sk-secret')), 'key never logged');
});

Deno.test('both models fail → a failure the app turns into the Compass fallback', async () => {
  const s = stub([
    {
      status: 429,
      body: { error: { code: 429, message: 'Rate limit exceeded: free-models-per-day' } },
    },
    { status: 503, body: { error: { code: 503, message: 'Provider unavailable' } } },
  ]);
  const r = await openRouterProvider('k').answer('sys', 'q');
  s.restore();
  assert(!r.ok && r.reason === 'provider' && s.seen.length === 2, 'failed after two tries');
});

Deno.test(
  'bad key or no credits → stop at once; a 200 carrying an error is still an error',
  async () => {
    let s = stub([
      { status: 401, body: { error: { code: 401, message: 'No auth credentials found' } } },
    ]);
    let r = await openRouterProvider('k').answer('sys', 'q');
    s.restore();
    assert(!r.ok && r.reason === 'no_key' && s.seen.length === 1, '401');
    s = stub([{ status: 402, body: { error: { code: 402, message: 'Insufficient credits' } } }]);
    r = await openRouterProvider('k').answer('sys', 'q');
    s.restore();
    assert(!r.ok && r.reason === 'quota' && s.seen.length === 1, '402');
    s = stub([
      { status: 200, body: { error: { code: 502, message: 'Upstream error' } } },
      ok('fine', FALLBACK_MODEL),
    ]);
    r = await openRouterProvider('k').answer('sys', 'q');
    s.restore();
    assert(r.ok && r.model === FALLBACK_MODEL, 'error in 200 → fallback');
  },
);

Deno.test('OPENROUTER_MODEL is tried first', async () => {
  const s = stub([ok('x', 'my/model:free')]);
  await openRouterProvider('k', 'my/model:free').answer('sys', 'q');
  s.restore();
  assert(s.seen[0]?.model === 'my/model:free', 'preferred first');
});
