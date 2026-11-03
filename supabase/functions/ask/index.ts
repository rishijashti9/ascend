// Supabase Edge Function (Deno): "Ask the System" (SPEC 6.7 C).
// Career and health/growth questions only, answered by Google Gemini's free tier with Google
// Search grounding. The key lives only here, as the Supabase secret GEMINI_API_KEY.
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
const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';

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
  const cacheKey = await sha256(`${MODEL}|${question.toLowerCase()}|${context}`);
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
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 700 },
      }),
    },
  );
  if (res.status === 429) return json({ error: 'quota' }, 429);
  if (!res.ok) return json({ error: 'provider' }, 502);
  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const raw: string = (candidate?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? '')
    .join('')
    .trim();
  if (raw === 'OFF_TOPIC' || raw.startsWith('OFF_TOPIC')) return json({ error: 'off_topic' }, 200);
  const sources = (candidate?.groundingMetadata?.groundingChunks ?? [])
    .map((c: { web?: { uri?: string; title?: string } }) => c.web)
    .filter((w: { uri?: string } | undefined) => w?.uri)
    .slice(0, 5)
    .map((w: { uri: string; title?: string }) => ({ title: w.title ?? w.uri, url: w.uri }));
  const { text, quests } = parse(raw);
  const answer = { text, quests, sources, model: MODEL };
  await admin.from('ask_cache').upsert({ user_id: user, key: cacheKey, answer });
  return json({ ...answer, cached: false });
});
