// Google Gemini provider — KEPT BUT NOT USED (2026-11-04: the Gemini key needed prepaid
// credits, 402 "prepayment credits are depleted"; `ask` now uses OpenRouter). To switch back,
// use `geminiProvider(...)` in index.ts and set the GEMINI_API_KEY secret.
// Search grounding is tried first and dropped when the key's tier refuses it.
import { MAX_OUTPUT_TOKENS, type ModelFailure, type ModelProvider } from './provider.ts';

/** Checked 2026-11: gemini-2.5-flash deprecated; stable Flash / Flash-Lite below. */
const MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'];
/** Whether Search grounding works for this key (remembered while the function stays warm). */
let groundingWorks: boolean | null = null;

interface Call {
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
}

async function call(
  model: string,
  key: string,
  system: string,
  prompt: string,
  grounded: boolean,
): Promise<Call> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(grounded ? { tools: [{ google_search: {} }] } : {}),
        generationConfig: { temperature: 0.3, maxOutputTokens: MAX_OUTPUT_TOKENS },
      }),
    },
  ).catch((e: unknown) => {
    console.error(`ask: Gemini unreachable model=${model}: ${e instanceof Error ? e.message : e}`);
    return null;
  });
  if (!res) return { ok: false, status: 0, data: null };
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const err = (data?.error ?? {}) as { status?: string; message?: string };
    console.error(
      `ask: Gemini ${res.status} ${err.status ?? ''} model=${model} grounding=${grounded}: ${err.message ?? '(no message)'}`,
    );
  }
  return { ok: res.ok, status: res.status, data };
}

export function geminiProvider(key: string, preferred?: string | null): ModelProvider {
  const models = [...new Set([preferred, ...MODELS].filter((m): m is string => !!m))];
  return {
    name: 'Google Gemini',
    async answer(system, prompt) {
      let c: Call = { ok: false, status: 0, data: null };
      let model = '';
      for (const m of models) {
        model = m;
        if (groundingWorks !== false) {
          c = await call(m, key, system, prompt, true);
          if (c.ok) {
            groundingWorks = true;
            break;
          }
          if (c.status !== 404 && c.status !== 401 && c.status !== 0) groundingWorks = false;
        }
        if (c.status !== 404 && c.status !== 401) {
          c = await call(m, key, system, prompt, false);
          if (c.ok) break;
        }
        if (c.status !== 404) break;
      }
      if (!c.ok) {
        const reason: ModelFailure['reason'] =
          c.status === 429 || c.status === 402
            ? 'quota'
            : c.status === 401 || c.status === 403
              ? 'no_key'
              : 'provider';
        return { ok: false, reason, status: c.status };
      }
      const data = c.data as {
        candidates?: {
          content?: { parts?: { text?: string; thought?: boolean }[] };
          finishReason?: string;
          groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] };
        }[];
      } | null;
      const cand = data?.candidates?.[0];
      const text = (cand?.content?.parts ?? [])
        .filter((p) => !p.thought)
        .map((p) => p.text ?? '')
        .join('')
        .trim();
      if (!text) {
        console.error(
          `ask: Gemini empty answer model=${model} finishReason=${cand?.finishReason ?? '?'}`,
        );
        return { ok: false, reason: 'provider', status: 200 };
      }
      const sources = (cand?.groundingMetadata?.groundingChunks ?? [])
        .map((g) => g.web)
        .filter((w): w is { uri: string; title?: string } => !!w?.uri)
        .map((w) => ({ title: w.title ?? w.uri, url: w.uri }));
      return { ok: true, text, model, sources };
    },
  };
}
