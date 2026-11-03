// Supabase Edge Function (Deno): "Ask the System" (SPEC 6.7 C).
// Career and health/growth questions only, answered by Google Gemini's free tier. Google Search
// grounding is tried first and dropped automatically when the key's tier doesn't allow it (it
// isn't on the free tier for current models). The key lives only here, as the Supabase secret
// GEMINI_API_KEY, and is never logged.
// Never receives health data, journal text, mood/energy or photos — the app sends only the
// question, goal/skill/quest progress numbers and Growth Compass hints (allow-listed there).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

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

/** Hard cap per user per day (the app asks for less); keeps us inside the free quota. */
const MAX_PER_DAY = 20;
const CACHE_DAYS = 7;
/**
 * Models to try, in order (Google renames and retires models — checked 2026-11, when
 * gemini-2.5-flash was deprecated): an optional GEMINI_MODEL secret first, then the current
 * stable Flash, then Flash-Lite. A model that answers "not found" is skipped.
 */
const MODELS = [
  ...new Set(
    [Deno.env.get('GEMINI_MODEL'), 'gemini-3.6-flash', 'gemini-3.5-flash-lite'].filter(
      (m): m is string => !!m,
    ),
  ),
];
/** Whether Search grounding works for this key (remembered while the function stays warm). */
let groundingWorks: boolean | null = null;

interface GeminiCall {
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
}

async function callGemini(
  model: string,
  key: string,
  prompt: string,
  grounded: boolean,
): Promise<GeminiCall> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(grounded ? { tools: [{ google_search: {} }] } : {}),
        // Current models think before answering; leave room so the answer isn't cut to nothing.
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    },
  ).catch((e: unknown) => {
    console.error(`ask: Gemini unreachable model=${model}: ${e instanceof Error ? e.message : e}`);
    return null;
  });
  if (!res) return { ok: false, status: 0, data: null };
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    // Exact status and Google's own message (never the key) — shown in the function logs.
    const err = (data?.error ?? {}) as { status?: string; message?: string };
    console.error(
      `ask: Gemini ${res.status} ${err.status ?? ''} model=${model} grounding=${grounded}: ${err.message ?? '(no message)'}`,
    );
  }
  return { ok: res.ok, status: res.status, data };
}

const SYSTEM = `You are "the System" inside ASCEND, a personal growth app. Answer ONLY questions about
careers (career discovery, skills, learning roadmaps, studying, exams, applying to universities
or jobs) and health/growth (physical activity, sleep, recovery, nutrition basics, mental
wellbeing, habits and focus). If the question is about anything else, reply exactly: OFF_TOPIC
Rules:
- Calm, direct, practical. At most about 180 words. Plain words, short paragraphs or a short list.
- Use the user's progress numbers when they help; never ask for or guess health details.
- No diagnosis, medication or treatment advice: for pain, injury or illness say to see a doctor.
- No extreme diets or training, never suggest less sleep, weight change only at a safe rate.
- If the user seems in crisis, tell them to contact a local helpline or emergency number now.
- Prefer official and trusted sources; for deadlines, fees or requirements say to check the
  official site.
- If concrete next steps would help, end with a line "QUESTS:" followed by up to 3 lines
  "- <short weekly quest title>" (max 60 characters each).`;

interface Body {
  question?: unknown;
  context?: unknown;
  hints?: unknown;
}

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function parse(text: string): { text: string; quests: string[] } {
  const [answer, tail] = text.split(/\nQUESTS:\s*\n?/);
  const quests = (tail ?? '')
    .split('\n')
    .map((l) => l.replace(/^[-*•]\s*/, '').trim())
    .filter((l) => l.length > 0 && l.length <= 60)
    .slice(0, 3);
  return { text: (answer ?? '').trim(), quests };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return json({ error: 'no_key' }, 503);

  const asUser = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: who } = await asUser.auth.getUser();
  if (!who.user) return json({ error: 'signed_out' }, 401);
  const user = who.user.id;

  const body = (await req.json().catch(() => ({}))) as Body;
  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 500) : '';
  if (question.length < 3) return json({ error: 'empty' }, 400);
  const context = JSON.stringify(body.context ?? {}).slice(0, 2000);
  const hints = JSON.stringify(body.hints ?? []).slice(0, 2000);

  const admin = createClient(url, service);
  const cacheKey = await sha256(`${MODELS[0]}|${question.toLowerCase()}|${context}`);
  const since = new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString();
  const cached = await admin
    .from('ask_cache')
    .select('answer')
    .eq('user_id', user)
    .eq('key', cacheKey)
    .gte('created_at', since)
    .maybeSingle();
  if (cached.data) return json({ ...cached.data.answer, cached: true });

  const taken = await admin.rpc('ask_take', { p_user: user, p_limit: MAX_PER_DAY });
  if (taken.error || taken.data === -1) return json({ error: 'quota' }, 429);

  const prompt = `Question: ${question}\n\nMy progress (numbers only): ${context}\n\nTrusted ASCEND guidance that may help: ${hints}`;
  let call: GeminiCall = { ok: false, status: 0, data: null };
  let model = '';
  for (const m of MODELS) {
    model = m;
    if (groundingWorks !== false) {
      call = await callGemini(m, key, prompt, true);
      if (call.ok) {
        groundingWorks = true;
        break;
      }
      // Grounding refused (e.g. not on the free tier): retry without it, and remember that.
      if (call.status !== 404 && call.status !== 401 && call.status !== 0) {
        groundingWorks = false;
        console.warn(`ask: retrying model=${m} without Google Search grounding`);
      }
    }
    if (call.status !== 404 && call.status !== 401) {
      call = await callGemini(m, key, prompt, false);
      if (call.ok) break;
    }
    if (call.status !== 404) break; // only a missing/renamed model moves on to the next one
  }
  if (!call.ok) {
    if (call.status === 429) return json({ error: 'quota' }, 429);
    if (call.status === 401 || call.status === 403) return json({ error: 'no_key' }, 503);
    return json({ error: 'provider' }, 502);
  }
  const data = call.data as {
    candidates?: {
      content?: { parts?: { text?: string; thought?: boolean }[] };
      finishReason?: string;
      groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] };
    }[];
  } | null;
  const candidate = data?.candidates?.[0];
  const raw = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
    .trim();
  if (!raw) {
    console.error(
      `ask: empty answer model=${model} finishReason=${candidate?.finishReason ?? '?'}`,
    );
    return json({ error: 'provider' }, 502);
  }
  if (raw.startsWith('OFF_TOPIC')) return json({ error: 'off_topic' }, 200);
  const grounded = (candidate?.groundingMetadata?.groundingChunks ?? [])
    .map((c) => c.web)
    .filter((w): w is { uri: string; title?: string } => !!w?.uri)
    .map((w) => ({ title: w.title ?? w.uri, url: w.uri }));
  // Without grounding, the trusted Growth Compass links the app sent are the sources.
  const given = (Array.isArray(body.hints) ? body.hints : [])
    .filter((h: unknown): h is { title: string; url: string } => {
      const x = h as { title?: unknown; url?: unknown } | null;
      return (
        typeof x?.title === 'string' && typeof x?.url === 'string' && x.url.startsWith('https://')
      );
    })
    .map((h) => ({ title: h.title.slice(0, 120), url: h.url }));
  const sources = (grounded.length > 0 ? grounded : given).slice(0, 5);
  const { text, quests } = parse(raw);
  const answer = { text, quests, sources, model };
  await admin.from('ask_cache').upsert({ user_id: user, key: cacheKey, answer });
  return json({ ...answer, cached: false });
});
