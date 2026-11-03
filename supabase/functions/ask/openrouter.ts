// OpenRouter provider (OpenAI-compatible chat completions) — the one `ask` uses (2026-11).
// Key: Supabase secret OPENROUTER_API_KEY. Model: secret OPENROUTER_MODEL, else the default
// free model below; if the model is unavailable, one other free model is tried; if that fails
// too, the app falls back to the Growth Compass. No web search: answers come from the model's
// own knowledge, so the system prompt asks it to flag what may be outdated.
import { MAX_OUTPUT_TOKENS, type ModelFailure, type ModelProvider } from './provider.ts';

/**
 * Free models checked on 2026-11-04 via https://openrouter.ai/api/v1/models. There was no free
 * DeepSeek model then (DeepSeek is paid-only on OpenRouter), so the default is Google's
 * Gemma 4 31B and the fallback NVIDIA Nemotron 3 Ultra. Change with OPENROUTER_MODEL — no
 * redeploy needed.
 */
export const DEFAULT_MODEL = 'google/gemma-4-31b-it:free';
export const FALLBACK_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';
const URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Statuses where trying the other model can help (model gone, busy or rate-limited). */
const TRY_NEXT = new Set([0, 400, 404, 408, 429, 502, 503, 504]);

export function openRouterProvider(key: string, preferred?: string | null): ModelProvider {
  const models = [...new Set([preferred || DEFAULT_MODEL, FALLBACK_MODEL])];
  return {
    name: 'OpenRouter',
    async answer(system, prompt) {
      let last: ModelFailure = { ok: false, reason: 'provider', status: 0 };
      for (const model of models) {
        const res = await fetch(URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            // Optional attribution headers OpenRouter recommends.
            'HTTP-Referer': 'https://ascend-vert-mu.vercel.app',
            'X-Title': 'ASCEND',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: MAX_OUTPUT_TOKENS,
            // Reasoning models: keep their thinking out of the answer.
            reasoning: { exclude: true },
          }),
        }).catch((e: unknown) => {
          console.error(
            `ask: OpenRouter unreachable model=${model}: ${e instanceof Error ? e.message : e}`,
          );
          return null;
        });
        const data = res
          ? ((await res.json().catch(() => null)) as {
              model?: string;
              error?: { code?: number | string; message?: string; metadata?: unknown };
              choices?: { message?: { content?: string | null }; finish_reason?: string }[];
            } | null)
          : null;
        const status = res?.status ?? 0;
        // OpenRouter can also put an error inside a 200 response.
        const err = data?.error;
        if (res?.ok && !err) {
          const choice = data?.choices?.[0];
          const text = (choice?.message?.content ?? '').trim();
          if (text) return { ok: true, text, model: data?.model ?? model, sources: [] };
          console.error(
            `ask: OpenRouter empty answer model=${model} finish_reason=${choice?.finish_reason ?? '?'}`,
          );
          last = { ok: false, reason: 'provider', status };
          continue; // try the other model
        }
        const code = err?.code ?? status;
        const meta = err?.metadata ? ` metadata=${JSON.stringify(err.metadata).slice(0, 300)}` : '';
        console.error(
          `ask: OpenRouter ${status} code=${code} model=${model}: ${err?.message ?? '(no message)'}${meta}`,
        );
        const effective = typeof code === 'number' ? code : status;
        if (effective === 401) return { ok: false, reason: 'no_key', status: effective };
        if (effective === 402) return { ok: false, reason: 'quota', status: effective };
        last = { ok: false, reason: effective === 429 ? 'quota' : 'provider', status: effective };
        if (!TRY_NEXT.has(effective)) return last;
        if (model !== models.at(-1))
          console.warn(`ask: trying the fallback model after ${model} failed`);
      }
      return last;
    },
  };
}
