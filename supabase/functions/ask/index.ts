// Supabase Edge Function (Deno): "Ask the System" (SPEC 6.7 C).
// Career and health/growth questions only, answered by a free model through OpenRouter
// (openrouter.ts; the Gemini provider in gemini.ts is kept but unused). The key lives only here,
// as the Supabase secret OPENROUTER_API_KEY, and is never logged.
// Never receives health data, journal text, mood/energy or photos — the app sends only the
// question, goal/skill/quest progress numbers and Growth Compass hints (allow-listed there).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { corsHeaders } from '../_shared/cors.ts';
import {
  buildPrompt,
  cleanContext,
  cleanHints,
  cleanQuestion,
  MAX_BODY_BYTES,
  parseAnswer,
  UNTRUSTED_RULE,
} from './guard.ts';
import { openRouterProvider } from './openrouter.ts';

/** Hard cap per user per day (the app asks for less); keeps us inside free limits. */
const MAX_PER_DAY = 20;
const CACHE_DAYS = 7;

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
- You cannot browse the web and your knowledge may be out of date. When something can change
  (deadlines, fees, requirements, test formats, software versions, rankings, salaries), say it
  may have changed and tell the user to check the official site. Never invent links or numbers.
- Build on the trusted ASCEND guidance given with the question when it fits.
- If concrete next steps would help, end with a line "QUESTS:" followed by up to 3 lines
  "- <short weekly quest title>" (max 60 characters each).
${UNTRUSTED_RULE}`;

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

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const key = Deno.env.get('OPENROUTER_API_KEY');
  if (!key) {
    console.error('ask: OPENROUTER_API_KEY is not set');
    return json({ error: 'no_key' }, 503);
  }
  const provider = openRouterProvider(key, Deno.env.get('OPENROUTER_MODEL'));

  const asUser = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: who } = await asUser.auth.getUser();
  if (!who.user) return json({ error: 'signed_out' }, 401);
  const user = who.user.id;

  // Hardening V-14: a bounded body, and only allow-listed, shape-checked input (guard.ts).
  const raw = await req.text().catch(() => '');
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES)
    return json({ error: 'too_large' }, 413);
  let body: Body = {};
  try {
    body = JSON.parse(raw) as Body;
  } catch {
    return json({ error: 'empty' }, 400);
  }
  const question = cleanQuestion(body.question);
  if (question.length < 3) return json({ error: 'empty' }, 400);
  const contextData = cleanContext(body.context);
  const hintData = cleanHints(body.hints);
  const context = JSON.stringify(contextData);

  const admin = createClient(url, service);
  const cacheKey = await sha256(
    `${provider.name}|${Deno.env.get('OPENROUTER_MODEL') ?? ''}|${question.toLowerCase()}|${context}`,
  );
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

  const result = await provider.answer(SYSTEM, buildPrompt(question, contextData, hintData));
  if (!result.ok) {
    if (result.reason === 'quota') return json({ error: 'quota' }, 429);
    if (result.reason === 'no_key') return json({ error: 'no_key' }, 503);
    return json({ error: 'provider' }, 502);
  }
  if (result.text.trim().startsWith('OFF_TOPIC')) return json({ error: 'off_topic' }, 200);
  const sources = cleanHints(result.sources.length > 0 ? result.sources : hintData);
  const { text, quests } = parseAnswer(result.text);
  if (!text) return json({ error: 'provider' }, 502);
  const answer = { text, quests, sources, model: result.model };
  await admin.from('ask_cache').upsert({ user_id: user, key: cacheKey, answer });
  return json({ ...answer, cached: false });
});
